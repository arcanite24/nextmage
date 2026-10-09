import { useEffect, useRef } from 'react';
import type { GameSessionState } from '../../core/game/gameSession';
import { useCareerVoice } from '../stores/careerVoice';
import { useEmotes } from './emotes';
import { pickVoice, voiceSnapshot, type VoiceMoment, type VoiceSnapshot } from './voiceRules';

/**
 * A Career opponent talks at the table: a line as the game starts, at their big play, when their life runs low, and at
 * the end, each in a bubble on their seat like an emote. Only in Career games, and muting the opponent hides them too.
 */
export function useOpponentVoice(state: GameSessionState, myId: string | null, career: boolean) {
  const lines = useCareerVoice((voice) => voice.lines);
  const previous = useRef<VoiceSnapshot | null>(null);
  const said = useRef(new Set<VoiceMoment>());
  const gameId = state.gameId;

  useEffect(() => {
    previous.current = null;
    said.current = new Set();
  }, [gameId]);

  useEffect(() => {
    if (!career || !lines || state.mode !== 'play') return;
    const now = voiceSnapshot(state, myId);
    const moment = pickVoice(previous.current, now, said.current);
    previous.current = now;
    if (!moment || !now.foe) return;
    said.current.add(moment);
    const line = lines[moment];
    if (!line || useEmotes.getState().muted[gameId]) return;
    useEmotes.getState().show(now.foe, line);
  }, [state, myId, career, lines, gameId]);
}
