import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { pendingBlockStep, startDragBlock, type PendingBlock } from './blockDrag';
import { parsePrompt } from './prompt';

const declare = parsePrompt('GAME_SELECT', { message: 'Select blockers', options: { possibleBlockers: ['wall'] } as never });
const whichAttacker = parsePrompt('GAME_TARGET', {
  message: 'Select attacker to block',
  targets: ['bear', 'dragon'],
  flag: false,
});

function pending(attackerId = 'dragon'): PendingBlock {
  return { blockerId: 'wall', attackerId, sentFor: declare, moving: false };
}

describe('blocking by drag', () => {
  test('waits while the server works on the blocker', () => {
    expect(pendingBlockStep(pending(), declare, true)).toEqual({ kind: 'wait' });
    // the answered prompt is still on screen
    expect(pendingBlockStep(pending(), declare, false)).toEqual({ kind: 'wait' });
    expect(pendingBlockStep(pending(), null, false)).toEqual({ kind: 'wait' });
  });

  test('answers "which attacker" with the attacker it was dropped on', () => {
    expect(pendingBlockStep(pending(), whichAttacker, false)).toEqual({ kind: 'answer', command: { type: 'uuid', id: 'dragon' } });
  });

  test('leaves the question to the player when the dropped attacker cannot be blocked by it', () => {
    expect(pendingBlockStep(pending('griffin'), whichAttacker, false)).toEqual({ kind: 'done' });
  });

  test('is done when the server paired them itself and asks for blockers again', () => {
    const again = parsePrompt('GAME_SELECT', { message: 'Select blockers', options: { possibleBlockers: [] } as never });
    expect(pendingBlockStep(pending(), again, false)).toEqual({ kind: 'done' });
  });

  test('moving a blocker to another attacker chooses it again once its old block is gone', () => {
    const view: GameView = { combat: [{ attackers: { bear: {} }, blockers: { wall: {} } }, { attackers: { dragon: {} }, blockers: {} }] };
    const move = startDragBlock(view, declare, 'wall', 'dragon')!;
    expect(move.moving).toBe(true);
    const again = parsePrompt('GAME_SELECT', { message: 'Select blockers', options: { possibleBlockers: ['wall'] } as never });
    const step = pendingBlockStep(move, again, false);
    expect(step).toMatchObject({ kind: 'again', command: { type: 'uuid', id: 'wall' }, next: { moving: false, sentFor: again } });
    // dropping it on the attacker it already blocks changes nothing
    expect(startDragBlock(view, declare, 'wall', 'bear')).toBeNull();
    // and only a declare-blockers prompt starts a drag block
    expect(startDragBlock(view, whichAttacker, 'wall', 'dragon')).toBeNull();
  });
});
