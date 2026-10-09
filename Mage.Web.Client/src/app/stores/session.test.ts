// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeConnection, type FakeConnection } from '../../test/fakeConnection';


const SERVER = 'ws://server:17172';

async function load() {
  const { useSession } = await import('./session');
  return { useSession, fake: (await import('../connection')) as unknown as FakeConnection };
}

function restoreSaved() {
  return JSON.parse(localStorage.getItem('playmat.restore') ?? 'null');
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// the store wires itself to the connection at import: every test gets a fresh store on a fresh fake connection
function freshModules() {
  vi.resetModules();
  vi.doMock('../connection', () => createFakeConnection());
}

beforeEach(() => {
  freshModules();
  localStorage.clear();
});

describe('session store', () => {
  test('signs in, remembers the login and the restore token', async () => {
    const { useSession, fake } = await load();
    expect(await useSession.getState().signIn(SERVER, 'alice', '')).toBe(true);

    expect(fake.rpc.connect).toHaveBeenCalledWith(SERVER);
    expect(fake.api.connectUser).toHaveBeenCalledWith('alice', '', '');
    expect(useSession.getState()).toMatchObject({ phase: 'signedIn', roomId: 'room-1', userName: 'alice', error: null });
    expect(restoreSaved()).toEqual({ serverUrl: SERVER, userName: 'alice', token: 'token-1' });
    expect(JSON.parse(localStorage.getItem('playmat.login')!)).toEqual({ serverUrl: SERVER, userName: 'alice', passwordless: true, account: false });
  });

  test('sends the saved restore token only to the same server and user', async () => {
    localStorage.setItem('playmat.restore', JSON.stringify({ serverUrl: SERVER, userName: 'alice', token: 'old' }));
    const { useSession, fake } = await load();
    await useSession.getState().signIn(SERVER, 'alice', 'pw');
    expect(fake.api.connectUser).toHaveBeenLastCalledWith('alice', 'pw', 'old');

    await useSession.getState().signOut(true);
    await useSession.getState().signIn(SERVER, 'bob', '');
    expect(fake.api.connectUser).toHaveBeenLastCalledWith('bob', '', '');
  });

  test('a refused login stays signed out with an explanation', async () => {
    const { useSession, fake } = await load();
    fake.api.connectUser.mockResolvedValueOnce(false);
    expect(await useSession.getState().signIn(SERVER, 'alice', 'bad')).toBe(false);
    expect(useSession.getState().phase).toBe('signedOut');
    expect(useSession.getState().error).toMatch(/refused/);
    expect(restoreSaved()).toBeNull();
  });

  test('an older server without restore tokens still signs in', async () => {
    const { useSession, fake } = await load();
    fake.api.sessionGetRestoreToken.mockRejectedValueOnce(new Error('unknown method'));
    expect(await useSession.getState().signIn(SERVER, 'alice', '')).toBe(true);
    expect(restoreSaved()).toBeNull();
  });

  test('a reconnect logs back in with the password and the newest restore token', async () => {
    const { useSession, fake } = await load();
    await useSession.getState().signIn(SERVER, 'alice', 'secret');
    fake.api.sessionGetRestoreToken.mockResolvedValueOnce('token-2');
    fake.api.serverGetMainRoomId.mockResolvedValueOnce('room-2');

    fake.rpc.setStatus('reconnecting');
    expect(useSession.getState()).toMatchObject({ phase: 'signedIn', connection: 'reconnecting' });
    fake.rpc.setStatus('open');
    await flush();

    expect(fake.api.connectUser).toHaveBeenLastCalledWith('alice', 'secret', 'token-1');
    await vi.waitFor(() => expect(useSession.getState().roomId).toBe('room-2'));
    expect(restoreSaved()).toMatchObject({ token: 'token-2' });
  });

  test('a failed reconnect login signs the player out', async () => {
    const { useSession, fake } = await load();
    await useSession.getState().signIn(SERVER, 'alice', '');
    fake.api.connectUser.mockRejectedValueOnce(new Error('session expired'));
    fake.rpc.setStatus('reconnecting');
    fake.rpc.setStatus('open');
    await vi.waitFor(() => expect(useSession.getState().phase).toBe('signedOut'));
    expect(useSession.getState().error).toBe('session expired');
  });

  test('a closed connection signs out with a message', async () => {
    const { useSession, fake } = await load();
    await useSession.getState().signIn(SERVER, 'alice', '');
    fake.rpc.setStatus('closed');
    expect(useSession.getState()).toMatchObject({ phase: 'signedOut', roomId: null, error: 'The connection to the server was lost.' });
  });

  test('signing out for good forgets the restore token; keeping games keeps it', async () => {
    const { useSession, fake } = await load();
    await useSession.getState().signIn(SERVER, 'alice', '');
    await useSession.getState().signOut(true);
    expect(fake.api.disconnectSession).toHaveBeenCalledWith(true);
    expect(restoreSaved()).toMatchObject({ token: 'token-1' });

    await useSession.getState().signIn(SERVER, 'alice', '');
    await useSession.getState().signOut();
    expect(fake.api.disconnectSession).toHaveBeenLastCalledWith(false);
    expect(restoreSaved()).toBeNull();
    expect(JSON.parse(localStorage.getItem('playmat.login')!)).toMatchObject({ passwordless: false });
    expect(useSession.getState()).toMatchObject({ phase: 'signedOut', roomId: null });
  });

  test('resume signs a passwordless player back in, and nobody else', async () => {
    localStorage.setItem('playmat.login', JSON.stringify({ serverUrl: SERVER, userName: 'alice', passwordless: true }));
    let loaded = await load();
    expect(loaded.useSession.getState()).toMatchObject({ serverUrl: SERVER, userName: 'alice' });
    expect(await loaded.useSession.getState().resume()).toBe(true);
    expect(loaded.fake.api.connectUser).toHaveBeenCalledWith('alice', '', '');

    freshModules();
    localStorage.setItem('playmat.login', JSON.stringify({ serverUrl: SERVER, userName: 'alice', passwordless: false }));
    loaded = await load();
    expect(await loaded.useSession.getState().resume()).toBe(false);
    expect(loaded.fake.api.connectUser).not.toHaveBeenCalled();
  });

  test('a failed resume does not show an error on the sign-in screen', async () => {
    localStorage.setItem('playmat.login', JSON.stringify({ serverUrl: SERVER, userName: 'alice', passwordless: true }));
    const { useSession, fake } = await load();
    fake.api.connectUser.mockResolvedValueOnce(false);
    expect(await useSession.getState().resume()).toBe(false);
    expect(useSession.getState().error).toBeNull();
  });
});
