import { Hourglass, Shield, Swords } from 'lucide-react';
import { memo, useRef, type CSSProperties } from 'react';
import type { PermanentView } from '../../protocol/generated/views';
import { CardFace } from '../ui/CardFace';
import type { PermanentGroup } from './boardModel';
import { useFlip } from './flip';
import { useMatchUi } from './matchUi';
import styles from './PermanentStack.module.css';

export interface PermanentStackProps {
  group: PermanentGroup;
  width: number;
  sleeve: string;
  clickable: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  /** clickable but not worth a glow (lands while you hold priority: tapping for mana is always possible) */
  quiet?: ReadonlySet<string>;
  attacking: ReadonlySet<string>;
  blocking: ReadonlySet<string>;
  /** opponents' attackers slide toward the player, ours toward the opponent */
  forward: 1 | -1;
  onClick(id: string): void;
}

const CARD_RATIO = 88 / 63;

/** A permanent (or a stack of identical lands/tokens) placed on the mat, with its attachments tucked behind. */
export const PermanentStack = memo(function PermanentStack(props: PermanentStackProps) {
  const { group, width } = props;
  const tapped = !!group.lead.tapped;
  const height = width * CARD_RATIO;
  const stackOffset = width * 0.12;
  const attachOffset = width * 0.18;
  const slotWidth = (tapped ? height : width) + (group.members.length - 1) * stackOffset + group.attachments.length * attachOffset;
  const slotHeight = (tapped ? width : height) + group.attachments.length * attachOffset;

  return (
    <div className={styles.slot} style={{ width: slotWidth, height: slotHeight }}>
      {group.attachments.map((attachment, index) => (
        <PlacedCard
          key={attachment.id}
          permanent={attachment}
          {...props}
          left={(group.attachments.length - 1 - index) * attachOffset}
          top={0}
          depth={index}
        />
      ))}
      {[...group.members].reverse().map((permanent, index, reversed) => (
        <PlacedCard
          key={permanent.id}
          permanent={permanent}
          {...props}
          left={group.attachments.length * attachOffset + (reversed.length - 1 - index) * stackOffset}
          top={group.attachments.length * attachOffset}
          depth={group.attachments.length + index}
          count={index === reversed.length - 1 && group.members.length > 1 ? group.members.length : undefined}
        />
      ))}
    </div>
  );
});

interface PlacedCardProps extends PermanentStackProps {
  permanent: PermanentView;
  left: number;
  top: number;
  depth: number;
  count?: number;
}

function PlacedCard({ permanent, width, sleeve, clickable, selected, quiet, attacking, blocking, forward, onClick, left, top, depth, count }: PlacedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = permanent.id!;
  const tapped = !!permanent.tapped;
  const height = width * CARD_RATIO;
  const isClickable = clickable.has(id);
  const isSelected = selected.has(id);
  const isAttacking = attacking.has(id);
  const isBlocking = blocking.has(id);
  const setZoom = useMatchUi((state) => state.setZoom);
  useFlip(permanent.cardId ?? id, ref, { rotation: tapped ? 90 : 0 });

  const damage = permanent.damage ?? 0;
  const counters = (permanent.counters ?? []).filter((counter) => (counter.count ?? 0) > 0);
  const isCreature = (permanent.cardTypes ?? []).includes('CREATURE');
  const loyalty = permanent.loyalty || permanent.defense;
  const advance = isAttacking ? forward * height * 0.16 : isBlocking ? forward * height * 0.1 : 0;

  const style: CSSProperties = {
    width,
    height,
    left: left + (tapped ? (height - width) / 2 : 0),
    top: top + (tapped ? (width - height) / 2 : 0),
    zIndex: depth + 1,
    transform: `translateY(${advance}px) rotate(${tapped ? 90 : 0}deg)`,
  };

  return (
    <div
      ref={ref}
      className={[
        styles.card,
        isClickable && !quiet?.has(id) ? styles.clickable : '',
        isSelected ? styles.selected : '',
        isAttacking ? styles.attacking : '',
      ].join(' ')}
      style={style}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={describe(permanent, { tapped, isAttacking, isBlocking, isSelected })}
      aria-pressed={isClickable ? isSelected : undefined}
      onClick={() => isClickable && onClick(id)}
      onKeyDown={(event) => {
        if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick(id);
        }
      }}
      onPointerEnter={(event) => setZoom({ card: permanent, x: event.clientX, y: event.clientY, sleeve })}
      onPointerLeave={() => setZoom(null)}
      data-object-id={id}
    >
      <CardFace card={permanent} sleeve={sleeve} size={width > 140 ? 'normal' : 'small'} />

      <div className={styles.marks} style={{ transform: tapped ? 'rotate(-90deg)' : undefined }}>
        {permanent.summoningSickness && isCreature && (
          <span className={styles.mark} title="Summoning sick"><Hourglass size={13} aria-hidden="true" /></span>
        )}
        {isAttacking && <span className={[styles.mark, styles.markAttack].join(' ')} title="Attacking"><Swords size={13} aria-hidden="true" /></span>}
        {isBlocking && <span className={styles.mark} title="Blocking"><Shield size={13} aria-hidden="true" /></span>}
      </div>

      {counters.length > 0 && (
        <ul className={styles.counters} aria-label="Counters">
          {counters.map((counter) => (
            <li key={counter.name} title={`${counter.count} ${counter.name}`}>
              <span>{counterLabel(counter.name ?? '')}</span>
              {(counter.count ?? 0) > 1 && <b>{counter.count}</b>}
            </li>
          ))}
        </ul>
      )}

      {isCreature && permanent.power !== undefined && (
        <span className={[styles.pt, ptTone(permanent)].join(' ')}>
          {permanent.power}/{permanent.toughness}
          {damage > 0 && <span className={styles.damage}>−{damage}</span>}
        </span>
      )}
      {!isCreature && loyalty && <span className={[styles.pt, styles.loyalty].join(' ')}>{loyalty}</span>}
      {count !== undefined && <span className={styles.count}>×{count}</span>}
    </div>
  );
}

function counterLabel(name: string): string {
  if (/^[+-]\d+\/[+-]\d+$/.test(name)) return name;
  return name.replace(/counter$/i, '').trim().slice(0, 10);
}

function ptTone(permanent: PermanentView): string {
  const base = permanent.original;
  const power = Number(permanent.power);
  const toughness = Number(permanent.toughness);
  const basePower = Number(base?.power ?? permanent.power);
  const baseToughness = Number(base?.toughness ?? permanent.toughness);
  if (Number.isNaN(power) || Number.isNaN(basePower)) return '';
  if (power > basePower || toughness > baseToughness) return styles.up;
  if (power < basePower || toughness < baseToughness) return styles.down;
  return '';
}

function describe(permanent: PermanentView, state: { tapped: boolean; isAttacking: boolean; isBlocking: boolean; isSelected: boolean }): string {
  const parts = [permanent.name ?? 'Permanent'];
  if (permanent.power !== undefined && (permanent.cardTypes ?? []).includes('CREATURE')) parts.push(`${permanent.power}/${permanent.toughness}`);
  if (state.tapped) parts.push('tapped');
  if (state.isAttacking) parts.push('attacking');
  if (state.isBlocking) parts.push('blocking');
  if (state.isSelected) parts.push('chosen');
  return parts.join(', ');
}
