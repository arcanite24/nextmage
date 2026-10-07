import { useEffect, useRef } from 'react';
import type { GameSessionState } from '../../core/game/gameSession';
import { playCue } from './sound';

interface Snapshot {
  turn: number;
  active: string | null;
  deciding: boolean;
  stack: number;
  hand: number;
  life: Map<string, number>;
  attackers: number;
  over: boolean;
}

function snapshot(state: GameSessionState): Snapshot {
  const view = state.view;
  return {
    turn: view?.turn ?? 0,
    active: view?.activePlayerId ?? null,
    deciding: state.mode === 'play' && state.interaction.mode !== 'waiting' && !state.awaitingServer,
    stack: Object.keys(view?.stack ?? {}).length,
    hand: Object.keys(view?.myHand ?? {}).length,
    life: new Map((view?.players ?? []).map((player) => [player.playerId ?? '', player.life ?? 0])),
    attackers: (view?.combat ?? []).reduce((sum, group) => sum + Object.keys(group.attackers ?? {}).length, 0),
    over: !!state.gameOver,
  };
}

/** Plays a cue when something worth hearing happens: your turn, a decision, a spell, damage, a draw, the result. */
export function useGameCues(state: GameSessionState, myId: string | null, autoPassing = false) {
  const previous = useRef<Snapshot | null>(null);
  useEffect(() => {
    const now = snapshot(state);
    const before = previous.current;
    previous.current = now;
    // the first view of a game (or a reconnect) sets the baseline silently
    if (!before || before.turn === 0) return;

    if (now.over && !before.over) {
      playCue(state.endInfo?.won || /you won/i.test(state.gameOver ?? '') ? 'victory' : 'defeat');
      return;
    }
    if (now.turn !== before.turn && now.active && now.active === myId) playCue('turn');
    else if (now.attackers > 0 && before.attackers === 0) playCue('attack');
    else if (now.stack > before.stack) playCue('cast');
    else if ([...now.life].some(([id, life]) => life < (before.life.get(id) ?? life))) playCue('damage');
    else if (now.hand > before.hand && now.turn === before.turn) playCue('draw');
    // a prompt the client answers by itself isn't a decision worth a chime
    else if (now.deciding && !before.deciding && !autoPassing) playCue('decide');
  }, [state, myId, autoPassing]);
}
