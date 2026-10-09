import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { rosterOf, sleeveFor, useDecks } from '../stores/decks';
import { usePlay } from '../stores/play';
import { Button } from '../ui/Button';
import { DeckBox } from '../ui/DeckBox';
import { MatPrint } from '../ui/MatPrint';
import { AiSettingsDialog } from './AiSettingsDialog';
import { useImportDrop, useImportPaste } from '../decks/import/useImportShortcuts';
import { openImport } from '../stores/importSheet';
import { describeAi } from './aiSetup';
import styles from './HomeScreen.module.css';

type Mode = 'ai' | 'practice' | 'friend';

// open tables and events have their own pages in the rail; here the only question is who you play
const MODES: { id: Mode; label: string }[] = [
  { id: 'ai', label: 'The AI' },
  { id: 'practice', label: 'Practice' },
  { id: 'friend', label: 'A friend' },
];

/** Home: your deck on your mat, one decision away from a game. */
export function HomeScreen() {
  const navigate = useNavigate();
  const decks = useDecks();
  const play = usePlay();
  const [mode, setMode] = useState<Mode>('ai');
  const [aiOpen, setAiOpen] = useState(false);
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const selected = roster.find((deck) => deck.id === decks.selectedId) ?? roster[0] ?? null;
  const sleeve = sleeveFor(decks.sleeves, selected);
  const busy = play.phase !== 'idle';
  const { dragging, dropProps } = useImportDrop();
  useImportPaste();

  useEffect(() => {
    if (!decks.loaded) void decks.refresh();
  }, [decks]);

  function start() {
    if (!selected) return;
    switch (mode) {
      case 'ai':
        void play.playVsAi(selected.id);
        break;
      case 'practice':
        void play.playVsAi(selected.id, { practice: true });
        break;
      case 'friend':
        navigate('/tables', { state: { host: selected.id } });
        break;
    }
  }

  return (
    <div className={styles.home}>
      <aside className={styles.roster} aria-label="Your decks">
        <header className={styles.rosterHead}>
          <h2>Your decks</h2>
          <span className={styles.rosterActions}>
            <Button variant="quiet" size="sm" onClick={() => openImport()}>Import</Button>
            <Button variant="quiet" size="sm" onClick={() => navigate('/decks')}>Manage</Button>
          </span>
        </header>
        <div className={[styles.rosterList, dragging ? styles.dropping : ''].join(' ')} role="list" {...dropProps}>
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
                  if (mode === 'practice') void play.playVsAi(deck.id, { practice: true });
                }}
              />
            </div>
          ))}
          {decks.loaded && roster.length === 0 && (
            <p className={styles.empty}>No decks yet. Paste a deck link or list here, or choose Import.</p>
          )}
        </div>
      </aside>

      <section className={styles.mat} style={{ '--sleeve': sleeve } as CSSProperties}>
        <MatPrint card={selected?.cover ?? null} />
        <div className={styles.deckTitle}>
          <h1 className={styles.deckName}>{selected?.name ?? 'Choose a deck'}</h1>
          <p className={styles.deckNote}>{selected?.note ?? ' '}</p>
        </div>

        <div className={styles.playZone} role="group" aria-labelledby="play-zone-label">
          <h2 id="play-zone-label" className={styles.zoneLabel}>Play</h2>
          <div className={styles.modes} role="radiogroup" aria-label="Opponent">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                className={[styles.mode, mode === item.id ? styles.modeOn : ''].join(' ')}
                onClick={() => setMode(item.id)}
                disabled={busy}
              >
                {item.label}
              </button>
            ))}
          </div>
          {mode === 'ai' && (
            <button type="button" className={styles.aiSetup} onClick={() => setAiOpen(true)} disabled={busy}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>{describeAi(play.aiOptions, roster.find((deck) => deck.id === play.aiOptions.opponentDeckId)?.name ?? null)}</span>
              <span className={styles.aiSetupAction}>Change</span>
            </button>
          )}
          {mode === 'practice' && (
            <p className={styles.modeNote}>
              Goldfish: an opponent that only plays lands. In the game, Practice tools put any card in your hand or on
              the battlefield, draw, untap and set your life.
            </p>
          )}
          {mode === 'friend' && <p className={styles.modeNote}>You host a table with this deck; your friend joins it from Tables.</p>}
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
              {busy ? (play.phase === 'waitingForGame' ? 'Shuffling' : 'Setting up') : mode === 'friend' ? 'Continue' : 'Play'}
            </Button>
          </div>
        </div>
      </section>
      <AiSettingsDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
