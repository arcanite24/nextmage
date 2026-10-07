import { useEffect, useMemo, useState } from 'react';
import type { Command, Interaction } from '../../core/game/interaction';
import type { Prompt } from '../../core/game/prompt';
import { stripMarkup } from '../../core/game/prompt';
import type { CardView, GameEndView } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { PromptText } from '../ui/PromptText';
import styles from './Overlays.module.css';

/** Opening hand, shown large: keep it or mulligan. */
export function MulliganOverlay({ hand, interaction, sleeve, onCommand }: {
  hand: CardView[];
  interaction: Interaction;
  sleeve: string;
  onCommand(command: Command): void;
}) {
  const prompt = interaction.prompt;
  if (!prompt || prompt.kind !== 'ask') return null;
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="mulligan-title">
      <div className={styles.center}>
        <h2 id="mulligan-title" className={styles.bigTitle}>Opening hand</h2>
        <p className={styles.subtitle}>{prompt.text}</p>
        <div className={styles.handRow}>
          {hand.map((card) => (
            <div key={card.id} className={styles.handCard}>
              <CardFace card={card} sleeve={sleeve} size="normal" />
            </div>
          ))}
        </div>
        <div className={styles.buttons}>
          <Button variant="print" size="lg" onClick={() => onCommand({ type: 'boolean', value: true })}>{prompt.yesLabel}</Button>
          <Button variant="decision" size="xl" onClick={() => onCommand({ type: 'boolean', value: false })} autoFocus>{prompt.noLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Choose among cards: off-board cards (library search, revealed cards) or the hand during a London mulligan.
 * Each click toggles a card; the server answers with the updated choice.
 */
export function CardPicker({ title, cards, interaction, sleeve, onCommand }: {
  title: string;
  cards: CardView[];
  interaction: Interaction;
  sleeve: string;
  onCommand(command: Command): void;
}) {
  const [hidden, setHidden] = useState(false);
  const main = interaction.mainButton;
  if (hidden) {
    return (
      <div className={styles.peek}>
        <Button variant="decision" onClick={() => setHidden(false)}>Back to choice</Button>
      </div>
    );
  }
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.panel}>
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{title}</h2>
          <Button variant="quiet" size="sm" onClick={() => setHidden(true)}>See the board</Button>
        </header>
        <p className={styles.panelText}><PromptText text={interaction.headline} /></p>
        <div className={styles.grid}>
          {cards.map((card) => {
            const id = card.id!;
            const clickable = interaction.clickable.has(id);
            const selected = interaction.selected.has(id);
            return (
              <button
                key={id}
                type="button"
                className={[styles.pick, clickable ? styles.pickable : styles.unpickable, selected ? styles.picked : ''].join(' ')}
                disabled={!clickable}
                aria-pressed={selected}
                aria-label={`${card.name}${selected ? ', chosen' : ''}`}
                onClick={() => onCommand({ type: 'uuid', id })}
              >
                <CardFace card={card} sleeve={sleeve} size="normal" />
              </button>
            );
          })}
        </div>
        {main && (
          <footer className={styles.panelFoot}>
            <Button variant="decision" size="lg" onClick={() => onCommand(main.command)}>{main.label}</Button>
          </footer>
        )}
      </div>
    </div>
  );
}

/** Choices that don't live on the board: modes, named choices, piles, numbers. */
export function ChoicePanel({ prompt, onCommand }: { prompt: Prompt; onCommand(command: Command): void }) {
  switch (prompt.kind) {
    case 'chooseAbility':
      return (
        <PanelShell title={prompt.text || 'Choose one'}>
          <div className={styles.options}>
            {prompt.choices.map((choice, index) => (
              <button key={choice.id} type="button" className={styles.option} onClick={() => onCommand({ type: 'uuid', id: choice.id })}>
                <span className={styles.optionKey}>{index + 1}</span>
                <span><PromptText text={stripMarkup(choice.text)} /></span>
              </button>
            ))}
          </div>
          <NumberKeys count={prompt.choices.length} onPick={(index) => onCommand({ type: 'uuid', id: prompt.choices[index].id })} />
        </PanelShell>
      );
    case 'chooseChoice':
      return <ChoiceList prompt={prompt} onCommand={onCommand} />;
    case 'choosePile':
      return (
        <PanelShell title={prompt.text || 'Choose a pile'} wide>
          <div className={styles.piles}>
            {[prompt.pile1, prompt.pile2].map((pile, index) => (
              <button key={index} type="button" className={styles.pileChoice} onClick={() => onCommand({ type: 'boolean', value: index === 0 })}>
                <span className={styles.pileLabel}>Pile {index + 1} · {pile.length} {pile.length === 1 ? 'card' : 'cards'}</span>
                <div className={styles.pileCards}>
                  {pile.map((card) => <div key={card.id} className={styles.pileCard}><CardFace card={card} size="small" /></div>)}
                </div>
              </button>
            ))}
          </div>
        </PanelShell>
      );
    case 'amount':
      return <AmountChooser prompt={prompt} onCommand={onCommand} />;
    case 'multiAmount':
      return <MultiAmountChooser prompt={prompt} onCommand={onCommand} />;
    default:
      return null;
  }
}

function PanelShell({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <div className={[styles.panel, wide ? styles.panelWide : styles.panelNarrow].join(' ')}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function NumberKeys({ count, onPick }: { count: number; onPick(index: number): void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const value = Number.parseInt(event.key, 10);
      if (value >= 1 && value <= Math.min(9, count)) {
        event.preventDefault();
        onPick(value - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onPick]);
  return null;
}

function ChoiceList({ prompt, onCommand }: { prompt: Extract<Prompt, { kind: 'chooseChoice' }>; onCommand(command: Command): void }) {
  const choice = prompt.choice;
  const keyed = Object.entries(choice.keyChoices ?? {});
  const entries = keyed.length > 0
    ? keyed.map(([key, label]) => ({ value: key, label }))
    : (choice.choices ?? []).map((label) => ({ value: label, label }));
  const sorted = choice.sortData
    ? [...entries].sort((a, b) => (choice.sortData![a.value] ?? 0) - (choice.sortData![b.value] ?? 0))
    : entries;
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => sorted.filter((entry) => stripMarkup(entry.label).toLowerCase().includes(query.trim().toLowerCase())),
    [sorted, query],
  );
  const title = stripMarkup(choice.message) || prompt.text || 'Choose one';
  return (
    <PanelShell title={title}>
      {choice.subMessage && <p className={styles.panelText}>{stripMarkup(choice.subMessage)}</p>}
      {entries.length > 8 && (
        <input className={styles.search} placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus aria-label="Search choices" />
      )}
      <div className={[styles.options, entries.length > 8 ? styles.optionsScroll : ''].join(' ')}>
        {filtered.map((entry, index) => (
          <button key={entry.value} type="button" className={styles.option} onClick={() => onCommand({ type: 'string', value: entry.value })}>
            {entries.length <= 9 && <span className={styles.optionKey}>{index + 1}</span>}
            <span><PromptText text={stripMarkup(entry.label)} /></span>
          </button>
        ))}
      </div>
      {entries.length <= 9 && <NumberKeys count={filtered.length} onPick={(index) => onCommand({ type: 'string', value: filtered[index].value })} />}
      {!choice.required && (
        <footer className={styles.panelFoot}>
          <Button variant="quiet" onClick={() => onCommand({ type: 'string', value: '' })}>Skip</Button>
        </footer>
      )}
    </PanelShell>
  );
}

function AmountChooser({ prompt, onCommand }: { prompt: Extract<Prompt, { kind: 'amount' }>; onCommand(command: Command): void }) {
  const max = Math.min(prompt.max, 999);
  const [value, setValue] = useState(prompt.min);
  const clamp = (next: number) => Math.max(prompt.min, Math.min(max, next));
  return (
    <PanelShell title={prompt.text || 'Choose a number'}>
      <div className={styles.amount}>
        <Button variant="print" size="lg" onClick={() => setValue((current) => clamp(current - 1))} aria-label="Less" disabled={value <= prompt.min}>−</Button>
        <input
          className={styles.amountValue}
          type="number"
          value={value}
          min={prompt.min}
          max={max}
          onChange={(event) => setValue(clamp(Number(event.target.value)))}
          onKeyDown={(event) => event.key === 'Enter' && onCommand({ type: 'integer', value })}
          aria-label="Amount"
          autoFocus
        />
        <Button variant="print" size="lg" onClick={() => setValue((current) => clamp(current + 1))} aria-label="More" disabled={value >= max}>+</Button>
      </div>
      {max - prompt.min <= 20 && (
        <input className={styles.slider} type="range" min={prompt.min} max={max} value={value} onChange={(event) => setValue(Number(event.target.value))} aria-label="Amount" />
      )}
      <footer className={styles.panelFoot}>
        <span className={styles.range}>{prompt.min} to {max}</span>
        <Button variant="decision" size="lg" onClick={() => onCommand({ type: 'integer', value })}>Choose {value}</Button>
      </footer>
    </PanelShell>
  );
}

function MultiAmountChooser({ prompt, onCommand }: { prompt: Extract<Prompt, { kind: 'multiAmount' }>; onCommand(command: Command): void }) {
  const [values, setValues] = useState(prompt.items.map((item) => item.defaultValue ?? item.min ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const valid = total >= prompt.min && total <= prompt.max
    && prompt.items.every((item, index) => values[index] >= (item.min ?? 0) && values[index] <= (item.max ?? Infinity));
  return (
    <PanelShell title={prompt.title ?? (prompt.text || 'Divide')}>
      {prompt.header && <p className={styles.panelText}>{stripMarkup(prompt.header)}</p>}
      <div className={styles.split}>
        {prompt.items.map((item, index) => (
          <label key={index} className={styles.splitRow}>
            <span>{stripMarkup(item.message)}</span>
            <input
              type="number"
              className={styles.splitValue}
              min={item.min}
              max={item.max}
              value={values[index]}
              onChange={(event) => setValues((current) => current.map((value, i) => (i === index ? Number(event.target.value) : value)))}
            />
          </label>
        ))}
      </div>
      <footer className={styles.panelFoot}>
        <span className={styles.range}>Total {total} · needs {prompt.min === prompt.max ? prompt.min : `${prompt.min} to ${prompt.max}`}</span>
        {prompt.canCancel && <Button variant="quiet" onClick={() => onCommand({ type: 'string', value: '' })}>Cancel</Button>}
        <Button variant="decision" size="lg" disabled={!valid} onClick={() => onCommand({ type: 'string', value: values.join(' ') })}>Done</Button>
      </footer>
    </PanelShell>
  );
}

/** You won the roll: choose who takes the first turn. */
export function StartingPlayerOverlay({ me, opponents, onChoose }: {
  me: { id: string; name: string };
  opponents: { id: string; name: string }[];
  onChoose(playerId: string): void;
}) {
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className={styles.center}>
        <h2 id="start-title" className={styles.bigTitle}>You choose who starts</h2>
        <p className={styles.subtitle}>The player who goes first skips their first draw.</p>
        <div className={styles.buttons}>
          {opponents.map((opponent) => (
            <Button key={opponent.id} variant="print" size="lg" onClick={() => onChoose(opponent.id)}>
              {opponents.length === 1 ? 'Draw first' : `${opponent.name} starts`}
            </Button>
          ))}
          <Button variant="decision" size="xl" onClick={() => onChoose(me.id)} autoFocus>Play first</Button>
        </div>
      </div>
    </div>
  );
}

/** The end of a game: who won, the match score, and where to go next. */
export function GameOverOverlay({ message, endInfo, onLeave, leaveLabel = 'Back to Play', onPlayAgain }: {
  message: string;
  endInfo: GameEndView | null;
  onLeave(): void;
  leaveLabel?: string;
  onPlayAgain?(): void;
}) {
  const won = endInfo?.won ?? /you won|winner.*you/i.test(message);
  const lost = endInfo ? !endInfo.won : /lost|you lose/i.test(message);
  const title = won ? 'Victory' : lost ? 'Defeat' : 'Game over';
  return (
    <div className={[styles.scrim, styles.endScrim].join(' ')} role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className={styles.center}>
        <h2 id="game-over-title" className={[styles.endTitle, won ? styles.victory : lost ? styles.defeat : ''].join(' ')}>{title}</h2>
        <p className={styles.subtitle}>{stripMarkup(endInfo?.gameInfo) || message}</p>
        {endInfo && endInfo.winsNeeded !== undefined && (endInfo.winsNeeded ?? 0) > 1 && (
          <p className={styles.score}>Match: {endInfo.wins ?? 0}–{endInfo.loses ?? 0} · first to {endInfo.winsNeeded}</p>
        )}
        {endInfo?.matchInfo && <p className={styles.subtitle}>{stripMarkup(endInfo.matchInfo)}</p>}
        <div className={styles.buttons}>
          <Button variant="print" size="lg" onClick={onLeave}>{leaveLabel}</Button>
          {onPlayAgain && <Button variant="decision" size="xl" onClick={onPlayAgain}>Play again</Button>}
        </div>
      </div>
    </div>
  );
}

/** A zone's cards laid out to read (graveyard, exile, revealed). */
export function ZoneViewer({ title, cards, onClose }: { title: string; cards: CardView[]; onClose(): void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{title}</h2>
          <Button variant="quiet" size="sm" onClick={onClose}>Close</Button>
        </header>
        {cards.length === 0 ? <p className={styles.panelText}>Empty.</p> : (
          <div className={styles.grid}>
            {cards.map((card) => <div key={card.id} className={styles.pick}><CardFace card={card} size="normal" /></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
