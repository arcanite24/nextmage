// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeConnection, type FakeConnection } from '../../test/fakeConnection';

const SERVER = 'ws://server:17172';

async function load() {
  const { useSession } = await import('./session');
  const social = await import('./social');
  return { useSession, ...social, fake: (await import('../connection')) as unknown as FakeConnection };
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock('../connection', () => createFakeConnection());
  localStorage.clear();
});

describe('social store', () => {
  test('keeps friends and ignored players apart, case-insensitively, and never lists yourself', async () => {
    const { useSession, useSocial, isFriend, isIgnored } = await load();
    useSession.setState({ userName: 'me', serverUrl: SERVER });
    const social = useSocial.getState();
    social.addFriend('Alice');
    social.addFriend('alice');
    social.addFriend('ME');
    expect(useSocial.getState().friends).toEqual(['Alice']);

    useSocial.getState().ignore('ALICE');
    expect(useSocial.getState().friends).toEqual([]);
    expect(isIgnored(useSocial.getState(), 'alice')).toBe(true);

    useSocial.getState().addFriend('alice');
    expect(isFriend(useSocial.getState(), 'Alice')).toBe(true);
    expect(useSocial.getState().ignored).toEqual([]);
  });

  test('remembers the lists per server', async () => {
    const { useSession, useSocial } = await load();
    useSession.setState({ serverUrl: SERVER, userName: 'me' });
    useSocial.getState().ignore('Troll');
    useSession.setState({ serverUrl: 'ws://other:17172' });
    expect(useSocial.getState().ignored).toEqual([]);
    useSession.setState({ serverUrl: SERVER });
    expect(useSocial.getState().ignored).toEqual(['Troll']);
  });

  test('tells the server the ignore list after each login and on every change', async () => {
    const { useSession, useSocial, fake } = await load();
    useSession.setState({ serverUrl: SERVER, userName: 'me' });
    useSocial.getState().ignore('Troll');
    // not signed in yet: nothing to send to
    expect(fake.api.chatSetIgnored).not.toHaveBeenCalled();

    await useSession.getState().signIn(SERVER, 'me', '');
    expect(fake.api.chatSetIgnored).toHaveBeenLastCalledWith(['Troll']);

    useSocial.getState().unignore('troll');
    expect(fake.api.chatSetIgnored).toHaveBeenLastCalledWith([]);
  });
});
