/**
 * Greasefang, Okiba Boss returns a Vehicle at the beginning of combat; it has to be crewed before attackers are
 * declared. Plays games against the AI with the app's default preferences and auto-pass, and checks the player gets
 * priority at their beginning of combat with the Vehicle back and its Crew ability ready.
 *   MAGE_LIVE_SERVER=1 npx vitest run src/core/headless/greasefang
 */
import { describe, expect, test } from 'vitest';
import { attackEnablers, autoAnswer } from '../game/autoPass';
import { DEFAULT_SETTINGS, toUserData } from '../../app/stores/settings';
import { deck, playBotGame } from './botGame';
import type { Command } from '../game/interaction';

const SERVER_URL = process.env.MAGE_SERVER_URL ?? 'ws://127.0.0.1:17172';
const live = process.env.MAGE_LIVE_SERVER === '1';

const GREASEFANG = deck('Greasefang', [
  [8, 'Plains'],
  [8, 'Swamp'],
  [12, 'Greasefang, Okiba Boss'],
  // too expensive to cast: they reach the graveyard by discarding to hand size
  [32, 'Parhelion II'],
]);

describe.skipIf(!live)('Greasefang against the AI', () => {
  test.each([['on', true], ['off', false]])('the returned Vehicle can be crewed at the beginning of combat (auto-pass %s)', async (_label, autoPass) => {
    const log: string[] = [];
    let triggered = false;
    let crewOffered = false;
    let attackedUncrewed = false;
    const settings = { ...DEFAULT_SETTINGS, autoPass };

    for (let game = 0; game < 6 && !crewOffered && !attackedUncrewed; game++) {
      await playBotGame({
        serverUrl: SERVER_URL,
        userName: `grease${Date.now() % 100000}`,
        deck: GREASEFANG,
        maxTurns: 16,
        timeoutMs: 600_000,
        userData: toUserData(settings),
        intercept(state): Command | undefined {
          const view = state.view;
          if (!view || view.activePlayerId !== view.myPlayerId) return undefined;
          const vehicles = Object.values(view.players?.find((p) => p.playerId === view.myPlayerId)?.battlefield ?? {})
            .filter((card) => card.subTypes?.includes('VEHICLE'));
          const stack = Object.values(view.stack ?? {}).map((item) => item.name);
          if (view.step === 'BEGIN_COMBAT' || (state.interaction.mode === 'declareAttackers' && vehicles.length > 0)) {
            const answer = autoAnswer(view, state.prompt, {
              autoPass: settings.autoPass,
              autoSkipCombat: settings.autoSkipCombat,
              abilitiesOnTheirTurn: settings.abilitiesOnTheirTurn,
              combatStops: settings.combatStops,
              beginCombatStop: !!settings.stops.yourTurn?.beforeCombat,
            });
            log.push(`t${view.turn} ${view.step} ${state.interaction.mode} stack=[${stack.join(', ')}] vehicles=${vehicles.length} enablers=${attackEnablers(view).length} auto=${answer}`);
            // the server names a triggered ability on the stack "Ability"; Greasefang's is the one at the beginning of combat
            if (view.step === 'BEGIN_COMBAT' && stack.length > 0) triggered = true;
            if (view.step === 'BEGIN_COMBAT' && state.interaction.mode === 'priority' && vehicles.length > 0 && stack.length === 0) {
              if (answer === null && attackEnablers(view).length > 0) {
                crewOffered = true;
                return { type: 'action', action: 'CONCEDE' };
              }
            }
            if (state.interaction.mode === 'declareAttackers' && triggered) {
              attackedUncrewed = true;
              return { type: 'action', action: 'CONCEDE' };
            }
            // what the app would do; with auto-pass off the player passes the rest of their beginning of combat by hand
            if (state.interaction.mode === 'priority' && (answer === 'pass' || !autoPass)) return { type: 'boolean', value: false };
          }
          return undefined;
        },
      }).catch((error: unknown) => log.push(`game ${game}: ${String(error)}`));
    }
    console.log(`[greasefang, auto-pass ${autoPass ? 'on' : 'off'}]\n${log.join('\n')}`);
    expect(attackedUncrewed).toBe(false);
    expect(crewOffered).toBe(true);
  }, 3_600_000);
});
