import { Bot, Swords, Trophy, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { rosterOf, sleeveFor, useDecks } from '../stores/decks';
import { usePlay } from '../stores/play';
import { Button } from '../ui/Button';
import { DeckBox } from '../ui/DeckBox';
import { MatPrint } from '../ui/MatPrint';
import styles from './HomeScreen.module.css';

type Mode = 'ai' | 'friend' | 'table' | 'event';

const MODES: { id: Mode; label: string; detail: string; icon: typeof Bot }[] = [
  { id: 'ai', label: 'Against the AI', detail: 'Start right away against the server AI.', icon: Bot },
  { id: 'friend', label: 'Against a friend', detail: 'Host a table your friends can join.', icon: Users },
  { id: 'table', label: 'Join a table', detail: 'Browse open games on this server.', icon: Swords },
  { id: 'event', label: 'Events', detail: 'Drafts, sealed and tournaments.', icon: Trophy },
];

/** Home: your deck on your mat, one decision away from a game. */
export function HomeScreen() {
  const navigate = useNavigate();
  const decks = useDecks();
  const play = usePlay();
  const [mode, setMode] = useState<Mode>('ai');
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const selected = roster.find((deck) => deck.id === decks.selectedId) ?? roster[0] ?? null;
  const sleeve = sleeveFor(decks.sleeves, selected);
  const busy = play.phase !== 'idle';

  useEffect(() => {
    if (!decks.loaded) void decks.refresh();
  }, [decks]);

  function start() {
    if (!selected) return;
    switch (mode) {
      case 'ai':
        void play.playVsAi(selected.id);
        break;
      case 'friend':
        navigate('/tables', { state: { host: selected.id } });
        break;
      case 'table':
        navigate('/tables');
        break;
      case 'event':
        navigate('/events');
        break;
    }
  }

  return (
    <div className={styles.home}>
      <aside className={styles.roster} aria-label="Your decks">
        <header className={styles.rosterHead}>
          <h2>Your decks</h2>
          <Button variant="quiet" size="sm" onClick={() => navigate('/decks')}>Manage</Button>
        </header>
        <div className={styles.rosterList} role="list">
          {roster.map((deck) => (
            <div role="listitem" key={deck.id}>
              <DeckBox
                deck={deck}
                sleeve={sleeveFor(decks.sleeves, deck)}
                selected={deck.id === selected?.id}
                onSelect={() => decks.select(deck.id)}
                onActivate={() => {
                  decks.select(deck.id);
                  if (mode === 'ai') void play.playVsAi(deck.id);
                }}
              />
            </div>
          ))}
          {decks.loaded && roster.length === 0 && (
            <p className={styles.empty}>No decks yet. Import one from the Decks page.</p>
          )}
        </div>
      </aside>

      <section className={styles.mat} style={{ '--sleeve': sleeve } as CSSProperties}>
        <MatPrint card={selected?.cover ?? null} />
        <div className={styles.deckTitle}>
          <p className={styles.deckKicker}>{selected?.note ?? ' '}</p>
          <h1 className={styles.deckName}>{selected?.name ?? 'Choose a deck'}</h1>
        </div>

        <div className={styles.playZone} role="group" aria-labelledby="play-zone-label">
          <h2 id="play-zone-label" className={styles.zoneLabel}>Play</h2>
          <div className={styles.modes} role="radiogroup" aria-label="How to play">
            {MODES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === item.id}
                  className={[styles.mode, mode === item.id ? styles.modeOn : ''].join(' ')}
                  onClick={() => setMode(item.id)}
                  disabled={busy}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className={styles.modeLabel}>{item.label}</span>
                  <span className={styles.modeDetail}>{item.detail}</span>
                </button>
              );
            })}
          </div>
          {play.error && <p className={styles.error} role="alert">{play.error}</p>}
          <div className={styles.playRow}>
            {busy && (
              <Button variant="quiet" onClick={() => void play.cancel()}>Cancel</Button>
            )}
            <Button
              variant="decision"
              size="xl"
              busy={busy}
              disabled={!selected}
              onClick={start}
              className={styles.playButton}
            >
              {busy ? (play.phase === 'waitingForGame' ? 'Shuffling' : 'Setting up') : mode === 'ai' ? 'Play' : 'Continue'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
