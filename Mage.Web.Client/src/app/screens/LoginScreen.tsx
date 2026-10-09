import { ArrowLeft, ChevronDown, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../brand';
import { api, rpc } from '../connection';
import type { ServerInfo } from '../../protocol/generated/views';
import type { StarterDeck } from '../stores/decks';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Field } from '../ui/Field';
import { Mark } from '../ui/Mark';
import { MatPrint } from '../ui/MatPrint';
import { checkPassword } from './accountRules';
import styles from './LoginScreen.module.css';

type ServerStatus = 'checking' | 'online' | 'offline';
type Mode = 'sit' | 'register' | 'forgot' | 'reset';

const MODE_TITLES: Record<Mode | 'signIn', string> = {
  sit: 'Take a seat',
  signIn: 'Sign in',
  register: 'Create an account',
  forgot: 'Reset your password',
  reset: 'Reset your password',
};

const DEAL_MS = 700;
const ART_EVERY_MS = 9000;

/**
 * Sitting down at the table: the mat sews its edge in, the name is printed in register, and the player takes a seat
 * with nothing more than a name. Signing in deals the deck across the table on the way to Play.
 */
export function LoginScreen() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // game links go stale across sign-ins; anything else is worth returning to
  const destination = from && !from.startsWith('/game/') && from !== '/login' ? from : '/';
  const [userName, setUserName] = useState(session.userName);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState(session.serverUrl);
  const [editServer, setEditServer] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [refused, setRefused] = useState(0);
  const [mode, setMode] = useState<Mode>('sit');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const { status, info } = useServerStatus(serverUrl);
  const art = useRotatingArt();
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    void session.resume().then((ok) => ok && navigate(destination, { replace: true }));
  }, [session, navigate, destination]);

  const accounts = !!info?.accounts;
  const busy = session.phase === 'signingIn' || dealing;
  const name = userName.trim();
  const nameError = name && !/^[A-Za-z0-9_]{3,14}$/.test(name) ? '3 to 14 letters, digits or underscores.' : null;
  const minPassword = info?.minPasswordLength || 8;
  const passwordRule = `At least ${minPassword} characters, with a letter and a digit.`;
  const passwordError = password && (mode === 'register' || mode === 'reset') ? checkPassword(password, minPassword, name) : null;
  const canSubmit = mode === 'sit' ? !!name && !nameError && (!accounts || !!password)
    : mode === 'register' ? !!name && !nameError && !!email.trim() && !!password && !passwordError
      : mode === 'forgot' ? !!email.trim()
        : code.length === 6 && !!password && !passwordError;
  const submitLabel = mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Email me a code' : mode === 'reset' ? 'Set the password'
    : busy ? 'Shuffling up' : accounts ? 'Sign in' : 'Sit down';

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
    setPassword('');
    useSession.setState({ error: null });
  }

  function seated() {
    // the deck is dealt across the table, then Play takes over
    setDealing(true);
    setTimeout(() => navigate(destination, { replace: true }), DEAL_MS);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const url = serverUrl.trim();
    if (mode === 'sit') {
      if (await session.signIn(url, name, password)) seated();
      else setRefused((count) => count + 1);
      return;
    }
    setWorking(true);
    try {
      if (mode === 'register') {
        if (await session.register(url, name, email.trim(), password)) seated();
        else setRefused((count) => count + 1);
      } else if (mode === 'forgot') {
        if (await session.requestPasswordReset(url, email.trim())) {
          setMode('reset');
          setCode('');
          setNotice(`If ${email.trim()} belongs to an account, a code is on its way. Check your spam folder too.`);
        }
      } else if (await session.resetPassword(url, email.trim(), code, password)) {
        switchMode('sit');
        setNotice('Your password is changed. Sign in with it.');
      } else {
        setRefused((count) => count + 1);
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={[styles.mat, dealing ? styles.leaving : ''].join(' ')}>
      <div className={styles.art} aria-hidden="true">
        <MatPrint key={art ? `${art.setCode}:${art.cardNumber}` : 'none'} card={art} />
      </div>
      <SewnEdge />

      <header className={styles.brand}>
        <span className={styles.mark}><Mark size={112} /></span>
        <h1 className={styles.wordmark} aria-label={APP_NAME}>
          {/* three separations of a screen print sliding into register */}
          <span className={styles.passShadow} aria-hidden="true">{APP_NAME}</span>
          <span className={styles.passLight} aria-hidden="true">{APP_NAME}</span>
          <span className={styles.passKey} aria-hidden="true">{APP_NAME}</span>
        </h1>
      </header>

      <form key={refused} className={[styles.seat, refused > 0 ? styles.refused : ''].join(' ')} onSubmit={submit} aria-labelledby="seat-title">
        <h2 id="seat-title" className={styles.seatLabel}>{MODE_TITLES[mode === 'sit' && accounts ? 'signIn' : mode]}</h2>

        {(mode === 'sit' || mode === 'register') && (
          <>
            <SeatPlate name={name && !nameError ? name : ''} />
            <Field
              label={accounts ? 'Account name' : 'Player name'}
              value={userName}
              autoComplete="username"
              autoFocus
              maxLength={14}
              onChange={(event) => setUserName(event.target.value)}
              error={nameError}
              required
            />
          </>
        )}

        {(mode === 'register' || mode === 'forgot' || mode === 'reset') && (
          <Field
            label="Email"
            type="email"
            value={email}
            autoComplete="email"
            autoFocus={mode === 'forgot'}
            onChange={(event) => setEmail(event.target.value)}
            hint={mode === 'register' ? 'For password resets only.' : undefined}
            required
            readOnly={mode === 'reset'}
          />
        )}

        {mode === 'reset' && (
          <Field
            label="Code from the email"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            hint={`Six digits. It works for 30 minutes and five tries.`}
            required
          />
        )}

        {mode === 'sit' && (accounts || needsPassword) && (
          <Field
            label="Password"
            type="password"
            value={password}
            autoComplete="current-password"
            autoFocus={needsPassword && !accounts}
            onChange={(event) => setPassword(event.target.value)}
            required={accounts}
          />
        )}
        {(mode === 'register' || mode === 'reset') && (
          <Field
            label={mode === 'reset' ? 'New password' : 'Password'}
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            hint={passwordRule}
            error={passwordError}
            required
          />
        )}

        {mode === 'sit' && !accounts && !needsPassword && (
          <button type="button" className={styles.linkButton} onClick={() => setNeedsPassword(true)}>
            <KeyRound size={15} aria-hidden="true" /> This server needs a password
          </button>
        )}

        {mode === 'sit' && (
          <div className={styles.server}>
            <button type="button" className={styles.serverChip} aria-expanded={editServer} onClick={() => setEditServer((value) => !value)}>
              <span className={[styles.dot, styles[status]].join(' ')} aria-hidden="true" />
              <span>{describeServer(serverUrl)}</span>
              <span className={styles.statusText}>{status === 'online' ? 'Online' : status === 'offline' ? "Can't reach" : 'Checking'}</span>
              <ChevronDown size={15} aria-hidden="true" className={editServer ? styles.flipped : ''} />
            </button>
            {editServer && (
              <Field
                label="Server address"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                hint="For example ws://localhost:17172 or wss://play.example.com"
                spellCheck={false}
              />
            )}
          </div>
        )}

        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {session.error && <p className={styles.error} role="alert">{session.error}</p>}

        <Button type="submit" variant="decision" size="xl" busy={busy || working} disabled={!canSubmit} className={styles.submit}>
          {submitLabel}
        </Button>

        {mode === 'sit' && accounts && (
          <div className={styles.accountLinks}>
            <button type="button" className={styles.linkButton} onClick={() => switchMode('register')}>Create an account</button>
            {info?.mail
              ? <button type="button" className={styles.linkButton} onClick={() => switchMode('forgot')}>Forgot your password?</button>
              : <span className={styles.quiet}>Forgot your password? Ask the server's admin.</span>}
          </div>
        )}
        {mode !== 'sit' && (
          <button type="button" className={styles.linkButton} onClick={() => switchMode('sit')}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
          </button>
        )}
        <Link to="/about" className={styles.about}>About and credits</Link>
      </form>

      <Deck dealing={dealing} />
    </div>
  );
}

/** How you'll appear at the table, printed as you type. */
function SeatPlate({ name }: { name: string }) {
  return (
    <div className={[styles.plate, name ? styles.plateOn : ''].join(' ')} aria-hidden="true">
      <span key={name.slice(0, 1)} className={styles.avatar}>{name ? name.slice(0, 1).toUpperCase() : '?'}</span>
      <span className={styles.plateText}>
        <span className={styles.plateName}>{name || 'Your name'}</span>
        <span className={styles.plateLife}>20</span>
      </span>
    </div>
  );
}

/** The stitched edge, sewn around the mat when the page opens. */
function SewnEdge() {
  return (
    <svg className={styles.edge} aria-hidden="true" preserveAspectRatio="none">
      <rect className={styles.groove} x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx="18" ry="18" />
      <rect className={styles.thread} x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx="18" ry="18" />
    </svg>
  );
}

const DECK_SIZE = 7;

/** A sleeved deck set down by the seat; it deals itself across the table on sign-in. */
function Deck({ dealing }: { dealing: boolean }) {
  return (
    <div className={[styles.deck, dealing ? styles.dealing : ''].join(' ')} aria-hidden="true">
      {Array.from({ length: DECK_SIZE }, (_, index) => (
        <div
          key={index}
          className={styles.deckCard}
          style={{
            ['--i' as string]: index,
            ['--angle' as string]: `${(index - (DECK_SIZE - 1) / 2) * 14}deg`,
          } as CSSProperties}
        >
          <CardFace card={{}} hidden sleeve="#3b1f2b" size="small" />
        </div>
      ))}
    </div>
  );
}

function describeServer(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || 'Choose a server';
  }
}

/**
 * Whether the server answers, and whether it has accounts; checked on load and when the address changes (the connection
 * is kept for sign-in).
 */
function useServerStatus(url: string): { status: ServerStatus; info: ServerInfo | null } {
  const [result, setResult] = useState<{ url: string; status: ServerStatus; info: ServerInfo | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // a sign-in (or a resumed session) may already be opening this connection: wait for it instead
        for (let waited = 0; rpc.getStatus() === 'connecting' && rpc.getUrl() === url && waited < 5000; waited += 150) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        if (rpc.getStatus() !== 'open' || rpc.getUrl() !== url) await rpc.connect(url);
        await api.getServerState();
        // older servers don't know serverInfo: they have no accounts as far as the web client is concerned
        const info = await api.serverInfo().catch(() => null);
        if (!cancelled) setResult({ url, status: 'online', info });
      } catch {
        if (!cancelled) setResult({ url, status: 'offline', info: null });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);
  return result?.url === url ? { status: result.status, info: result.info } : { status: 'checking', info: null };
}

/** Art printed into the mat, changing every few seconds: the starter decks' covers. */
function useRotatingArt() {
  const [covers, setCovers] = useState<StarterDeck['cover'][]>([]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/starter-decks/index.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((starters: StarterDeck[]) => {
        if (!cancelled) setCovers(starters.map((starter) => starter.cover).sort(() => Math.random() - 0.5));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (covers.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((value) => value + 1), ART_EVERY_MS);
    return () => clearInterval(timer);
  }, [covers.length]);
  return covers.length ? covers[index % covers.length] : null;
}
