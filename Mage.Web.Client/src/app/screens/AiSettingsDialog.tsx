import { useMemo } from 'react';
import { isCommanderFormat } from '../../core/decks/formats';
import { rosterOf, useDecks } from '../stores/decks';
import { useT } from '../i18n';
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
  const t = useT();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ai.title')}
      width="md"
      footer={(
        <>
          <Button variant="quiet" onClick={() => setOptions(DEFAULT_AI_OPTIONS)}>{t('ai.restore')}</Button>
          <Button variant="print" onClick={() => onOpenChange(false)}>{t('ai.done')}</Button>
        </>
      )}
    >
      <div className={styles.form}>
        <section className={styles.row}>
          <h3 className={styles.label}>{t('ai.difficulty')}</h3>
          <Segmented
            label={t('ai.difficulty')}
            value={difficulty.skill}
            options={DIFFICULTIES.map((item) => ({ value: item.skill, label: t(item.label) }))}
            onChange={(skill) => setOptions({ skill })}
          />
          <p className={styles.detail}>{t(difficulty.detail)}</p>
        </section>

        <section className={styles.row}>
          <label className={styles.label} htmlFor="ai-deck">{t('ai.deck')}</label>
          <select
            id="ai-deck"
            className={styles.select}
            value={options.opponentDeckId ?? ''}
            onChange={(event) => setOptions({ opponentDeckId: event.target.value || null })}
          >
            <option value="">{t('ai.deck.random')}</option>
            <optgroup label={t('ai.deck.starters')}>
              {starters.filter((deck) => !isCommanderFormat(deck.starter?.format)).map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
            </optgroup>
            {starters.some((deck) => isCommanderFormat(deck.starter?.format)) && (
              <optgroup label={t('ai.deck.commanderStarters')}>
                {starters.filter((deck) => isCommanderFormat(deck.starter?.format)).map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </optgroup>
            )}
            {mine.length > 0 && (
              <optgroup label={t('ai.deck.yours')}>
                {mine.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </optgroup>
            )}
          </select>
        </section>

        <section className={styles.row}>
          <h3 className={styles.label}>{t('ai.type')}</h3>
          <Segmented label={t('ai.type')} value={options.aiType} options={AI_TYPES.map((item) => ({ value: item.value, label: t(item.label) }))} onChange={(aiType) => setOptions({ aiType })} />
          <p className={styles.detail}>{t(AI_TYPES.find((item) => item.value === options.aiType)?.detail ?? 'ai.type.standard.detail')}</p>
        </section>

        <div className={styles.pair}>
          <section className={styles.row}>
            <h3 className={styles.label}>{t('ai.match')}</h3>
            <Segmented
              label={t('ai.match.length')}
              value={options.winsNeeded}
              options={[{ value: 1 as const, label: t('ai.match.one') }, { value: 2 as const, label: t('ai.match.three') }]}
              onChange={(winsNeeded) => setOptions({ winsNeeded })}
            />
          </section>
          <section className={styles.row}>
            <h3 className={styles.label}>{t('ai.life')}</h3>
            <Segmented
              label={t('ai.life')}
              value={options.startingLife ?? 0}
              options={[{ value: 0, label: t('ai.life.format') }, ...[20, 30, 40].map((life) => ({ value: life, label: String(life) }))]}
              onChange={(life) => setOptions({ startingLife: life === 0 ? null : (life as 20 | 30 | 40) })}
            />
          </section>
        </div>

        <section className={styles.row}>
          <h3 className={styles.label}>{t('ai.rules')}</h3>
          <Segmented
            label={t('ai.rules')}
            value={options.rules}
            options={[{ value: 'casual' as const, label: t('ai.rules.casual') }, { value: 'deck' as const, label: t('ai.rules.deck') }]}
            onChange={(rules) => setOptions({ rules })}
          />
          <p className={styles.detail}>
            {t(options.rules === 'casual' ? 'ai.rules.casual.detail' : 'ai.rules.deck.detail')}
          </p>
        </section>

        <section className={styles.row}>
          <h3 className={styles.label}>{t('ai.pod')}</h3>
          <Segmented
            label={t('ai.pod.label')}
            value={options.opponents}
            options={[{ value: 1 as const, label: t('ai.pod.one') }, { value: 2 as const, label: t('ai.pod.three') }, { value: 3 as const, label: t('ai.pod.four') }]}
            onChange={(opponents) => setOptions({ opponents })}
          />
          <p className={styles.detail}>{t('ai.pod.detail')}</p>
        </section>
      </div>
    </Dialog>
  );
}
