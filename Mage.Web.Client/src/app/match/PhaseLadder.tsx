import type { PhaseStep, SkipPrioritySteps } from '../../protocol/generated/views';
import { useSettings } from '../stores/settings';
import styles from './PhaseLadder.module.css';

interface Rung {
  label: string;
  steps: PhaseStep[];
  /** the stop setting this rung toggles */
  stop?: keyof SkipPrioritySteps;
}

const RUNGS: Rung[] = [
  { label: 'Upkeep', steps: ['UNTAP', 'UPKEEP'], stop: 'upkeep' },
  { label: 'Draw', steps: ['DRAW'], stop: 'draw' },
  { label: 'Main', steps: ['PRECOMBAT_MAIN'], stop: 'main1' },
  { label: 'Combat', steps: ['BEGIN_COMBAT'], stop: 'beforeCombat' },
  { label: 'Attack', steps: ['DECLARE_ATTACKERS'] },
  { label: 'Block', steps: ['DECLARE_BLOCKERS'] },
  { label: 'Damage', steps: ['FIRST_COMBAT_DAMAGE', 'COMBAT_DAMAGE', 'END_COMBAT'], stop: 'endOfCombat' },
  { label: 'Main', steps: ['POSTCOMBAT_MAIN'], stop: 'main2' },
  { label: 'End', steps: ['END_TURN', 'CLEANUP'], stop: 'endOfTurn' },
];

/**
 * Where the turn is, printed down the right edge. Dots mark where the game stops for you on this player's
 * turn; click a rung to toggle that stop.
 */
export function PhaseLadder({ step, myTurn, turn }: { step: PhaseStep | undefined; myTurn: boolean; turn: number }) {
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const side = myTurn ? 'yourTurn' : 'opponentTurn';
  const stops = settings.stops[side] ?? {};

  return (
    <nav className={[styles.ladder, myTurn ? styles.mine : styles.theirs].join(' ')} aria-label={`Turn ${turn}, ${myTurn ? 'your' : "opponent's"} turn`}>
      <div className={styles.turn}>
        <span className={styles.turnNumber}>Turn {turn}</span>
        <span className={styles.whose}>{myTurn ? 'Yours' : 'Theirs'}</span>
      </div>
      <ol className={styles.rungs}>
        {RUNGS.map((rung, index) => {
          const current = !!step && rung.steps.includes(step);
          const stopOn = rung.stop ? !!stops[rung.stop] : false;
          return (
            <li key={index}>
              <button
                type="button"
                className={[styles.rung, current ? styles.current : ''].join(' ')}
                aria-current={current ? 'step' : undefined}
                aria-pressed={rung.stop ? stopOn : undefined}
                disabled={!rung.stop}
                title={rung.stop ? `${stopOn ? 'Stop' : "Don't stop"} at ${rung.label} on ${myTurn ? 'your' : "opponents'"} turn` : undefined}
                onClick={() => rung.stop && update({ stops: { ...settings.stops, [side]: { ...stops, [rung.stop]: !stopOn } } })}
              >
                <span className={[styles.dot, stopOn ? styles.dotOn : ''].join(' ')} aria-hidden="true" />
                {rung.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
