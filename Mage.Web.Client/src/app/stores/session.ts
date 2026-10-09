import { create } from 'zustand';
import { api, DEFAULT_SERVER_URL, rpc } from '../connection';
import { ConnectionError, RpcError, type ConnectionStatus } from '../../core/rpc/RpcClient';
import { forgetOpenGames } from './openGames';
import { readJson, writeJson } from './persist';

export type SessionPhase = 'signedOut' | 'signingIn' | 'signedIn';

interface RememberedLogin {
  serverUrl: string;
  userName: string;
  /** signed in without a password last time, so a reload can sign in again silently */
  passwordless?: boolean;
  /** signed in to an account: a reload signs back in with the restore token while the server still holds the user */
  account?: boolean;
}

const LOGIN_KEY = 'playmat.login';
const RESTORE_KEY = 'playmat.restore';

/** Server-issued token that hands our user (and its tables) back to a later connection. */
interface RememberedRestore {
  serverUrl: string;
  userName: string;
  token: string;
}

export interface SessionState {
  phase: SessionPhase;
  connection: ConnectionStatus;
  serverUrl: string;
  userName: string;
  roomId: string | null;
  /** counts logins, including the silent one after a dropped connection: the server has just handed our games back */
  loginCount: number;
  error: string | null;
  signIn(serverUrl: string, userName: string, password: string): Promise<boolean>;
  /** creates an account with the chosen password and signs in with it */
  register(serverUrl: string, userName: string, email: string, password: string): Promise<boolean>;
  /** emails a reset code to the account with this address (the server doesn't say whether there is one) */
  requestPasswordReset(serverUrl: string, email: string): Promise<boolean>;
  resetPassword(serverUrl: string, email: string, code: string, password: string): Promise<boolean>;
  signOut(keepGames?: boolean): Promise<void>;
  /** after a reload: sign the remembered player back in when the server needs no password */
  resume(): Promise<boolean>;
}

/** The restore token the server gave this player on this server, '' when there is none. */
function restoreToken(serverUrl: string, userName: string): string {
  const saved = readJson<RememberedRestore | null>(RESTORE_KEY, null);
  return saved && saved.serverUrl === serverUrl && saved.userName === userName ? saved.token : '';
}

/** The token changes with every login, so ask for the new one each time. */
async function rememberRestoreToken(serverUrl: string, userName: string): Promise<void> {
  try {
    const token = await api.sessionGetRestoreToken();
    writeJson<RememberedRestore | null>(RESTORE_KEY, token ? { serverUrl, userName, token } : null);
  } catch {
    // older server without restore tokens: reconnects fall back to the server's same-address rule
  }
}

function describeError(error: unknown): string {
  if (error instanceof ConnectionError) {
    return globalThis.navigator?.onLine !== false
      ? `Can't reach the server. Check the address and that it is running.`
      : `You're offline. Connect to the internet to sit down at the table.`;
  }
  if (error instanceof RpcError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

const remembered = readJson<RememberedLogin | null>(LOGIN_KEY, null);

async function connectTo(serverUrl: string): Promise<void> {
  if (rpc.getStatus() !== 'open' || rpc.getUrl() !== serverUrl) {
    await rpc.connect(serverUrl);
  }
}

// kept in memory only, to log back in after a dropped connection
let sessionPassword = '';

export const useSession = create<SessionState>((set, get) => ({
  phase: 'signedOut',
  connection: rpc.getStatus(),
  serverUrl: remembered?.serverUrl ?? DEFAULT_SERVER_URL,
  userName: remembered?.userName ?? '',
  roomId: null,
  loginCount: 0,
  error: null,

  async signIn(serverUrl, userName, password) {
    set({ phase: 'signingIn', error: null, serverUrl, userName });
    try {
      await connectTo(serverUrl);
      const ok = await api.connectUser(userName, password, restoreToken(serverUrl, userName));
      if (!ok) {
        set({ phase: 'signedOut', error: 'The server refused the login. Check your name and password.' });
        return false;
      }
      sessionPassword = password;
      await rememberRestoreToken(serverUrl, userName);
      const roomId = await api.serverGetMainRoomId();
      // an account signed back in with the restore token stays an account
      const before = readJson<RememberedLogin | null>(LOGIN_KEY, null);
      const account = !!password || (!!before?.account && before.serverUrl === serverUrl && before.userName === userName);
      writeJson<RememberedLogin>(LOGIN_KEY, { serverUrl, userName, passwordless: !password && !account, account });
      set((state) => ({ phase: 'signedIn', roomId, loginCount: state.loginCount + 1 }));
      return true;
    } catch (error) {
      set({ phase: 'signedOut', error: describeError(error) });
      return false;
    }
  },

  async resume() {
    const login = readJson<RememberedLogin | null>(LOGIN_KEY, null);
    if (!login || get().phase !== 'signedOut') return false;
    // an account needs its password again unless the server still holds the user for our restore token
    if (!login.passwordless && !(login.account && restoreToken(login.serverUrl, login.userName))) return false;
    const ok = await get().signIn(login.serverUrl, login.userName, '');
    if (!ok) set({ error: null });
    return ok;
  },

  async register(serverUrl, userName, email, password) {
    set({ phase: 'signingIn', error: null, serverUrl, userName });
    try {
      await connectTo(serverUrl);
      await api.authRegister(userName, password, email);
    } catch (error) {
      set({ phase: 'signedOut', error: describeError(error) });
      return false;
    }
    set({ phase: 'signedOut' });
    return get().signIn(serverUrl, userName, password);
  },

  async requestPasswordReset(serverUrl, email) {
    set({ error: null, serverUrl });
    try {
      await connectTo(serverUrl);
      await api.authSendTokenToEmail(email);
      return true;
    } catch (error) {
      set({ error: describeError(error) });
      return false;
    }
  },

  async resetPassword(serverUrl, email, code, password) {
    set({ error: null, serverUrl });
    try {
      await connectTo(serverUrl);
      await api.authResetPassword(email, code, password);
      return true;
    } catch (error) {
      set({ error: describeError(error) });
      return false;
    }
  },

  async signOut(keepGames = false) {
    try {
      if (get().phase === 'signedIn') await api.disconnectSession(keepGames);
    } catch {
      // leaving anyway
    }
    sessionPassword = '';
    // leaving for good gives the tables up, so the token (and the games to rejoin) are of no use any more
    if (!keepGames) {
      writeJson<RememberedRestore | null>(RESTORE_KEY, null);
      forgetOpenGames(get().serverUrl, get().userName);
    }
    writeJson<RememberedLogin>(LOGIN_KEY, { serverUrl: get().serverUrl, userName: get().userName, passwordless: false, account: false });
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

// a reconnect opens a fresh server session: log back in with the restore token to get our tables back
rpc.onStatus((connection) => {
  const state = useSession.getState();
  if (connection !== 'open' || state.phase !== 'signedIn') return;
  api.connectUser(state.userName, sessionPassword, restoreToken(state.serverUrl, state.userName))
    .then(() => rememberRestoreToken(state.serverUrl, state.userName))
    .then(() => api.serverGetMainRoomId())
    .then((roomId) => useSession.setState((current) => ({ roomId, loginCount: current.loginCount + 1 })))
    .catch((error) => useSession.setState({ phase: 'signedOut', error: describeError(error) }));
});
