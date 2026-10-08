import { describe, expect, it } from 'vitest';
import { parsePrompt } from './prompt';
import { pregameChoice } from './pregame';

const players = new Set(['me', 'them']);
const hand = new Set(['c1', 'c2']);

function target(targets: string[], options: Record<string, unknown> = {}) {
  return parsePrompt('GAME_TARGET', { message: 'Select a card', targets, options: options as never, flag: true });
}

describe('pre-game prompts', () => {
  it('reads the mulligan marker instead of the button text', () => {
    const marked = parsePrompt('GAME_ASK', { message: 'Take a mulligan?', options: { 'UI.left.btn.text': 'Again', webPrompt: 'mulligan' } });
    expect(marked).toMatchObject({ kind: 'ask', isMulligan: true, marker: 'mulligan' });
    // a marker for something else is never a mulligan, whatever the buttons say
    const other = parsePrompt('GAME_ASK', { message: 'x', options: { 'UI.left.btn.text': 'Mulligan', webPrompt: 'startingPlayer' } });
    expect(other).toMatchObject({ isMulligan: false });
  });

  it('falls back to the button text on servers without markers', () => {
    expect(parsePrompt('GAME_ASK', { message: 'Mulligan?', options: { 'UI.left.btn.text': 'Mulligan' } })).toMatchObject({ isMulligan: true, marker: null });
    expect(parsePrompt('GAME_ASK', { message: 'Use it?', options: { 'UI.left.btn.text': 'Yes' } })).toMatchObject({ isMulligan: false });
  });

  it('ignores unknown markers', () => {
    expect(parsePrompt('GAME_ASK', { message: 'x', options: { webPrompt: 'somethingNew' } })).toMatchObject({ marker: null });
  });

  it('takes the marker for the starting player and the London bottom', () => {
    const context = { pregame: false, clickable: ['me'], handIds: hand, playerIds: players };
    expect(pregameChoice(target(['me', 'them'], { webPrompt: 'startingPlayer' }), context)).toBe('startingPlayer');
    expect(pregameChoice(target(['c1'], { webPrompt: 'mulliganBottom' }), { ...context, clickable: ['c1'] })).toBe('mulliganBottom');
  });

  it('falls back to what can be chosen before the first turn', () => {
    expect(pregameChoice(target(['me', 'them']), { pregame: true, clickable: ['me', 'them'], handIds: hand, playerIds: players })).toBe('startingPlayer');
    expect(pregameChoice(target(['c1', 'c2']), { pregame: true, clickable: ['c1', 'c2'], handIds: hand, playerIds: players })).toBe('mulliganBottom');
    // during the game the same choices are ordinary targets
    expect(pregameChoice(target(['me', 'them']), { pregame: false, clickable: ['me', 'them'], handIds: hand, playerIds: players })).toBeNull();
    // a mixed choice is neither
    expect(pregameChoice(target(['me', 'c1']), { pregame: true, clickable: ['me', 'c1'], handIds: hand, playerIds: players })).toBeNull();
  });

  it('is never a pre-game choice for other prompts', () => {
    const ask = parsePrompt('GAME_ASK', { message: 'x', options: { webPrompt: 'mulligan' } });
    expect(pregameChoice(ask, { pregame: true, clickable: ['me'], handIds: hand, playerIds: players })).toBeNull();
    expect(pregameChoice(null, { pregame: true, clickable: ['me'], handIds: hand, playerIds: players })).toBeNull();
  });
});
