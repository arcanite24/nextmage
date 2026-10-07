import { ChevronDown, Server } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../brand';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Mark } from '../ui/Mark';
import { Stitch } from '../ui/Stitch';
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const session = useSession();
  const navigate = useNavigate();
  const [userName, setUserName] = useState(session.userName);
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(session.serverUrl);
  const [editServer, setEditServer] = useState(false);
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    void session.resume().then((ok) => ok && navigate('/', { replace: true }));
  }, [session, navigate]);
  const busy = session.phase === 'signingIn';
  const nameError = userName.trim() && !/^[A-Za-z0-9_]{3,14}$/.test(userName.trim())
    ? '3 to 14 letters, digits or underscores.'
    : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!userName.trim() || nameError) return;
    if (await session.signIn(serverUrl.trim(), userName.trim(), password)) navigate('/', { replace: true });
  }

  return (
    <div className={styles.mat}>
      <Stitch />
      <section className={styles.welcome}>
        <div className={styles.brand}>
          <Mark size={44} />
          <span>{APP_NAME}</span>
        </div>
        <h1 className={styles.headline}>Every card.<br />Any format.<br />Your table.</h1>
        <p className={styles.lede}>Sign in to an XMage server and play against the AI or your friends.</p>
      </section>

      <form className={styles.zone} onSubmit={submit} aria-labelledby="signin-title">
        <h2 id="signin-title" className={styles.zoneLabel}>Sign in</h2>
        <Field
          label="Player name"
          value={userName}
          autoComplete="username"
          autoFocus={!userName}
          onChange={(event) => setUserName(event.target.value)}
          error={nameError}
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          autoComplete="current-password"
          autoFocus={!!userName}
          onChange={(event) => setPassword(event.target.value)}
          hint="Only for servers that require an account."
        />

        <div className={styles.server}>
          <button type="button" className={styles.serverChip} aria-expanded={editServer} onClick={() => setEditServer((value) => !value)}>
            <Server size={15} aria-hidden="true" />
            <span>{describeServer(serverUrl)}</span>
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

        <Button type="submit" variant="decision" size="lg" busy={busy} disabled={!userName.trim() || !!nameError} className={styles.submit}>
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

function describeServer(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url || 'Choose a server';
  }
}
