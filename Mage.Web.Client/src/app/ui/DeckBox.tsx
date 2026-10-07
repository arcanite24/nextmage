import type { CSSProperties } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import type { RosterDeck } from '../stores/decks';
import styles from './DeckBox.module.css';

export interface DeckBoxProps {
  deck: RosterDeck;
  sleeve: string;
  selected?: boolean;
  onSelect?(): void;
  onActivate?(): void;
}

/** A deck in the roster: a sleeved deck box with its cover art window and a name plate. */
export function DeckBox({ deck, sleeve, selected, onSelect, onActivate }: DeckBoxProps) {
  const art = useCardImage(deck.cover, 'front', 'art_crop');
  return (
    <button
      type="button"
      className={[styles.box, selected ? styles.selected : ''].join(' ')}
      style={{ '--sleeve': sleeve } as CSSProperties}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onActivate}
    >
      <span className={styles.window} style={typeof art === 'string' ? { backgroundImage: `url("${art}")` } : undefined} aria-hidden="true">
        {/* no art (yet): the deck's initial, printed */}
        {typeof art !== 'string' && <span className={styles.initial}>{deck.name.slice(0, 1).toUpperCase()}</span>}
      </span>
      <span className={styles.plate}>
        <span className={styles.name}>{deck.name}</span>
        <span className={styles.note}>
          {deck.colors.length > 0 && (
            <span className={styles.pips} aria-label={`Colors ${deck.colors.join('')}`}>
              {deck.colors.map((color) => <i key={color} className={`ms ms-cost ms-${color.toLowerCase()}`} aria-hidden="true" />)}
            </span>
          )}
          {deck.note}
        </span>
      </span>
    </button>
  );
}
