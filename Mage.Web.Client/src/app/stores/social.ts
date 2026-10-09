import { create } from 'zustand';
import { api } from '../connection';
import { readJson, writeJson } from './persist';
import { useSession } from './session';

/**
 * Friends and ignored players, kept in this browser per server (names are only unique per server). The server learns
 * the ignore list after every login, to hold back ignored players' chat and whispers; tables this player hosts keep
 * ignored players out.
 */
interface SocialLists {
  friends: string[];
  ignored: string[];
}

const SOCIAL_KEY = 'playmat.social';
export const MAX_IGNORED = 500;

interface SocialState extends SocialLists {
  serverUrl: string;
  addFriend(name: string): void;
  removeFriend(name: string): void;
  ignore(name: string): void;
  unignore(name: string): void;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const without = (list: readonly string[], name: string) => list.filter((item) => !same(item, name));
const includes = (list: readonly string[], name: string) => list.some((item) => same(item, name));

export function isIgnored(state: SocialLists, name: string | null | undefined): boolean {
  return !!name && includes(state.ignored, name);
}

export function isFriend(state: SocialLists, name: string | null | undefined): boolean {
  return !!name && includes(state.friends, name);
}

function load(serverUrl: string): SocialLists {
  const saved = readJson<Record<string, Partial<SocialLists>>>(SOCIAL_KEY, {})[serverUrl];
  return { friends: saved?.friends ?? [], ignored: saved?.ignored ?? [] };
}

function save(serverUrl: string, lists: SocialLists): void {
  const all = readJson<Record<string, SocialLists>>(SOCIAL_KEY, {});
  all[serverUrl] = lists;
  writeJson(SOCIAL_KEY, all);
}

function syncIgnored(ignored: string[]): void {
  if (useSession.getState().phase !== 'signedIn') return;
  // an older server without the call just keeps sending everything; the client still hides it
  api.chatSetIgnored(ignored).catch(() => undefined);
}

export const useSocial = create<SocialState>((set, get) => {
  const change = (next: Partial<SocialLists>) => {
    const lists = { friends: next.friends ?? get().friends, ignored: next.ignored ?? get().ignored };
    save(get().serverUrl, lists);
    set(lists);
    if (next.ignored) syncIgnored(lists.ignored);
  };
  const myName = () => useSession.getState().userName;
  const initialServer = useSession.getState().serverUrl;
  return {
    serverUrl: initialServer,
    ...load(initialServer),

    addFriend(name) {
      const trimmed = name.trim();
      if (!trimmed || same(trimmed, myName()) || isFriend(get(), trimmed)) return;
      change({ friends: [...get().friends, trimmed], ignored: isIgnored(get(), trimmed) ? without(get().ignored, trimmed) : undefined });
    },
    removeFriend(name) {
      if (isFriend(get(), name)) change({ friends: without(get().friends, name) });
    },
    ignore(name) {
      const trimmed = name.trim();
      if (!trimmed || same(trimmed, myName()) || isIgnored(get(), trimmed)) return;
      change({ ignored: [...get().ignored, trimmed].slice(-MAX_IGNORED), friends: isFriend(get(), trimmed) ? without(get().friends, trimmed) : undefined });
    },
    unignore(name) {
      if (isIgnored(get(), name)) change({ ignored: without(get().ignored, name) });
    },
  };
});

useSession.subscribe((state, previous) => {
  if (state.serverUrl !== useSocial.getState().serverUrl) {
    useSocial.setState({ serverUrl: state.serverUrl, ...load(state.serverUrl) });
  }
  // the server forgets the list with the session: send it after every login
  if (state.phase === 'signedIn' && state.loginCount !== previous.loginCount) {
    syncIgnored(useSocial.getState().ignored);
  }
});
