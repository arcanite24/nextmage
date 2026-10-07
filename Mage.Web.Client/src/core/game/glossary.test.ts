import { describe, expect, it } from 'vitest';
import type { CardView } from '../../protocol/generated/views';
import { explainCard } from './glossary';

const creature = (rules: string[]): CardView => ({ name: 'Test', cardTypes: ['CREATURE'], rules });

describe('explainCard', () => {
  it('classifies keyword, triggered, activated and static lines', () => {
    const { lines } = explainCard(creature([
      'Flying, vigilance',
      'When Test enters, draw a card.',
      '{2}{G}, {T}: Put a +1/+1 counter on target creature.',
      'Other creatures you control get +1/+1.',
    ]));
    expect(lines.map((line) => line.kind)).toEqual(['keyword', 'triggered', 'activated', 'static']);
  });

  it('explains keywords and actions, once each, in order', () => {
    const { terms } = explainCard(creature(['Flying, lifelink', 'Whenever Test attacks, scry 1.', 'Creatures you control have flying.']));
    expect(terms.map((term) => term.name)).toEqual(['Flying', 'Lifelink', 'Scry']);
  });

  it('recognizes keywords with costs and ability words', () => {
    const { lines, terms } = explainCard(creature(['Ward {2}', 'Landfall — Whenever a land enters the battlefield under your control, Test gets +2/+2 until end of turn.']));
    expect(lines[1]).toMatchObject({ kind: 'triggered', abilityWord: 'Landfall' });
    expect(terms.map((term) => term.name)).toEqual(['Ward', 'Landfall']);
  });

  it("doesn't read keywords out of reminder text, card names or +1/+1 counters", () => {
    const { terms } = explainCard(creature([
      'Trample <i>(This creature can deal excess combat damage to the player or planeswalker it\'s attacking.)</i>',
      'Shadow of Doubt deals 2 damage.',
      'Put a +1/+1 counter on it.',
    ]));
    expect(terms.map((term) => term.name)).toEqual(['Trample']);
  });

  it('marks loyalty abilities and spell effects', () => {
    expect(explainCard({ cardTypes: ['PLANESWALKER'], rules: ['+1: Draw a card.', '−3: Destroy target creature.'] }).lines.map((line) => line.kind))
      .toEqual(['loyalty', 'loyalty']);
    expect(explainCard({ cardTypes: ['INSTANT'], rules: ['Counter target spell.'] })).toMatchObject({
      lines: [{ kind: 'spell' }],
      terms: [{ name: 'Counter' }],
    });
  });
});

describe('hints', () => {
  it('splits the live hints from the rules and reads their icon', () => {
    const card = creature([
      'Deathtouch',
      '<i>Revolt</i> &mdash; {this} enters with a +1/+1 counter on it if a permanent you controlled left the battlefield this turn.',
      '<br/><hintstart/>ICON_BAD<font color=#ff0000>A permanent left the battlefield under your control this turn</font>',
    ]);
    const { lines, hints, terms } = explainCard(card);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ kind: 'static', abilityWord: 'Revolt' });
    expect(lines[1].text).toContain('Test enters');
    expect(hints).toEqual([{ text: 'A permanent left the battlefield under your control this turn', tone: 'bad' }]);
    expect(terms.map((term) => term.name)).toEqual(['Deathtouch', 'Revolt']);
  });
});
