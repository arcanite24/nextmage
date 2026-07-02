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
const DEFAULT_CONFIG = {
    pingInterval: 30000,
    requestTimeout: 30000,
    maxReconnectAttempts: 10,
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30000,
};
class WebSocketService {
    ws = null;
    url = '';
    requestId = 0;
    pendingRequests = new Map();
    callbackHandlers = new Set();
    statusChangeHandlers = new Set();
    pingInterval = null;
    reconnectAttempts = 0;
    reconnectTimeout = null;
    intentionalDisconnect = false;
    config;
    _status = 'disconnected';
    sessionIdProvider = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    get status() {
        return this._status;
    }
    setStatus(status) {
        this._status = status;
        this.statusChangeHandlers.forEach(handler => handler(status));
    }
    /**
     * Connect to the XMage WebSocket server
     */
    connect(url) {
        return new Promise((resolve, reject) => {
            this.url = url;
            this.intentionalDisconnect = false;
            this.setStatus('connecting');
            try {
                this.ws = new WebSocket(url);
            }
            catch (error) {
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
                }
                else {
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
    disconnect() {
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
    async send(method, params = []) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
        const id = ++this.requestId;
        const request = {
            method,
            params,
            id,
        };
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method} (id: ${id})`));
            }, this.config.requestTimeout);
            this.pendingRequests.set(id, { resolve: resolve, reject, timeout });
            try {
                this.ws.send(JSON.stringify(request));
                console.log('[WebSocket] Sent:', method, params);
            }
            catch (error) {
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
    requestOnce(url, method, params = []) {
        const id = ++this.requestId;
        return new Promise((resolve, reject) => {
            let settled = false;
            let socket;
            const settle = (callback) => {
                if (settled)
                    return;
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
            }
            catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Failed to create WebSocket: ${error}`));
                return;
            }
            socket.onopen = () => {
                const request = { method, params, id };
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
                    const response = JSON.parse(event.data);
                    if (response.id !== id)
                        return;
                    if (response.error) {
                        settle(() => reject(new Error(response.error)));
                    }
                    else {
                        console.log('[WebSocket] Probe response:', response.id, response.result);
                        settle(() => resolve(response.result));
                    }
                }
                catch (error) {
                    settle(() => reject(new Error(`Failed to parse response: ${error}`)));
                }
            };
        });
    }
    /**
     * Register a callback handler for server push messages
     * Returns an unsubscribe function
     */
    onCallback(handler) {
        this.callbackHandlers.add(handler);
        return () => {
            this.callbackHandlers.delete(handler);
        };
    }
    /**
     * Register a status change handler
     * Returns an unsubscribe function
     */
    onStatusChange(handler) {
        this.statusChangeHandlers.add(handler);
        return () => {
            this.statusChangeHandlers.delete(handler);
        };
    }
    setSessionIdProvider(provider) {
        this.sessionIdProvider = provider;
    }
    /**
     * Send a ping to keep the connection alive
     */
    async ping() {
        try {
            const sessionId = this.sessionIdProvider?.();
            const params = sessionId ? [sessionId, 'web-client'] : [];
            return await this.send('ping', params);
        }
        catch (error) {
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
    async searchCards(criteria) {
        return this.send('searchCards', [criteria]);
    }
    async validateDeck(deckType, deck) {
        return this.send('deckValidate', [deckType, deck]);
    }
    async getBasicLandSets() {
        return this.send('getBasicLandSets', []);
    }
    async getDeckTypes() {
        return this.send('getDeckTypes', []);
    }
    async getExpansionSets() {
        return this.send('getExpansionSets', []);
    }
    // === Private Methods ===
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            // Check if it's a JSON-RPC response (has id and jsonrpc)
            // Check if it's a JSON-RPC response (has jsonrpc)
            if (message.jsonrpc === '2.0') {
                if (message.id !== undefined && message.id !== null) {
                    this.handleResponse(message);
                }
                else if (message.error) {
                    // Global/Uncorrelated JSON-RPC error
                    console.error('[WebSocket] Global error:', message.error);
                    // Dispatch as user message so it shows in UI
                    this.handleCallback({
                        method: 'showUserMessage',
                        data: ['Server Error', message.error],
                        messageId: 0,
                        objectId: null
                    });
                }
            }
            else if (message.messageId !== undefined && message.method !== undefined) {
                // It's a ClientCallback
                this.handleCallback(message);
            }
            else {
                console.warn('[WebSocket] Unknown message format:', message);
            }
        }
        catch (error) {
            console.error('[WebSocket] Failed to parse message:', error, event.data);
        }
    }
    handleResponse(response) {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            console.warn('[WebSocket] Received response for unknown request:', response.id);
            return;
        }
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        if (response.error) {
            console.error('[WebSocket] Server error:', response.error);
            pending.reject(new Error(response.error));
        }
        else {
            console.log('[WebSocket] Response:', response.id, response.result);
            pending.resolve(response.result);
        }
    }
    handleCallback(callback) {
        console.log('[WebSocket] Callback:', callback.method, callback);
        this.callbackHandlers.forEach(handler => {
            try {
                handler(callback);
            }
            catch (error) {
                console.error('[WebSocket] Callback handler error:', error);
            }
        });
    }
    startPingInterval() {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            this.ping();
        }, this.config.pingInterval);
    }
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            this.setStatus('disconnected');
            return;
        }
        this.setStatus('reconnecting');
        const delay = Math.min(this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts), this.config.reconnectMaxDelay);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.url).catch((error) => {
                console.error('[WebSocket] Reconnection failed:', error);
            });
        }, delay);
    }
    cancelReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
    rejectAllPendingRequests(error) {
        this.pendingRequests.forEach((pending, id) => {
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
