import { describe, expect, it } from 'vitest';
import { applyFilters, coverRect } from './printPress';

function filtered(rgb: [number, number, number], filters: Parameters<typeof applyFilters>[1]): number[] {
  const pixels = new Uint8ClampedArray([...rgb, 255]);
  applyFilters(pixels, filters);
  return [...pixels];
}

describe('applyFilters', () => {
  it('grayscale uses the spec luminance weights', () => {
    // 0.2126 * 255 = 54.2
    expect(filtered([255, 0, 0], [{ kind: 'grayscale', amount: 1 }])).toEqual([54, 54, 54, 255]);
  });

  it('contrast pivots on the middle and clamps each step', () => {
    expect(filtered([255, 128, 0], [{ kind: 'contrast', amount: 1.6 }])).toEqual([255, 128, 0, 255]);
    expect(filtered([191, 64, 128], [{ kind: 'contrast', amount: 2 }])).toEqual([255, 0, 129, 255]);
    // clamped after contrast, so brightness can't bring the lost highlight back
    expect(filtered([230, 230, 230], [{ kind: 'contrast', amount: 2 }, { kind: 'brightness', amount: 0.5 }])).toEqual([128, 128, 128, 255]);
  });

  it('a full hue turn and saturate(1) leave colours alone', () => {
    expect(filtered([200, 100, 50], [{ kind: 'hueRotate', degrees: 360 }])).toEqual([200, 100, 50, 255]);
    expect(filtered([200, 100, 50], [{ kind: 'saturate', amount: 1 }])).toEqual([200, 100, 50, 255]);
  });

  it('sepia tints grey toward brown', () => {
    const [r, g, b] = filtered([128, 128, 128], [{ kind: 'sepia', amount: 1 }]);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('keeps alpha', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 77]);
    applyFilters(pixels, [{ kind: 'brightness', amount: 2 }]);
    expect(pixels[3]).toBe(77);
  });
});

describe('coverRect', () => {
  it('covers the layer box (inset -2%) and anchors the art 30% down', () => {
    // a wide art in a tall box: height decides
    const rect = coverRect(600, 400, 1000, 1000);
    expect(rect.h).toBeCloseTo(1040);
    expect(rect.w).toBeCloseTo(1560);
    expect(rect.x).toBeCloseTo(-20 + (1040 - 1560) / 2);
    expect(rect.y).toBeCloseTo(-20);
  });

  it('puts the spare height 30% above and 70% below', () => {
    const rect = coverRect(400, 400, 1000, 500);
    expect(rect.w).toBeCloseTo(1040);
    expect(rect.y).toBeCloseTo(-10 + (520 - 1040) * 0.3);
  });
});
