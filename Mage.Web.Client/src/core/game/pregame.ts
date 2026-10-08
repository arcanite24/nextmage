import type { Prompt } from './prompt';

/** A pre-game choice that gets its own overlay instead of board highlights. */
export type PregameChoice = 'startingPlayer' | 'mulliganBottom';

export interface PregameContext {
  /** no turn has started yet (the game view has no step) */
  pregame: boolean;
  /** what the prompt lets the player click */
  clickable: Iterable<string>;
  /** cards in the player's hand */
  handIds: { has(id: string): boolean };
  /** every player of the game */
  playerIds: { has(id: string): boolean };
}

/**
 * Which pre-game choice a prompt is: the server's marker when it sends one, otherwise (older servers) a choice
 * before the first turn among exactly the players is "who starts", and among cards in hand is the London mulligan.
 */
export function pregameChoice(prompt: Prompt | null, context: PregameContext): PregameChoice | null {
  if (!prompt || prompt.kind !== 'target') return null;
  if (prompt.marker === 'startingPlayer' || prompt.marker === 'mulliganBottom') return prompt.marker;
  if (prompt.marker || !context.pregame) return null;
  const ids = [...context.clickable];
  if (ids.length === 0) return null;
  if (ids.every((id) => context.playerIds.has(id))) return 'startingPlayer';
  if (ids.every((id) => context.handIds.has(id))) return 'mulliganBottom';
  return null;
}
