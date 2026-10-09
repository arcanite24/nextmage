import { useEffect, useMemo, useRef } from 'react';
import { nextTip, type CoachTip } from '../../core/game/coach';
import type { InteractionMode } from '../../core/game/interaction';
import type { GameView } from '../../protocol/generated/views';
import { useCoach } from '../stores/coach';
import { Button } from '../ui/Button';
import styles from './Coach.module.css';

const TIPS: Record<CoachTip, { title: string; text: string }> = {
  mulligan: {
    title: 'Your opening hand',
    text: 'Keep a hand with two to five lands. If it has too few or too many, Mulligan draws a fresh seven; you then put one card on the bottom for each mulligan.',
  },
  playLand: {
    title: 'Play a land',
    text: 'Lands make the mana you cast spells with. Click a land in your hand, or drag it up, to play it. One land per turn.',
  },
  castSpell: {
    title: 'Cast a spell',
    text: 'Cards you can afford glow. Click one to cast it; the lands it needs are tapped for you. The cost is in its top right corner.',
  },
  payMana: {
    title: 'Pay the cost',
    text: 'Click your lands to pay the mana shown, or choose Pay automatically.',
  },
  toCombat: {
    title: 'Ready to attack',
    text: "Creatures that have been on your side since your turn began can attack. Press To Combat when you've cast what you want.",
  },
  attack: {
    title: 'Choose attackers',
    text: 'Click your creatures to send them in, then confirm. Damage they deal to the opponent lowers their life; at 0 they lose.',
  },
  block: {
    title: 'Block',
    text: "Drag one of your creatures onto an attacker to block it, or click both. Blocked creatures deal their damage to each other. Confirm when you're done, or don't block.",
  },
  target: {
    title: 'Choose a target',
    text: 'The prompt says what to choose. Click a glowing card or player, then confirm.',
  },
  respond: {
    title: 'You can respond',
    text: 'Their spell waits on the stack. Cast an instant now to answer it, or pass to let it resolve.',
  },
  theirTurn: {
    title: "The opponent's turn",
    text: "Your cards untap at the start of your turn. While they play, watch for the moments you're asked to block.",
  },
};

/** A tip for each new kind of moment in the guided first game; never in the way of the choice itself. */
export function Coach({ view, mode, awaiting, gameOver }: { view: GameView | null; mode: InteractionMode; awaiting: boolean; gameOver: boolean }) {
  const guided = useCoach((state) => state.guided);
  const seen = useCoach((state) => state.seen);
  const markSeen = useCoach((state) => state.markSeen);
  const finish = useCoach((state) => state.finish);
  const seenSet = useMemo(() => new Set(seen), [seen]);
  const tip = guided && !gameOver ? nextTip({ view, mode, awaiting }, seenSet) : null;
  // a tip the player acted on has done its job: answering anything while it shows counts as reading it
  const shown = useRef<CoachTip | null>(null);
  useEffect(() => {
    if (tip) shown.current = tip;
    else if (awaiting && shown.current) {
      markSeen(shown.current);
      shown.current = null;
    }
  }, [tip, awaiting, markSeen]);

  useEffect(() => {
    if (guided && gameOver) finish();
  }, [guided, gameOver, finish]);

  if (!tip) return null;
  const copy = TIPS[tip];
  return (
    <aside className={styles.coach} aria-live="polite" aria-label="Tip">
      <h2 className={styles.title}>{copy.title}</h2>
      <p className={styles.text}>{copy.text}</p>
      <div className={styles.actions}>
        <Button variant="quiet" size="sm" onClick={finish}>No more tips</Button>
        <Button variant="print" size="sm" onClick={() => markSeen(tip)}>Got it</Button>
      </div>
    </aside>
  );
}
