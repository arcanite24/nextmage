import { useMemo } from 'react';
import { rosterOf, useDecks } from '../stores/decks';
import { DEFAULT_AI_OPTIONS, usePlay } from '../stores/play';
import { AI_TYPES, DIFFICULTIES, difficultyOf } from './aiSetup';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import styles from './AiSettingsDialog.module.css';

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? styles.segmentOn : styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** How the next game against the AI is set up. Changes apply right away and are remembered in this browser. */
export function AiSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const options = usePlay((state) => state.aiOptions);
  const setOptions = usePlay((state) => state.setAiOptions);
  const decks = useDecks();
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const starters = roster.filter((deck) => deck.starter);
  const mine = roster.filter((deck) => !deck.starter);
  const difficulty = difficultyOf(options.skill);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Playing the AI"
      width="md"
      footer={(
        <>
          <Button variant="quiet" onClick={() => setOptions(DEFAULT_AI_OPTIONS)}>Restore defaults</Button>
          <Button variant="decision" onClick={() => onOpenChange(false)}>Done</Button>
        </>
      )}
    >
      <div className={styles.form}>
        <section className={styles.row}>
          <h3 className={styles.label}>Difficulty</h3>
          <Segmented
            label="Difficulty"
            value={difficulty.skill}
            options={DIFFICULTIES.map((item) => ({ value: item.skill, label: item.label }))}
            onChange={(skill) => setOptions({ skill })}
          />
          <p className={styles.detail}>{difficulty.detail}</p>
        </section>

        <section className={styles.row}>
          <label className={styles.label} htmlFor="ai-deck">Its deck</label>
          <select
            id="ai-deck"
            className={styles.select}
            value={options.opponentDeckId ?? ''}
            onChange={(event) => setOptions({ opponentDeckId: event.target.value || null })}
          >
            <option value="">A random starter deck</option>
            <optgroup label="Starter decks">
              {starters.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
            </optgroup>
            {mine.length > 0 && (
              <optgroup label="Your decks">
                {mine.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </optgroup>
            )}
          </select>
        </section>

        <section className={styles.row}>
          <h3 className={styles.label}>AI</h3>
          <Segmented label="AI" value={options.aiType} options={AI_TYPES.map((item) => ({ value: item.value, label: item.label }))} onChange={(aiType) => setOptions({ aiType })} />
          <p className={styles.detail}>{AI_TYPES.find((item) => item.value === options.aiType)?.detail}</p>
        </section>

        <div className={styles.pair}>
          <section className={styles.row}>
            <h3 className={styles.label}>Match</h3>
            <Segmented
              label="Match length"
              value={options.winsNeeded}
              options={[{ value: 1 as const, label: 'One game' }, { value: 2 as const, label: 'Best of 3' }]}
              onChange={(winsNeeded) => setOptions({ winsNeeded })}
            />
          </section>
          <section className={styles.row}>
            <h3 className={styles.label}>Starting life</h3>
            <Segmented
              label="Starting life"
              value={options.startingLife}
              options={[20, 30, 40].map((life) => ({ value: life as 20 | 30 | 40, label: String(life) }))}
              onChange={(startingLife) => setOptions({ startingLife })}
            />
          </section>
        </div>
      </div>
    </Dialog>
  );
}
