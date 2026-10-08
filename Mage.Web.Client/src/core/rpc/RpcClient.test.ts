import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConnectionError, RpcClient, RpcError, type SocketLike } from './RpcClient';
import { EventBus } from './EventBus';

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason: '' });
  }

  reply(id: number, result: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id, result }) });
  }

  fail(id: number, code: number, message: string): void {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) });
  }

  push(method: string, messageId: number, data: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ method, messageId, objectId: null, data }) });
  }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];

function createClient() {
  return new RpcClient({
    createSocket: (url) => new FakeSocket(url),
    heartbeatMs: 0,
    reconnectInitialDelayMs: 10,
    requestTimeoutMs: 1000,
    waitForOpenMs: 1000,
  });
}

describe('RpcClient', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('resolves typed calls and rejects with server error codes', async () => {
    const client = createClient();
    const connected = client.connect('ws://test');
    last().open();
    await connected;

    const tables = client.call('roomGetAllTables', 'room-1');
    const request = last().sent[0];
    expect(request).toMatchObject({ jsonrpc: '2.0', method: 'roomGetAllTables', params: ['room-1'] });
    last().reply(request.id as number, []);
    await expect(tables).resolves.toEqual([]);

    const denied = client.call('roomGetAllTables', 'room-1');
    last().fail(last().sent[1].id as number, -32001, 'Not connected');
    await expect(denied).rejects.toMatchObject({ name: 'RpcError', code: -32001 });
    await expect(denied).rejects.toBeInstanceOf(RpcError);
  });

  test('a failed first connection is reported, not retried', async () => {
    const client = createClient();
    const connected = client.connect('ws://down');
    last().drop();
    await expect(connected).rejects.toBeInstanceOf(ConnectionError);
    expect(client.getStatus()).toBe('closed');
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test('reconnects after a lost connection, fails pending calls and queues new ones', async () => {
    const client = createClient();
    const statuses: string[] = [];
    client.onStatus((status) => statuses.push(status));
    const connected = client.connect('ws://test');
    last().open();
    await connected;

    const lost = client.call('getServerState');
    const first = last();
    first.drop();
    await expect(lost).rejects.toBeInstanceOf(ConnectionError);
    expect(client.getStatus()).toBe('reconnecting');

    const queued = client.call('getServerState');
    vi.advanceTimersByTime(20);
    const second = last();
    expect(second).not.toBe(first);
    second.open();
    await vi.waitFor(() => expect(second.sent).toHaveLength(1));
    second.reply(second.sent[0].id as number, { testMode: true });
    await expect(queued).resolves.toEqual({ testMode: true });
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'open']);
  });

  test('ignores events from a replaced socket', async () => {
    const client = createClient();
    const events: string[] = [];
    client.onEvent((event) => events.push(event.method));
    const connected = client.connect('ws://test');
    const stale = last();
    stale.open();
    await connected;

    const reconnected = client.connect('ws://test');
    last().open();
    await reconnected;
    stale.push('GAME_UPDATE', 1, {});
    last().push('GAME_UPDATE', 1, {});
    expect(events).toEqual(['GAME_UPDATE']);
  });

  test('login calls start a new session before the request is sent', async () => {
    const client = createClient();
    const order: string[] = [];
    client.onSessionStart(() => order.push('session'));
    const connected = client.connect('ws://test');
    last().open();
    await connected;
    last().send = ((send) => (data: string) => {
      order.push('send');
      send(data);
    })(last().send.bind(last()));

    void client.call('connectUser', 'alice', 'secret', '');
    expect(order).toEqual(['session', 'send']);
  });
});

describe('EventBus', () => {
  test('skips outdated snapshots, keeps dialogs, and restarts ordering per session', async () => {
    FakeSocket.instances = [];
    const client = createClient();
    const bus = new EventBus(client);
    const seen: string[] = [];
    bus.on('GAME_UPDATE', (_data, event) => seen.push(`update-${event.messageId}`));
    bus.on('GAME_TARGET', (_data, event) => seen.push(`target-${event.messageId}`));

    const connected = client.connect('ws://test');
    last().open();
    await connected;

    last().push('GAME_UPDATE', 5, {});
    last().push('GAME_UPDATE', 3, {}); // outdated snapshot
    last().push('GAME_TARGET', 4, {}); // dialogs always count
    void client.call('connectUser', 'alice', '', ''); // new session: ids restart
    last().push('GAME_UPDATE', 1, {});

    expect(seen).toEqual(['update-5', 'target-4', 'update-1']);
  });
});
