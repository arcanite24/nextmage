import { afterEach, describe, expect, test, vi } from 'vitest';
import type { CallbackMethodName } from '../../protocol/generated/protocol';
import { EventBus } from './EventBus';
import type { ServerEvent } from './RpcClient';

/** A stand-in for RpcClient's event surface. */
function fakeSource() {
  const events = new Set<(event: ServerEvent) => void>();
  const starts = new Set<() => void>();
  const statuses = new Set<(status: string) => void>();
  return {
    onEvent: (listener: (event: ServerEvent) => void) => {
      events.add(listener);
      return () => events.delete(listener);
    },
    onSessionStart: (listener: () => void) => {
      starts.add(listener);
      return () => starts.delete(listener);
    },
    onStatus: (listener: (status: string) => void) => {
      statuses.add(listener);
      return () => statuses.delete(listener);
    },
    emit: (event: ServerEvent) => events.forEach((listener) => listener(event)),
    startSession: () => starts.forEach((listener) => listener()),
    status: (status: string) => statuses.forEach((listener) => listener(status)),
    listenerCount: () => events.size + starts.size + statuses.size,
  };
}

function event(method: CallbackMethodName, messageId: number, data: unknown = {}): ServerEvent {
  return { method, messageId, objectId: 'game-1', data } as ServerEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EventBus', () => {
  test('delivers typed events to the handlers of that method and to onAny', () => {
    const source = fakeSource();
    const bus = new EventBus(source);
    const update = vi.fn();
    const chat = vi.fn();
    const any = vi.fn();
    bus.on('GAME_UPDATE', update);
    bus.on('CHATMESSAGE', chat);
    bus.onAny(any);

    const payload = { turn: 1 };
    source.emit(event('GAME_UPDATE', 1, payload));
    expect(update).toHaveBeenCalledWith(payload, expect.objectContaining({ method: 'GAME_UPDATE', messageId: 1 }));
    expect(chat).not.toHaveBeenCalled();
    expect(any).toHaveBeenCalledTimes(1);
  });

  test('skips state snapshots older than the newest event but delivers older messages', () => {
    const source = fakeSource();
    const bus = new EventBus(source);
    const update = vi.fn();
    const chat = vi.fn();
    bus.on('GAME_UPDATE', update);
    bus.on('CHATMESSAGE', chat);

    expect(bus.dispatch(event('GAME_UPDATE', 5))).toBe(true);
    expect(bus.dispatch(event('GAME_UPDATE', 3))).toBe(false);
    expect(bus.dispatch(event('CHATMESSAGE', 2))).toBe(true);
    expect(bus.dispatch(event('GAME_UPDATE', 5))).toBe(true); // same id is not older
    expect(update).toHaveBeenCalledTimes(2);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  test('ordering restarts with a new session or a reopened socket', () => {
    const source = fakeSource();
    const bus = new EventBus(source);
    const update = vi.fn();
    bus.on('GAME_UPDATE', update);

    source.emit(event('GAME_UPDATE', 100));
    source.startSession();
    source.emit(event('GAME_UPDATE', 1));
    expect(update).toHaveBeenCalledTimes(2);

    source.emit(event('GAME_UPDATE', 50));
    source.status('closed');
    source.emit(event('GAME_UPDATE', 2));
    expect(update).toHaveBeenCalledTimes(3);
    source.status('open');
    source.emit(event('GAME_UPDATE', 2));
    expect(update).toHaveBeenCalledTimes(4);
  });

  test('a failing handler does not stop the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = new EventBus(fakeSource());
    const after = vi.fn();
    bus.onAny(() => {
      throw new Error('boom');
    });
    bus.on('GAME_ASK', () => {
      throw new Error('boom');
    });
    bus.on('GAME_ASK', after);
    expect(bus.dispatch(event('GAME_ASK', 1))).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
  });

  test('unknown events are dropped with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bus = new EventBus(fakeSource());
    const any = vi.fn();
    bus.onAny(any);
    expect(bus.dispatch(event('NOT_A_METHOD' as CallbackMethodName, 1))).toBe(false);
    expect(any).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  test('unsubscribe and dispose stop delivery and detach from the source', () => {
    const source = fakeSource();
    const bus = new EventBus(source);
    const update = vi.fn();
    const any = vi.fn();
    const off = bus.on('GAME_UPDATE', update);
    bus.onAny(any);
    off();
    source.emit(event('GAME_UPDATE', 1));
    expect(update).not.toHaveBeenCalled();
    expect(any).toHaveBeenCalledTimes(1);

    expect(source.listenerCount()).toBe(3);
    bus.dispose();
    expect(source.listenerCount()).toBe(0);
    source.emit(event('GAME_UPDATE', 2));
    expect(any).toHaveBeenCalledTimes(1);
  });
});
