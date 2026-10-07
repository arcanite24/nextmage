import { ChevronDown, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../brand';
import { api, rpc } from '../connection';
import type { StarterDeck } from '../stores/decks';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Field } from '../ui/Field';
import { Mark } from '../ui/Mark';
import { MatPrint } from '../ui/MatPrint';
import styles from './LoginScreen.module.css';

type ServerStatus = 'checking' | 'online' | 'offline';

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
  const status = useServerStatus(serverUrl);
  const art = useRotatingArt();
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    void session.resume().then((ok) => ok && navigate(destination, { replace: true }));
  }, [session, navigate, destination]);

  const busy = session.phase === 'signingIn' || dealing;
  const name = userName.trim();
  const nameError = name && !/^[A-Za-z0-9_]{3,14}$/.test(name) ? '3 to 14 letters, digits or underscores.' : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name || nameError) return;
    if (await session.signIn(serverUrl.trim(), name, password)) {
      // the deck is dealt across the table, then Play takes over
      setDealing(true);
      setTimeout(() => navigate(destination, { replace: true }), DEAL_MS);
    } else {
      setRefused((count) => count + 1);
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
        <h2 id="seat-title" className={styles.seatLabel}>Take a seat</h2>

        <SeatPlate name={name && !nameError ? name : ''} />

        <Field
          label="Player name"
          value={userName}
          autoComplete="username"
          autoFocus
          maxLength={14}
          onChange={(event) => setUserName(event.target.value)}
          error={nameError}
          required
        />

        {needsPassword ? (
          <Field
            label="Password"
            type="password"
            value={password}
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
        ) : (
          <button type="button" className={styles.linkButton} onClick={() => setNeedsPassword(true)}>
            <KeyRound size={15} aria-hidden="true" /> This server needs a password
          </button>
        )}

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

        {session.error && <p className={styles.error} role="alert">{session.error}</p>}

        <Button type="submit" variant="decision" size="xl" busy={busy} disabled={!name || !!nameError} className={styles.submit}>
          {busy ? 'Shuffling up' : 'Sit down'}
        </Button>
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

/** A sleeved deck by the seat: it riffles now and then, and deals itself across the table on sign-in. */
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

/** Whether the server answers, checked on load and when the address changes (the connection is kept for sign-in). */
function useServerStatus(url: string): ServerStatus {
  const [result, setResult] = useState<{ url: string; status: ServerStatus } | null>(null);
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
        if (!cancelled) setResult({ url, status: 'online' });
      } catch {
        if (!cancelled) setResult({ url, status: 'offline' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);
  return result?.url === url ? result.status : 'checking';
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
