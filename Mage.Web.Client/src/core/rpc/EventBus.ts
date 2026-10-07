import { CALLBACK_DELIVERY, type CallbackMethodName, type CallbackPayloads } from '../../protocol/generated/protocol';
import type { ServerEvent } from './RpcClient';

export type EventHandler<M extends CallbackMethodName> = (data: CallbackPayloads[M], event: ServerEvent<M>) => void;

interface EventSource {
  onEvent(listener: (event: ServerEvent) => void): () => void;
  onSessionStart(listener: () => void): () => void;
  onStatus(listener: (status: string) => void): () => void;
}

/**
 * Typed fan-out of server events, with the server's ordering rule:
 * state snapshots (UPDATE) older than the newest processed event are skipped, everything else is delivered.
 * Message ids are per server session, so ordering restarts with every login or reconnect.
 */
export class EventBus {
  private readonly handlers = new Map<CallbackMethodName, Set<EventHandler<CallbackMethodName>>>();
  private readonly anyHandlers = new Set<(event: ServerEvent) => void>();
  private lastMessageId = -1;
  private readonly unsubscribers: (() => void)[] = [];

  constructor(source: EventSource) {
    this.unsubscribers.push(
      source.onEvent((event) => this.dispatch(event)),
      source.onSessionStart(() => this.resetOrdering()),
      source.onStatus((status) => {
        if (status === 'open') this.resetOrdering();
      }),
    );
  }

  on<M extends CallbackMethodName>(method: M, handler: EventHandler<M>): () => void {
    let set = this.handlers.get(method);
    if (!set) {
      set = new Set();
      this.handlers.set(method, set);
    }
    set.add(handler as unknown as EventHandler<CallbackMethodName>);
    return () => set!.delete(handler as unknown as EventHandler<CallbackMethodName>);
  }

  onAny(handler: (event: ServerEvent) => void): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  resetOrdering(): void {
    this.lastMessageId = -1;
  }

  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.handlers.clear();
    this.anyHandlers.clear();
  }

  /** @returns false when the event was skipped as outdated */
  dispatch(event: ServerEvent): boolean {
    const delivery = CALLBACK_DELIVERY[event.method];
    if (delivery === undefined) {
      console.warn(`[events] Unknown server event ${event.method}`);
      return false;
    }
    if (delivery === 'UPDATE' && event.messageId < this.lastMessageId) {
      return false;
    }
    this.lastMessageId = Math.max(this.lastMessageId, event.messageId);

    this.anyHandlers.forEach((handler) => this.safely(event.method, () => handler(event)));
    this.handlers.get(event.method)?.forEach((handler) =>
      this.safely(event.method, () => handler(event.data, event)));
    return true;
  }

  private safely(method: string, run: () => void): void {
    try {
      run();
    } catch (error) {
      console.error(`[events] Handler for ${method} failed`, error);
    }
  }
}
