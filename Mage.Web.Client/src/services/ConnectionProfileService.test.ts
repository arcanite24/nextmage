import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConnectionProfileService,
  DEFAULT_SERVER_URL,
  buildServerUrl,
  connectionProfileKey,
  normalizeServerUrl,
  parseServerEndpoint,
} from './ConnectionProfileService.js';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('normalizes host-only server entries into websocket endpoints', () => {
  assert.equal(normalizeServerUrl('localhost'), DEFAULT_SERVER_URL);
  assert.equal(normalizeServerUrl('127.0.0.1'), 'ws://127.0.0.1:17172');
  assert.equal(normalizeServerUrl('https://example.com/mage/'), 'wss://example.com:17172/mage');
  assert.equal(normalizeServerUrl('wss://play.example.com:443/ws'), 'wss://play.example.com/ws');
});

test('parses and builds split server endpoint fields', () => {
  assert.deepEqual(parseServerEndpoint('https://play.example.com:17200/mage/'), {
    protocol: 'wss',
    host: 'play.example.com',
    port: '17200',
    path: '/mage',
  });

  assert.equal(
    buildServerUrl({
      protocol: 'wss',
      host: 'play.example.com',
      port: '17200',
      path: '/mage/',
    }),
    'wss://play.example.com:17200/mage',
  );
  assert.equal(buildServerUrl({ host: 'localhost', port: '17172' }), DEFAULT_SERVER_URL);
});

test('remembers recent servers and usernames per normalized endpoint', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  let snapshot = service.load();

  snapshot = service.rememberLogin(snapshot, 'localhost', 'Alice', 'alice@example.com');
  snapshot = service.rememberLogin(snapshot, 'ws://127.0.0.1:17172', 'Bob');
  snapshot = service.rememberLogin(snapshot, 'ws://localhost:17172', 'Alice2');

  assert.deepEqual(
    snapshot.recentServers.map(server => server.url),
    ['ws://localhost:17172', 'ws://127.0.0.1:17172'],
  );
  assert.equal(snapshot.userNamesByServer['ws://localhost:17172'], 'Alice2');
  assert.equal(snapshot.userNamesByServer['ws://127.0.0.1:17172'], 'Bob');
  assert.equal(
    snapshot.emailsByServerUser[connectionProfileKey('localhost', 'Alice')],
    'alice@example.com',
  );
});

test('persists auto-connect settings with the selected endpoint', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  let snapshot = service.load();

  snapshot = service.withSelectedServer(snapshot, '127.0.0.1');
  snapshot = service.withAutoConnect(snapshot, true, snapshot.lastServerUrl);

  const restored = service.load();
  assert.equal(restored.autoConnect, true);
  assert.equal(restored.autoConnectServerUrl, 'ws://127.0.0.1:17172');
});

test('normalizes partial persisted profiles before callers index nested records', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  const snapshot = service.normalize({
    lastServerUrl: 'localhost',
    recentServers: [{ url: 'example.com', label: '', lastConnectedAt: '' }],
  });

  assert.equal(snapshot.lastServerUrl, DEFAULT_SERVER_URL);
  assert.equal(snapshot.recentServers[0].url, 'ws://example.com:17172');
  assert.deepEqual(snapshot.customServerPresets, []);
  assert.deepEqual(snapshot.userNamesByServer, {});
  assert.deepEqual(snapshot.emailsByServerUser, {});
  assert.deepEqual(snapshot.restoreSessionsByServerUser, {});
  assert.equal(snapshot.autoConnect, false);
  assert.equal(snapshot.autoConnectServerUrl, DEFAULT_SERVER_URL);
});

test('saves, updates, and deletes custom server presets', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  let snapshot = service.load();

  snapshot = service.saveServerPreset(snapshot, 'Kitchen Table', 'example.com:17200');
  assert.equal(snapshot.customServerPresets.length, 1);
  assert.equal(snapshot.customServerPresets[0].label, 'Kitchen Table');
  assert.equal(snapshot.customServerPresets[0].url, 'ws://example.com:17200');

  const presetId = snapshot.customServerPresets[0].id;
  snapshot = service.saveServerPreset(snapshot, 'Friday Night', 'ws://example.com:17200');
  assert.equal(snapshot.customServerPresets.length, 1);
  assert.equal(snapshot.customServerPresets[0].id, presetId);
  assert.equal(snapshot.customServerPresets[0].label, 'Friday Night');

  snapshot = service.saveServerPreset(snapshot, '', 'wss://proxy.example.com/mage');
  assert.equal(snapshot.customServerPresets.length, 2);
  assert.equal(snapshot.customServerPresets[0].label, 'proxy.example.com:17172');

  const restored = service.load();
  assert.deepEqual(
    restored.customServerPresets.map(preset => preset.url),
    ['wss://proxy.example.com:17172/mage', 'ws://example.com:17200'],
  );

  snapshot = service.deleteServerPreset(restored, presetId);
  assert.deepEqual(
    snapshot.customServerPresets.map(preset => preset.url),
    ['wss://proxy.example.com:17172/mage'],
  );
});

test('stores restore sessions per normalized server and username', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  let snapshot = service.load();

  snapshot = service.rememberRestoreSession(snapshot, 'localhost', 'Alice', 'session-local');
  snapshot = service.rememberRestoreSession(snapshot, '127.0.0.1', 'Alice', 'session-loopback');
  snapshot = service.rememberRestoreSession(snapshot, 'localhost', 'Bob', 'session-bob');

  assert.equal(service.findRestoreSession(snapshot, 'ws://localhost:17172', 'alice'), 'session-local');
  assert.equal(service.findRestoreSession(snapshot, 'ws://127.0.0.1:17172', 'ALICE'), 'session-loopback');
  assert.equal(service.findRestoreSession(snapshot, 'localhost', 'Bob'), 'session-bob');
  assert.equal(service.findRestoreSession(snapshot, 'localhost', 'Carol'), '');
});

test('clears restore sessions without removing recent server or remembered username', () => {
  const service = new ConnectionProfileService(new MemoryStorage());
  let snapshot = service.load();

  snapshot = service.rememberLogin(snapshot, 'localhost', 'Alice');
  snapshot = service.rememberRestoreSession(snapshot, 'localhost', 'Alice', 'session-local');
  snapshot = service.clearRestoreSession(snapshot, 'localhost', 'Alice');

  assert.equal(service.findRestoreSession(snapshot, 'localhost', 'Alice'), '');
  assert.equal(snapshot.userNamesByServer[DEFAULT_SERVER_URL], 'Alice');
  assert.equal(snapshot.recentServers[0]?.url, DEFAULT_SERVER_URL);
});
