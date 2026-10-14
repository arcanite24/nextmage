import { useEffect, useRef } from 'react';
import { abilityFor, handNeeds, manaOf, nextTap, parseCost, type ManaSource, type ManaTap } from '../../core/game/autoPay';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import type { PlayerBoard } from './boardModel';

const TAP_DELAY_MS = 220;

/**
 * Pays mana costs for the player when the payment is unambiguous: taps one source, waits for the server to ask
 * for the rest, and repeats. When the server asks which of a dual land's abilities to use, answers with the color
 * the plan tapped it for. Stops (leaving the payment to the player) as soon as a real choice would be needed or a
 * tap doesn't change what's still owed.
 */
export function useAutoPay(session: GameSession, state: GameSessionState, me: PlayerBoard | null, enabled: boolean) {
  const lastAsk = useRef<{ text: string; tries: number } | null>(null);
  const lastTap = useRef<ManaTap | null>(null);
  const { interaction, awaitingServer, view } = state;
  const prompt = interaction.prompt;

  useEffect(() => {
    // the server asks which mana ability of the land we just tapped: the one making the planned color
    if (enabled && !awaitingServer && prompt?.kind === 'chooseAbility' && lastTap.current) {
      const ability = abilityFor(prompt.choices, lastTap.current.color);
      lastTap.current = null;
      if (ability) void session.respond({ type: 'uuid', id: ability }).catch(() => undefined);
      return;
    }
    if (!enabled || !me || awaitingServer || interaction.mode !== 'payMana' || prompt?.kind !== 'playMana' || prompt.isX) {
      if (interaction.mode !== 'payMana') {
        lastAsk.current = null;
        lastTap.current = null;
      }
      return;
    }
    // a new payment request: the last tap was answered, so a later ability question is the player's own
    lastTap.current = null;
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
      const colors = manaOf(permanent);
      if (colors === undefined) continue;
      sources.push({ id, colors, isLand: (permanent.cardTypes ?? []).includes('LAND') });
    }
    // generic mana leaves untapped the colors the rest of the hand still needs this turn
    const owed = cost.generic + Object.values(cost.colored).reduce((sum, value) => sum + (value ?? 0), 0);
    const handCosts = Object.values(view?.myHand ?? {}).map((card) => (card.manaCostLeftStr ?? []).join(''));
    const next = nextTap(cost, sources, handNeeds(handCosts, sources.length - owed));
    if (!next) return;

    const timer = setTimeout(() => {
      lastAsk.current = { text, tries: lastAsk.current?.text === text ? lastAsk.current.tries + 1 : 1 };
      lastTap.current = next;
      session.click(next.id);
    }, TAP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, me, awaitingServer, interaction, prompt, session, view]);
}
