import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { rosterOf, sleeveFor, useDecks } from '../stores/decks';
import { usePlay } from '../stores/play';
import { useT, type MessageKey } from '../i18n';
import { Button } from '../ui/Button';
import { DeckBox } from '../ui/DeckBox';
import { MatPrint } from '../ui/MatPrint';
import { AiSettingsDialog } from './AiSettingsDialog';
import { useImportDrop, useImportPaste } from '../decks/import/useImportShortcuts';
import { openImport } from '../stores/importSheet';
import { describeAi } from './aiSetup';
import styles from './HomeScreen.module.css';

type Mode = 'ai' | 'friend';

// open tables and events have their own pages in the rail; here the only question is who you play
const MODES: { id: Mode; label: MessageKey }[] = [
  { id: 'ai', label: 'home.mode.ai' },
  { id: 'friend', label: 'home.mode.friend' },
];

/** Home: your deck on your mat, one decision away from a game. */
export function HomeScreen() {
  const navigate = useNavigate();
  const t = useT();
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
      case 'friend':
        navigate('/tables', { state: { host: selected.id } });
        break;
    }
  }

  return (
    <div className={styles.home}>
      <aside className={styles.roster} aria-label={t('home.yourDecks')}>
        <header className={styles.rosterHead}>
          <h2>{t('home.yourDecks')}</h2>
          <span className={styles.rosterActions}>
            <Button variant="quiet" size="sm" onClick={() => openImport()}>{t('home.import')}</Button>
            <Button variant="quiet" size="sm" onClick={() => navigate('/decks')}>{t('home.manage')}</Button>
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
                }}
              />
            </div>
          ))}
          {decks.loaded && roster.length === 0 && (
            <p className={styles.empty}>{t('home.empty')}</p>
          )}
        </div>
      </aside>

      <section className={styles.mat} style={{ '--sleeve': sleeve } as CSSProperties}>
        <MatPrint card={selected?.cover ?? null} />
        <div className={styles.deckTitle}>
          <h1 className={styles.deckName}>{selected?.name ?? t('home.chooseDeck')}</h1>
          <p className={styles.deckNote}>{selected?.note ?? ' '}</p>
        </div>

        <div className={styles.playZone} role="group" aria-labelledby="play-zone-label">
          <h2 id="play-zone-label" className={styles.zoneLabel}>{t('home.play')}</h2>
          <div className={styles.modes} role="radiogroup" aria-label={t('home.opponent')}>
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
                {t(item.label)}
              </button>
            ))}
          </div>
          {mode === 'ai' && (
            <button type="button" className={styles.aiSetup} onClick={() => setAiOpen(true)} disabled={busy}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>{describeAi(t, play.aiOptions, roster.find((deck) => deck.id === play.aiOptions.opponentDeckId)?.name ?? null)}</span>
              <span className={styles.aiSetupAction}>{t('home.change')}</span>
            </button>
          )}
          {mode === 'friend' && <p className={styles.modeNote}>{t('home.friendNote')}</p>}
          {play.error && <p className={styles.error} role="alert">{play.error}</p>}
          <div className={styles.playRow}>
            {busy && (
              <Button variant="quiet" onClick={() => void play.cancel()}>{t('home.cancel')}</Button>
            )}
            <Button
              variant="decision"
              size="xl"
              busy={busy}
              disabled={!selected}
              onClick={start}
              className={styles.playButton}
            >
              {t(busy ? (play.phase === 'waitingForGame' ? 'home.shuffling' : 'home.settingUp') : mode === 'ai' ? 'home.play' : 'home.continue')}
            </Button>
          </div>
        </div>
      </section>
      <AiSettingsDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
