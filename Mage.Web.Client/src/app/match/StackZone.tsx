import { useRef } from 'react';
import type { CardView, StackAbilityView } from '../../protocol/generated/views';
import { CardFace } from '../ui/CardFace';
import { useFlip } from './flip';
import { useMatchUi } from './matchUi';
import styles from './StackZone.module.css';

export interface StackZoneProps {
  /** top of the stack first */
  items: CardView[];
  clickable: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  sleeveOf(card: CardView): string;
  onClick(id: string): void;
  /** opponents' spells fly in from their hidden hand */
  originOf(card: CardView): string | undefined;
}

/** Spells and abilities waiting to resolve, stacked at the right of the table; the top one resolves first. */
export function StackZone({ items, clickable, selected, sleeveOf, onClick, originOf }: StackZoneProps) {
  if (items.length === 0) return null;
  return (
    <section className={styles.zone} aria-label={`Stack, ${items.length} ${items.length === 1 ? 'object' : 'objects'}`}>
      <h2 className={styles.label}>Stack</h2>
      <ol className={styles.list}>
        {items.map((item, index) => (
          <StackItem
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            clickable={clickable.has(item.id!)}
            selected={selected.has(item.id!)}
            sleeve={sleeveOf(item)}
            onClick={onClick}
            origin={originOf(item)}
          />
        ))}
      </ol>
    </section>
  );
}

function StackItem({ item, index, total, clickable, selected, sleeve, onClick, origin }: {
  item: CardView;
  index: number;
  total: number;
  clickable: boolean;
  selected: boolean;
  sleeve: string;
  onClick(id: string): void;
  origin: string | undefined;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const setZoom = useMatchUi((state) => state.setZoom);
  const ability = item.isAbility ? (item as StackAbilityView) : null;
  const face = ability?.sourceCard ?? item;
  useFlip(ability ? item.id : (item.cardId ?? item.id), ref, { fallbackOrigin: origin });

  return (
    <li
      ref={ref}
      className={[styles.item, index === 0 ? styles.top : '', clickable ? styles.clickable : '', selected ? styles.selected : ''].join(' ')}
      style={{ zIndex: total - index, ['--i' as string]: index }}
      onPointerEnter={(event) => setZoom({ card: item, x: event.clientX, y: event.clientY, sleeve })}
      onPointerLeave={() => setZoom(null)}
      onClick={() => clickable && onClick(item.id!)}
      data-object-id={item.id}
      aria-label={`${ability ? 'Ability of ' : ''}${face.name}${index === 0 ? ', resolves next' : ''}`}
    >
      <CardFace card={face} sleeve={sleeve} size="normal" />
      {ability && (
        <div className={styles.ability}>
          <span className={styles.abilityTag}>Ability</span>
          <p>{(item.rules ?? [])[0]?.replace(/<[^>]*>/g, '')}</p>
        </div>
      )}
      {index === 0 && <span className={styles.next}>Resolving next</span>}
    </li>
  );
}
