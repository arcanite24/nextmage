import { describe, expect, it } from 'vitest';
import {
  addRule, alwaysAnswerCommands, answerLabel, autoAnswerKey, autoOrderPick, clearRules, isTriggerOrderPrompt,
  resetCommand, triggerLabel, triggerOrderCommands, type AutoRule,
} from './autoAnswer';
import { parsePrompt } from './prompt';

const ask = (options: Record<string, unknown>) => parsePrompt('GAME_ASK', { message: 'Use {this}?', options: options as never });
const triggers = parsePrompt('GAME_TARGET', {
  message: 'Pick triggered ability (goes to the stack first)',
  options: { queryType: 'PICK_ABILITY' } as never,
  cardsView1: { a1: { id: 'a1', name: 'Ability', rules: ['Whenever another creature enters, you gain 1 life.'] }, a2: { id: 'a2', name: 'Ability' } },
  flag: true,
});

describe('autoAnswerKey', () => {
  it('uses the key the server remembers answers under', () => {
    expect(autoAnswerKey(ask({ autoAnswerMessage: "Use <font color='red'>{this}</font>?" }))).toBe("Use <font color='red'>{this}</font>?");
  });
  it('offers nothing for questions without one, the mulligan, or other prompts', () => {
    expect(autoAnswerKey(ask({}))).toBeNull();
    expect(autoAnswerKey(ask({ autoAnswerMessage: 'Mulligan?', 'UI.left.btn.text': 'Mulligan' }))).toBeNull();
    expect(autoAnswerKey(triggers)).toBeNull();
    expect(autoAnswerKey(null)).toBeNull();
  });
});

describe('trigger order', () => {
  it('recognizes the trigger order question', () => {
    expect(isTriggerOrderPrompt(triggers)).toBe(true);
    expect(isTriggerOrderPrompt(parsePrompt('GAME_TARGET', { message: 'Choose a card', options: { queryType: 'PICK_TARGET' } as never, cardsView1: { c: { id: 'c' } } }))).toBe(false);
    expect(isTriggerOrderPrompt(parsePrompt('GAME_TARGET', { message: 'Pick triggered ability (goes to the stack first)', cardsView1: { c: { id: 'c' } } }))).toBe(true);
  });

  it('puts a trigger first by choosing it, last by asking again without it', () => {
    expect(triggerOrderCommands('a1', 'first')).toEqual([
      { type: 'action', action: 'TRIGGER_AUTO_ORDER_ABILITY_FIRST', data: 'a1' },
      { type: 'uuid', id: 'a1' },
    ]);
    expect(triggerOrderCommands('a1', 'last')).toEqual([
      { type: 'action', action: 'TRIGGER_AUTO_ORDER_ABILITY_LAST', data: 'a1' },
      { type: 'uuid', id: null },
    ]);
  });

  it('orders automatically by taking the first trigger listed', () => {
    expect(autoOrderPick(triggers)).toBe('a1');
    expect(autoOrderPick(ask({}))).toBeNull();
  });

  it('labels triggers with their source', () => {
    expect(triggerLabel({ id: 'x', name: 'Ability', sourceName: 'Soul Warden', rules: ['Whenever {this} attacks, draw.'] } as never))
      .toBe('Soul Warden: Whenever Soul Warden attacks, draw.');
    expect(triggerLabel({ id: 'x', name: 'Ability', rules: ['<i>Gain</i> 1 life.'] })).toBe('Gain 1 life.');
  });
});

describe('answers', () => {
  it('sends the standing answer, then answers the question', () => {
    expect(alwaysAnswerCommands('k', true)).toEqual([
      { type: 'action', action: 'REQUEST_AUTO_ANSWER_TEXT_YES', data: 'k' },
      { type: 'boolean', value: true },
    ]);
    expect(alwaysAnswerCommands('k', false)[0]).toMatchObject({ action: 'REQUEST_AUTO_ANSWER_TEXT_NO' });
    expect(resetCommand('answer')).toEqual({ type: 'action', action: 'REQUEST_AUTO_ANSWER_RESET_ALL' });
    expect(resetCommand('trigger')).toEqual({ type: 'action', action: 'TRIGGER_AUTO_ORDER_RESET_ALL' });
  });

  it('labels questions for people', () => {
    expect(answerLabel("Use <font color='red'>{this}</font>'s ability?")).toBe("Use this's ability?");
  });
});

describe('rules', () => {
  const rule = (gameId: string, kind: AutoRule['kind'], label: string, choice: AutoRule['choice']): AutoRule => ({ gameId, kind, label, choice });

  it('replaces a rule about the same thing', () => {
    const rules = addRule([rule('g', 'answer', 'Q', 'yes')], rule('g', 'answer', 'Q', 'no'));
    expect(rules).toEqual([rule('g', 'answer', 'Q', 'no')]);
    expect(addRule(rules, rule('h', 'answer', 'Q', 'yes'))).toHaveLength(2);
  });

  it('clears one kind for one game', () => {
    const rules = [rule('g', 'answer', 'Q', 'yes'), rule('g', 'trigger', 'T', 'first'), rule('h', 'answer', 'Q', 'no')];
    expect(clearRules(rules, 'g', 'answer')).toEqual([rule('g', 'trigger', 'T', 'first'), rule('h', 'answer', 'Q', 'no')]);
  });
});
