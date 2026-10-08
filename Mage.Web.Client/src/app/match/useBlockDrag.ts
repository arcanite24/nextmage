import { useCallback, useEffect, useRef } from 'react';
import { pendingBlockStep, startDragBlock, type PendingBlock } from '../../core/game/blockDrag';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';

/**
 * Blocks made by dropping a creature on an attacker: sends the blocker, then answers the server's "which attacker"
 * question with the attacker it was dropped on. Returns the drop handler; false when the drop sends nothing.
 */
export function useBlockDrag(session: GameSession, state: GameSessionState): (blockerId: string, attackerId: string) => boolean {
  const pending = useRef<PendingBlock | null>(null);
  const { prompt, awaitingServer } = state;

  useEffect(() => {
    const current = pending.current;
    if (!current) return;
    const step = pendingBlockStep(current, prompt, awaitingServer);
    if (step.kind === 'wait') return;
    pending.current = step.kind === 'again' ? step.next : null;
    if (step.kind === 'answer' || step.kind === 'again') void session.respond(step.command).catch(() => undefined);
  }, [session, prompt, awaitingServer]);

  return useCallback((blockerId: string, attackerId: string) => {
    const current = session.getState();
    if (current.awaitingServer || !current.interaction.clickable.has(blockerId)) return false;
    const next = startDragBlock(current.view, current.prompt, blockerId, attackerId);
    if (!next) return false;
    pending.current = next;
    return session.click(blockerId);
  }, [session]);
}
