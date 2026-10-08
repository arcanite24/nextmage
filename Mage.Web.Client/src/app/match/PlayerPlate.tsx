import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { POOL_MANA, poolId } from '../../core/game/payment';
import type { PlayerView } from '../../protocol/generated/views';
import { ManaCost } from '../ui/ManaCost';
import styles from './PlayerPlate.module.css';

export interface PlayerPlateProps {
  player: PlayerView;
  isMe: boolean;
  /** the player is a legal target right now */
  targetable: boolean;
  selected: boolean;
  /** the player must answer something right now */
  deciding: boolean;
  /** the player's sleeve color: their seat is dyed to match their cards */
  sleeve?: string;
  onClick(): void;
  /** while paying a cost: what is still owed */
  toPay?: string | null;
  /** board ids of the floating mana that can pay right now (see poolId) */
  payable?: ReadonlySet<string>;
  /** spend a kind of floating mana (its board id) */
  onPay?(id: string): void;
}

/** A player's seat: who they are, their life, counters, floating mana and clock. */
export function PlayerPlate({ player, isMe, targetable, selected, deciding, sleeve, onClick, toPay, payable, onPay }: PlayerPlateProps) {
  const life = player.life ?? 0;
  const previous = useRef(life);
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null);

  useEffect(() => {
    const change = life - previous.current;
    previous.current = life;
    if (change !== 0) setDelta({ value: change, key: Date.now() });
  }, [life]);

  const counters = (player.counters ?? []).filter((counter) => (counter.count ?? 0) > 0);
  const pool = POOL_MANA.filter(({ key }) => (player.manaPool?.[key] ?? 0) > 0);
  const timeLeft = player.priorityTimeLeftSecs ?? 0;
  const ticking = player.timerActive && player.hasPriority && timeLeft > 0 && timeLeft < 30;
  const initial = (player.name ?? '?').slice(0, 1).toUpperCase();

  return (
    <div
      className={[
        styles.plate,
        isMe ? styles.mine : styles.theirs,
        targetable ? styles.targetable : '',
        selected ? styles.selected : '',
        player.hasLeft ? styles.left : '',
        player.isActive ? styles.active : '',
        deciding ? styles.deciding : '',
      ].join(' ')}
      style={sleeve ? ({ '--sleeve': sleeve } as CSSProperties) : undefined}
      role={targetable ? 'button' : 'group'}
      tabIndex={targetable ? 0 : undefined}
      aria-label={`${player.name}, ${life} life${targetable ? ', can be targeted' : ''}`}
      onClick={() => targetable && onClick()}
      onKeyDown={(event) => {
        if (targetable && event.key === 'Enter') {
          event.preventDefault();
          onClick();
        }
      }}
      data-object-id={player.playerId}
    >
      <div className={styles.avatar}>
        <span aria-hidden="true">{initial}</span>
        {ticking && (
          <svg className={styles.rope} viewBox="0 0 100 100" aria-label={`${timeLeft} seconds left`}>
            <circle cx="50" cy="50" r="47" pathLength={30} strokeDasharray={`${timeLeft} 30`} />
          </svg>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{player.name}{player.hasLeft ? ' (left)' : ''}</div>
        <div className={styles.lifeRow}>
          <span key={delta?.key} className={[styles.life, delta ? (delta.value < 0 ? styles.hurt : styles.healed) : ''].join(' ')}>{life}</span>
          <span className={styles.unit} aria-hidden="true">life</span>
          {delta && (
            <span key={`d${delta.key}`} className={[styles.delta, delta.value < 0 ? styles.deltaDown : styles.deltaUp].join(' ')}>
              {delta.value > 0 ? `+${delta.value}` : delta.value}
            </span>
          )}
          {counters.map((counter) => (
            <span key={counter.name} className={styles.counter} title={`${counter.count} ${counter.name}`}>
              {counter.count} {counter.name}
            </span>
          ))}
          {player.monarch && <span className={styles.counter}>Monarch</span>}
          {player.initiative && <span className={styles.counter}>Initiative</span>}
        </div>
        {toPay && (
          <div className={styles.toPay}>
            <span className={styles.toPayLabel}>To pay</span>
            <ManaCost cost={toPay} size="lg" />
          </div>
        )}
        {pool.length > 0 && (
          <div className={styles.pool} aria-label="Mana pool">
            {pool.map(({ key, symbol, manaType }) => {
              const id = poolId(manaType);
              const content = (
                <>
                  <i className={`ms ms-cost ms-${symbol}`} aria-hidden="true" />
                  <b>{player.manaPool?.[key]}</b>
                </>
              );
              // floating mana pays the cost being paid: click it like a land
              return payable?.has(id) && onPay ? (
                <button
                  key={key}
                  type="button"
                  className={[styles.poolItem, styles.poolPay].join(' ')}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPay(id);
                  }}
                  aria-label={`Pay with ${key} mana from your pool, ${player.manaPool?.[key]} floating`}
                >
                  {content}
                </button>
              ) : (
                <span key={key} className={styles.poolItem}>{content}</span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
