import type { GameView } from '../../protocol/generated/views';
import type { Command } from './interaction';
import type { Prompt } from './prompt';

/**
 * Blocking by dragging a creature onto an attacker. The server takes a block in two questions: which creature blocks
 * (answered by the drag's start), then, when more than one attacker could be blocked, "Select attacker to block"
 * (answered by where it was dropped). With a single possible attacker the server pairs them itself.
 */
export interface PendingBlock {
  blockerId: string;
  attackerId: string;
  /** the declare-blockers prompt the blocker was sent for: anything after it is the server's reply */
  sentFor: Prompt | null;
  /**
   * the creature already blocked another attacker: the server takes it out of that block first, then it must be
   * chosen again to block the new one
   */
  moving: boolean;
}

/** The attackers a creature is blocking right now. */
export function blockedAttackers(view: GameView | null | undefined, blockerId: string): string[] {
  return (view?.combat ?? [])
    .filter((group) => Object.keys(group.blockers ?? {}).includes(blockerId))
    .flatMap((group) => Object.keys(group.attackers ?? {}));
}

/**
 * Starts a drag block, or null when there is nothing to send: dropping a creature on the attacker it already
 * blocks keeps the block (a click on it would remove it).
 */
export function startDragBlock(view: GameView | null | undefined, prompt: Prompt | null, blockerId: string, attackerId: string): PendingBlock | null {
  if (prompt?.kind !== 'declareBlockers') return null;
  const blocking = blockedAttackers(view, blockerId);
  if (blocking.includes(attackerId)) return null;
  return { blockerId, attackerId, sentFor: prompt, moving: blocking.length > 0 };
}

export type PendingBlockStep =
  /** the server hasn't replied yet */
  | { kind: 'wait' }
  /** answer the follow-up question with the dropped attacker */
  | { kind: 'answer'; command: Command }
  /** the creature left its old block: choose it again, and keep going with this pending block */
  | { kind: 'again'; command: Command; next: PendingBlock }
  /** nothing more to send: the block is made, or the rest of the choice is the player's */
  | { kind: 'done' };

function asksForAttacker(prompt: Prompt): prompt is Extract<Prompt, { kind: 'target' }> {
  return prompt.kind === 'target' && /attacker/i.test(prompt.text);
}

/** The next step of a drag block, given the prompt on screen now. */
export function pendingBlockStep(pending: PendingBlock, prompt: Prompt | null, awaitingServer: boolean): PendingBlockStep {
  if (awaitingServer || !prompt || prompt === pending.sentFor) return { kind: 'wait' };
  if (asksForAttacker(prompt)) {
    // the dropped attacker isn't one this creature can block: the server's question stays for the player
    if (!prompt.targets.includes(pending.attackerId)) return { kind: 'done' };
    return { kind: 'answer', command: { type: 'uuid', id: pending.attackerId } };
  }
  if (pending.moving && prompt.kind === 'declareBlockers' && prompt.possibleBlockers.includes(pending.blockerId)) {
    return { kind: 'again', command: { type: 'uuid', id: pending.blockerId }, next: { ...pending, sentFor: prompt, moving: false } };
  }
  return { kind: 'done' };
}
