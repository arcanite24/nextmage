import { useRef } from 'react';
import type { CardView, PlayerView } from '../../protocol/generated/views';
import { CardFace } from '../ui/CardFace';
import { cardKey } from './boardModel';
import { useFlip, useFlipOrigin } from './flip';
import { useMatchUi } from './matchUi';
import styles from './Piles.module.css';

/** Library, graveyard, exile and command zone of one player, as piles on the mat. */
export function Piles({ player, sleeve, isMe }: { player: PlayerView; sleeve: string; isMe: boolean }) {
  const openViewer = useMatchUi((state) => state.openViewer);
  const libraryRef = useRef<HTMLButtonElement>(null);
  useFlipOrigin(`library:${player.playerId}`, libraryRef);
  const graveyard = Object.values(player.graveyard ?? {});
  const exile = Object.values(player.exile ?? {});
  const command = (player.commandList ?? []) as CardView[];
  const name = isMe ? 'Your' : `${player.name}'s`;

  return (
    <div className={[styles.piles, isMe ? styles.mine : styles.theirs].join(' ')}>
      <button
        ref={libraryRef}
        type="button"
        className={styles.pile}
        aria-label={`${name} library, ${player.libraryCount ?? 0} cards`}
        onClick={() => player.topCard && openViewer({ title: `${name} library (top card)`, cards: [player.topCard] })}
      >
        <div className={styles.stack} style={{ ['--depth' as string]: Math.min(6, Math.ceil((player.libraryCount ?? 0) / 10)) }}>
          <CardFace card={player.topCard ?? {}} hidden={!player.topCard} sleeve={sleeve} size="small" />
        </div>
        <span className={styles.count}>{player.libraryCount ?? 0}</span>
        <span className={styles.label}>Library</span>
      </button>

      <PileOfCards title={`${name} graveyard`} label="Graveyard" cards={graveyard} sleeve={sleeve} onOpen={() => openViewer({ title: `${name} graveyard`, cards: [...graveyard].reverse() })} />
      {exile.length > 0 && (
        <PileOfCards title={`${name} exile`} label="Exile" cards={exile} sleeve={sleeve} onOpen={() => openViewer({ title: `${name} exile`, cards: exile })} />
      )}
      {command.length > 0 && (
        <PileOfCards title={`${name} command zone`} label="Command" cards={command} sleeve={sleeve} onOpen={() => openViewer({ title: `${name} command zone`, cards: command })} />
      )}
    </div>
  );
}

function PileOfCards({ title, label, cards, sleeve, onOpen }: { title: string; label: string; cards: CardView[]; sleeve: string; onOpen(): void }) {
  const top = cards[cards.length - 1];
  return (
    <button type="button" className={styles.pile} aria-label={`${title}, ${cards.length} cards`} onClick={onOpen} disabled={cards.length === 0}>
      {/* a new top card is a new element: it lands on the pile from wherever that card was */}
      <PileTop key={top ? cardKey(top) : 'empty'} top={top} count={cards.length} sleeve={sleeve} />
      <span className={styles.count}>{cards.length}</span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}

function PileTop({ top, count, sleeve }: { top: CardView | undefined; count: number; sleeve: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(top ? cardKey(top) : undefined, ref);
  return (
    <div ref={ref} className={[styles.stack, count === 0 ? styles.empty : ''].join(' ')} style={{ ['--depth' as string]: Math.min(4, count) }}>
      {top && <CardFace card={top} sleeve={sleeve} size="small" />}
    </div>
  );
}
