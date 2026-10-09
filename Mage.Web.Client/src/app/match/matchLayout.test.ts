import { describe, expect, test } from 'vitest';
import { matchLayout } from './matchLayout';
import { fitStage, MAX_TALL_HEIGHT, MIN_TALL_HEIGHT, STAGE_HEIGHT, STAGE_WIDTH, TALL_STAGE_WIDTH } from './stageContext';

const CARD_RATIO = 88 / 63;

describe('fitStage', () => {
  test('desktops and tablets on their side keep the wide stage', () => {
    expect(fitStage(1920, 1080)).toEqual({ layout: 'wide', width: STAGE_WIDTH, height: STAGE_HEIGHT, scale: 1 });
    expect(fitStage(1440, 900)).toMatchObject({ layout: 'wide', width: 1920, height: 1080 });
    const ipad = fitStage(1024, 768);
    expect(ipad).toMatchObject({ layout: 'wide', width: 1920 });
    expect(ipad.scale).toBeCloseTo(1024 / 1920);
    // an ultrawide widens the field
    expect(fitStage(2560, 1080).width).toBe(2560);
  });

  test('a tablet held upright gets the tall stage, as tall as its shape', () => {
    const ipad = fitStage(768, 1024);
    expect(ipad).toMatchObject({ layout: 'tall', width: TALL_STAGE_WIDTH, height: MIN_TALL_HEIGHT });
    expect(ipad.scale).toBeCloseTo(768 / 1080);
    expect(fitStage(820, 1180)).toMatchObject({ layout: 'tall', height: 1554 });
    expect(fitStage(800, 1280)).toMatchObject({ layout: 'tall', height: 1728 });
    // a phone's shape is clamped: the stage stays whole on screen
    const phone = fitStage(390, 844);
    expect(phone.height).toBe(MAX_TALL_HEIGHT);
    expect(phone.scale * MAX_TALL_HEIGHT).toBeLessThanOrEqual(844);
  });
});

describe('matchLayout', () => {
  test('wide: the field sits between the seat column and the stack and decision corner', () => {
    const layout = matchLayout({ layout: 'wide', width: 1920, height: 1080 });
    expect(layout.tall).toBe(false);
    expect(layout.fieldLeft).toBe(300);
    expect(layout.fieldWidth).toBe(1920 - 300 - 470);
    expect(layout.seam).toBe(540);
    expect(layout.them(1, 2).left).toBeCloseTo(300 + 1150 / 2);
  });

  test.each([1440, 1554, 1728, 1920])('tall %i: top band, their rows, the turn, your rows, your band, the hand, in that order', (height) => {
    const layout = matchLayout({ layout: 'tall', width: 1080, height });
    const them = layout.them(0, 1);
    const me = layout.me;
    expect(layout.fieldWidth).toBe(1080 - 48);
    expect(them.backTop).toBeGreaterThan(layout.theirPiles.top);
    expect(them.frontTop).toBeGreaterThanOrEqual(them.backTop + them.backIdeal * CARD_RATIO);
    // the turn ladder (about 70 tall) fits between the creature rows, at the seam
    expect(layout.seam - 35).toBeGreaterThan(them.frontTop + them.frontIdeal * CARD_RATIO);
    expect(layout.seam + 35).toBeLessThan(me.frontTop);
    expect(me.backTop).toBeGreaterThanOrEqual(me.frontTop + me.frontIdeal * CARD_RATIO);
    expect(layout.myPlate.top).toBeGreaterThan(me.backTop + me.backIdeal * CARD_RATIO);
    expect(layout.playLine).toBeLessThan(height - 118 - layout.handRaise);
    expect(layout.handRaise).toBeGreaterThanOrEqual(0);
  });

  test('the same size gives the same objects, so memoized rows keep their props', () => {
    const a = matchLayout({ layout: 'tall', width: 1080, height: 1554 });
    const b = matchLayout({ layout: 'tall', width: 1080, height: 1554 });
    expect(a).toBe(b);
    expect(a.them(0, 2)).toBe(b.them(0, 2));
    expect(a.them(0, 2)).not.toBe(a.them(1, 2));
  });
});
