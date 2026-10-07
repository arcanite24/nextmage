import { create } from 'zustand';
import { api, DEFAULT_SERVER_URL, rpc } from '../connection';
import { ConnectionError, RpcError, type ConnectionStatus } from '../../core/rpc/RpcClient';
import { readJson, writeJson } from './persist';

export type SessionPhase = 'signedOut' | 'signingIn' | 'signedIn';

interface RememberedLogin {
  serverUrl: string;
  userName: string;
  /** signed in without a password last time, so a reload can sign in again silently */
  passwordless?: boolean;
}

const LOGIN_KEY = 'playmat.login';
const RESTORE_KEY = 'playmat.restoreId';

export interface SessionState {
  phase: SessionPhase;
  connection: ConnectionStatus;
  serverUrl: string;
  userName: string;
  roomId: string | null;
  error: string | null;
  signIn(serverUrl: string, userName: string, password: string): Promise<boolean>;
  signOut(keepGames?: boolean): Promise<void>;
  /** after a reload: sign the remembered player back in when the server needs no password */
  resume(): Promise<boolean>;
}

/** Stable id that lets the server hand back our tables after a reload or a dropped connection. */
function restoreId(): string {
  let id = readJson<string>(RESTORE_KEY, '');
  if (!id) {
    id = crypto.randomUUID();
    writeJson(RESTORE_KEY, id);
  }
  return id;
}

function describeError(error: unknown): string {
  if (error instanceof ConnectionError) return `Can't reach the server. Check the address and that it is running.`;
  if (error instanceof RpcError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

const remembered = readJson<RememberedLogin | null>(LOGIN_KEY, null);

// kept in memory only, to log back in after a dropped connection
let sessionPassword = '';

export const useSession = create<SessionState>((set, get) => ({
  phase: 'signedOut',
  connection: rpc.getStatus(),
  serverUrl: remembered?.serverUrl ?? DEFAULT_SERVER_URL,
  userName: remembered?.userName ?? '',
  roomId: null,
  error: null,

  async signIn(serverUrl, userName, password) {
    set({ phase: 'signingIn', error: null, serverUrl, userName });
    try {
      if (rpc.getStatus() !== 'open' || rpc.getUrl() !== serverUrl) {
        await rpc.connect(serverUrl);
      }
      const ok = await api.connectUser(userName, password, restoreId());
      if (!ok) {
        set({ phase: 'signedOut', error: 'The server refused the login. Check your name and password.' });
        return false;
      }
      sessionPassword = password;
      const roomId = await api.serverGetMainRoomId();
      writeJson<RememberedLogin>(LOGIN_KEY, { serverUrl, userName, passwordless: !password });
      set({ phase: 'signedIn', roomId });
      return true;
    } catch (error) {
      set({ phase: 'signedOut', error: describeError(error) });
      return false;
    }
  },

  async resume() {
    const login = readJson<RememberedLogin | null>(LOGIN_KEY, null);
    if (!login?.passwordless || get().phase !== 'signedOut') return false;
    const ok = await get().signIn(login.serverUrl, login.userName, '');
    if (!ok) set({ error: null });
    return ok;
  },

  async signOut(keepGames = false) {
    try {
      if (get().phase === 'signedIn') await api.disconnectSession(keepGames);
    } catch {
      // leaving anyway
    }
    sessionPassword = '';
    writeJson<RememberedLogin>(LOGIN_KEY, { serverUrl: get().serverUrl, userName: get().userName, passwordless: false });
    rpc.disconnect();
    set({ phase: 'signedOut', roomId: null });
  },
}));

rpc.onStatus((connection) => {
  useSession.setState({ connection });
  if (connection === 'closed' && useSession.getState().phase === 'signedIn') {
    useSession.setState({ phase: 'signedOut', roomId: null, error: 'The connection to the server was lost.' });
  }
});

// a reconnect opens a fresh server session: log back in with the same restore id to get our tables back
rpc.onStatus((connection) => {
  const state = useSession.getState();
  if (connection !== 'open' || state.phase !== 'signedIn') return;
  api.connectUser(state.userName, sessionPassword, restoreId())
    .then(() => api.serverGetMainRoomId())
    .then((roomId) => useSession.setState({ roomId }))
    .catch((error) => useSession.setState({ phase: 'signedOut', error: describeError(error) }));
});
