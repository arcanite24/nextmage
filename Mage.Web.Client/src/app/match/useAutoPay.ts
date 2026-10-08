import { useEffect, useRef } from 'react';
import { manaOf, nextSource, parseCost, type ManaSource } from '../../core/game/autoPay';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import type { PlayerBoard } from './boardModel';

const TAP_DELAY_MS = 220;

/**
 * Pays mana costs for the player when the payment is unambiguous: taps one source, waits for the server to ask
 * for the rest, and repeats. Stops (leaving the payment to the player) as soon as a choice would be needed or a tap
 * doesn't change what's still owed.
 */
export function useAutoPay(session: GameSession, state: GameSessionState, me: PlayerBoard | null, enabled: boolean) {
  const lastAsk = useRef<{ text: string; tries: number } | null>(null);
  const { interaction, awaitingServer } = state;
  const prompt = interaction.prompt;

  useEffect(() => {
    if (!enabled || !me || awaitingServer || interaction.mode !== 'payMana' || prompt?.kind !== 'playMana' || prompt.isX) {
      if (interaction.mode !== 'payMana') lastAsk.current = null;
      return;
    }
    const text = prompt.text;
    // the same request again after a tap means the tap didn't help: hand the payment back to the player
    if (lastAsk.current?.text === text && lastAsk.current.tries >= 1) return;
    const cost = parseCost(text);
    if (!cost) return;

    const permanents = new Map(me.back.concat(me.front).flatMap((group) => group.members).map((permanent) => [permanent.id!, permanent]));
    const sources: ManaSource[] = [];
    for (const id of interaction.clickable.keys()) {
      const permanent = permanents.get(id);
      if (!permanent || permanent.tapped) continue;
      const produces = manaOf(permanent);
      if (produces === undefined) continue;
      sources.push({ id, produces, isLand: (permanent.cardTypes ?? []).includes('LAND') });
    }
    const next = nextSource(cost, sources);
    if (!next) return;

    const timer = setTimeout(() => {
      lastAsk.current = { text, tries: lastAsk.current?.text === text ? lastAsk.current.tries + 1 : 1 };
      session.click(next);
    }, TAP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, me, awaitingServer, interaction, prompt, session]);
}
