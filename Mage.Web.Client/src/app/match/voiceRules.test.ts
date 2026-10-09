import { describe, expect, test } from 'vitest';
import { pickVoice, type VoiceMoment, type VoiceSnapshot } from './voiceRules';

const at = (over: Partial<VoiceSnapshot> = {}): VoiceSnapshot => ({ foe: 'Wren', turn: 1, step: 'MAIN1', foeLife: 20, foeBigSpell: false, over: false, won: false, ...over });
const said = (...moments: VoiceMoment[]) => new Set(moments);

describe('pickVoice', () => {
  test('greets once play is under way (not over the opening hands), and only once', () => {
    expect(pickVoice(null, at(), said())).toBeNull();
    expect(pickVoice(at({ step: 'UPKEEP' }), at({ step: 'UPKEEP' }), said())).toBeNull();
    expect(pickVoice(at({ step: 'UPKEEP' }), at({ step: 'DRAW' }), said())).toBe('intro');
    expect(pickVoice(at({ turn: 2 }), at({ turn: 2 }), said())).toBe('intro');
    expect(pickVoice(at(), at({ turn: 2, step: 'DRAW' }), said('intro'))).toBeNull();
  });

  test('speaks up when a costly spell of theirs hits the stack', () => {
    expect(pickVoice(at(), at({ foeBigSpell: true }), said('intro'))).toBe('bigPlay');
    expect(pickVoice(at({ foeBigSpell: true }), at({ foeBigSpell: true }), said('intro'))).toBeNull();
    expect(pickVoice(at(), at({ foeBigSpell: true }), said('intro', 'bigPlay'))).toBeNull();
  });

  test('feels it when their life drops to the low mark', () => {
    expect(pickVoice(at({ foeLife: 7 }), at({ foeLife: 5 }), said('intro'))).toBe('lowLife');
    expect(pickVoice(at({ foeLife: 4 }), at({ foeLife: 3 }), said('intro'))).toBeNull();
  });

  test('has the last word: their loss when you won, their win when you lost', () => {
    expect(pickVoice(at(), at({ over: true, won: true }), said('intro'))).toBe('lose');
    expect(pickVoice(at(), at({ over: true, won: false }), said('intro'))).toBe('win');
    expect(pickVoice(at({ over: true }), at({ over: true }), said('intro', 'win'))).toBeNull();
  });

  test('stays quiet with no single opponent', () => {
    expect(pickVoice(null, at({ foe: null }), said())).toBeNull();
  });
});
