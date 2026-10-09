import type { GameSessionState } from '../../core/game/gameSession';

/** What a Career opponent may say, by moment; each is said at most once a game. */
export type VoiceMoment = 'intro' | 'bigPlay' | 'lowLife' | 'win' | 'lose';

/** A spell this costly on the stack is a big play. */
export const BIG_PLAY_MANA = 5;
/** At this life or under, the opponent feels it. */
export const LOW_LIFE = 5;

export interface VoiceSnapshot {
  /** the opponent's seat name, as bubbles name it */
  foe: string | null;
  turn: number;
  /** the step the game is on; it holds still through the opening hands */
  step: string | null;
  foeLife: number | null;
  /** a costly spell the opponent has on the stack */
  foeBigSpell: boolean;
  over: boolean;
  won: boolean;
}

export function voiceSnapshot(state: GameSessionState, myId: string | null, speaker?: string | null): VoiceSnapshot {
  const view = state.view;
  const foes = (view?.players ?? []).filter((player) => player.playerId !== myId);
  // one voice across the table: the only opponent, or at a pod the seat named as the speaker (its seat name may be cut short)
  const named = (name: string | undefined) => !!speaker && !!name && (speaker.startsWith(name) || name.startsWith(speaker));
  const foe = foes.length === 1 ? foes[0] : foes.find((player) => named(player.name)) ?? null;
  const stack = Object.values(view?.stack ?? {});
  return {
    foe: foe?.name ?? null,
    turn: view?.turn ?? 0,
    step: view?.step ?? null,
    foeLife: foe?.life ?? null,
    foeBigSpell: !!foe && stack.some((card) => card.controllerId === foe.playerId && (card.manaValue ?? 0) >= BIG_PLAY_MANA),
    over: !!state.gameOver,
    won: !!state.endInfo?.won || /you won/i.test(state.gameOver ?? ''),
  };
}

/** The moment to speak for a change of state, or null; `said` holds what was said already this game. */
export function pickVoice(before: VoiceSnapshot | null, now: VoiceSnapshot, said: ReadonlySet<VoiceMoment>): VoiceMoment | null {
  if (!now.foe) return null;
  if (now.over) {
    if (said.has('win') || said.has('lose')) return null;
    // their line for the result: they lost when you won
    return now.won ? 'lose' : 'win';
  }
  if (!before) return null;
  // the greeting waits until play is under way: past the opening hands (the first step change), or turn two at the latest
  if (!said.has('intro')) return now.turn >= 2 || (now.turn > 0 && before.turn > 0 && now.step !== before.step) ? 'intro' : null;
  if (!said.has('bigPlay') && now.foeBigSpell && !before.foeBigSpell) return 'bigPlay';
  if (!said.has('lowLife') && now.foeLife !== null && now.foeLife <= LOW_LIFE && (before.foeLife === null || before.foeLife > LOW_LIFE)) return 'lowLife';
  return null;
}
