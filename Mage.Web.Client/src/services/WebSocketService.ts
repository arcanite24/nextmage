/**
 * WebSocket Service
 * 
 * Singleton service for managing WebSocket connection to XMage server.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Request/response correlation via ID field
 * - Callback dispatch to registered handlers
 * - Ping/pong keep-alive (every 30 seconds)
 * - Request timeout handling (default: 30 seconds)
 */

import { RpcError } from '../types/api.js';
import type { ClientCallback, JsonRpcRequest, JsonRpcResponse, SearchCardView, CardSearchCriteria, BasicLandSetInfo, DeckCardLists, DeckValidationResultView, ExpansionSetInfo } from '../types/index.js';

/** Requests that make the server issue a new session for this connection. */
const SESSION_START_METHODS = new Set(['connectUser', 'connectAdmin', 'authRegister', 'authSendTokenToEmail', 'authResetPassword']);

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface PendingRequest<T = unknown> {
    resolve: (value: T) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

export interface WebSocketServiceConfig {
    pingInterval: number;       // ms between pings (default: 30000)
    requestTimeout: number;     // ms before request times out (default: 30000)
    maxReconnectAttempts: number; // max reconnection attempts (default: 10)
    reconnectBaseDelay: number; // base delay for exponential backoff (default: 1000)
    reconnectMaxDelay: number;  // max delay between reconnections (default: 30000)
}

const DEFAULT_CONFIG: WebSocketServiceConfig = {
    pingInterval: 30000,
    requestTimeout: 30000,
    maxReconnectAttempts: 10,
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30000,
};

type CallbackHandler = (callback: ClientCallback) => void;
type StatusChangeHandler = (status: ConnectionStatus) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private url: string = '';
    private requestId = 0;
    private pendingRequests = new Map<number, PendingRequest>();
    private callbackHandlers: Set<CallbackHandler> = new Set();
    private statusChangeHandlers: Set<StatusChangeHandler> = new Set();
    private sessionStartHandlers: Set<() => void> = new Set();
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts = 0;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private intentionalDisconnect = false;
    private config: WebSocketServiceConfig;
    private _status: ConnectionStatus = 'disconnected';
    private sessionIdProvider: (() => string | null | undefined) | null = null;

    constructor(config: Partial<WebSocketServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get status(): ConnectionStatus {
        return this._status;
    }

    private setStatus(status: ConnectionStatus): void {
        this._status = status;
        this.statusChangeHandlers.forEach(handler => handler(status));
    }

    /**
     * Connect to the XMage WebSocket server
     */
    connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.url = url;
            this.intentionalDisconnect = false;
            this.setStatus('connecting');

            try {
                this.ws = new WebSocket(url);
            } catch (error) {
                this.setStatus('disconnected');
                reject(new Error(`Failed to create WebSocket: ${error}`));
                return;
            }

            this.ws.onopen = () => {
                console.log('[WebSocket] Connected to', url);
                this.setStatus('connected');
                this.reconnectAttempts = 0;
                this.startPingInterval();
                resolve();
            };

            this.ws.onerror = (event) => {
                console.error('[WebSocket] Error:', event);
                if (this._status === 'connecting') {
                    reject(new Error('WebSocket connection failed'));
                }
            };

            this.ws.onclose = (event) => {
                console.log('[WebSocket] Connection closed:', event.code, event.reason);
                this.stopPingInterval();
                this.rejectAllPendingRequests(new Error('Connection closed'));

                if (!this.intentionalDisconnect) {
                    this.scheduleReconnect();
                } else {
                    this.setStatus('disconnected');
                }
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event);
            };
        });
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        this.intentionalDisconnect = true;
        this.cancelReconnect();
        this.stopPingInterval();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.rejectAllPendingRequests(new Error('Client disconnected'));
        this.setStatus('disconnected');
    }

    /**
     * Send a JSON-RPC request and wait for response
     */
    async send<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const id = ++this.requestId;
        const request: JsonRpcRequest = {
            method,
            params,
            id,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method} (id: ${id})`));
            }, this.config.requestTimeout);

            this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });

            try {
                if (SESSION_START_METHODS.has(method)) {
                    // the server starts a new session (message ids restart at 0) before it answers
                    this.sessionStartHandlers.forEach(handler => handler());
                }
                this.ws!.send(JSON.stringify(request));
                console.log('[WebSocket] Sent:', method, params);
            } catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(new Error(`Failed to send message: ${error}`));
            }
        });
    }

    /**
     * Send a single JSON-RPC request over an isolated socket.
     * Useful for unauthenticated probes such as server status checks that must
     * not mutate the app's active session connection or reconnect state.
     */
    requestOnce<T = unknown>(url: string, method: string, params: unknown[] = []): Promise<T> {
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            let settled = false;
            let socket: WebSocket;

            const settle = (callback: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                callback();
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close(1000, 'Status probe complete');
                }
            };

            const timeout = setTimeout(() => {
                settle(() => reject(new Error(`Request timeout: ${method} (id: ${id})`)));
            }, this.config.requestTimeout);

            try {
                socket = new WebSocket(url);
            } catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Failed to create WebSocket: ${error}`));
                return;
            }

            socket.onopen = () => {
                const request: JsonRpcRequest = { method, params, id };
                socket.send(JSON.stringify(request));
                console.log('[WebSocket] Probe sent:', method, params);
            };

            socket.onerror = () => {
                settle(() => reject(new Error('WebSocket connection failed')));
            };

            socket.onclose = () => {
                settle(() => reject(new Error('Connection closed')));
            };

            socket.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data) as JsonRpcResponse<T>;
                    if (response.id !== id) return;

                    if (response.error) {
                        settle(() => reject(new RpcError(response.error!)));
                    } else {
                        console.log('[WebSocket] Probe response:', response.id, response.result);
                        settle(() => resolve(response.result as T));
                    }
                } catch (error) {
                    settle(() => reject(new Error(`Failed to parse response: ${error}`)));
                }
            };
        });
    }

    /**
     * Register a callback handler for server push messages
     * Returns an unsubscribe function
     */
    onCallback(handler: CallbackHandler): () => void {
        this.callbackHandlers.add(handler);
        return () => {
            this.callbackHandlers.delete(handler);
        };
    }

    /**
     * Register a status change handler
     * Returns an unsubscribe function
     */
    onStatusChange(handler: StatusChangeHandler): () => void {
        this.statusChangeHandlers.add(handler);
        return () => {
            this.statusChangeHandlers.delete(handler);
        };
    }

    /**
     * Register a handler for the start of a new server session (login on this connection).
     * Server sessions are per connection, so a reconnect also starts a new session.
     */
    onSessionStart(handler: () => void): () => void {
        this.sessionStartHandlers.add(handler);
        return () => {
            this.sessionStartHandlers.delete(handler);
        };
    }

    setSessionIdProvider(provider: (() => string | null | undefined) | null): void {
        this.sessionIdProvider = provider;
    }

    /**
     * Send a ping to keep the connection alive
     */
    async ping(): Promise<boolean> {
        try {
            const sessionId = this.sessionIdProvider?.();
            const params = sessionId ? [sessionId, 'web-client'] : [];
            return await this.send<boolean>('ping', params);
        } catch (error) {
            console.warn('[WebSocket] Ping failed:', error);
            return false;
        }
    }

    /**
     * Search for cards
     */
    /**
     * Search for cards
     */
    async searchCards(criteria: CardSearchCriteria): Promise<SearchCardView[]> {
        return this.send<SearchCardView[]>('searchCards', [criteria]);
    }

    async validateDeck(deckType: string, deck: DeckCardLists): Promise<DeckValidationResultView> {
        return this.send<DeckValidationResultView>('deckValidate', [deckType, deck]);
    }

    async getBasicLandSets(): Promise<BasicLandSetInfo[]> {
        return this.send<BasicLandSetInfo[]>('getBasicLandSets', []);
    }

    async getDeckTypes(): Promise<string[]> {
        return this.send<string[]>('getDeckTypes', []);
    }

    async getExpansionSets(): Promise<ExpansionSetInfo[]> {
        return this.send<ExpansionSetInfo[]>('getExpansionSets', []);
    }

    // === Private Methods ===

    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data);

            // Check if it's a JSON-RPC response (has id and jsonrpc)
            // Check if it's a JSON-RPC response (has jsonrpc)
            if (message.jsonrpc === '2.0') {
                if (message.id !== undefined && message.id !== null) {
                    this.handleResponse(message as JsonRpcResponse);
                } else if (message.error) {
                    // Global/Uncorrelated JSON-RPC error
                    console.error('[WebSocket] Global error:', message.error);
                    // Dispatch as user message so it shows in UI
                    this.handleCallback({
                        method: 'showUserMessage',
                        data: ['Server Error', typeof message.error === 'string' ? message.error : message.error.message],
                        messageId: 0,
                        objectId: null
                    } as any);
                }
            } else if (message.messageId !== undefined && message.method !== undefined) {
                // It's a ClientCallback
                this.handleCallback(message as ClientCallback);
            } else {
                console.warn('[WebSocket] Unknown message format:', message);
            }
        } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error, event.data);
        }
    }

    private handleResponse(response: JsonRpcResponse): void {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            console.warn('[WebSocket] Received response for unknown request:', response.id);
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
            console.error('[WebSocket] Server error:', response.error);
            pending.reject(new RpcError(response.error));
        } else {
            console.log('[WebSocket] Response:', response.id, response.result);
            pending.resolve(response.result);
        }
    }

    private handleCallback(callback: ClientCallback): void {
        console.log('[WebSocket] Callback:', callback.method, callback);
        this.callbackHandlers.forEach(handler => {
            try {
                handler(callback);
            } catch (error) {
                console.error('[WebSocket] Callback handler error:', error);
            }
        });
    }

    private startPingInterval(): void {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            this.ping();
        }, this.config.pingInterval);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            this.setStatus('disconnected');
            return;
        }

        this.setStatus('reconnecting');

        const delay = Math.min(
            this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
            this.config.reconnectMaxDelay
        );

        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.url).catch((error) => {
                console.error('[WebSocket] Reconnection failed:', error);
            });
        }, delay);
    }

    private cancelReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    private rejectAllPendingRequests(error: Error): void {
        this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pendingRequests.clear();
    }
}

// Export singleton instance
export const wsService = new WebSocketService();

// Export class for testing/alternative instances
export { WebSocketService };
