/**
 * The mat print, pressed once into a canvas. Live, it was three filtered copies of the art blended over each other
 * plus a dye and a halftone pass, all full screen: Chrome on Android tablets re-composited that stack whenever
 * anything above it moved, and flickered. Here the same separations are worked out once per art (CSS filter
 * maths on the pixels) and blended with the canvas's own composite modes, which follow the same compositing rules as
 * CSS mix-blend-mode in an isolated group, so the result looks the same and costs one flat layer.
 */

type FilterStep =
  | { kind: 'grayscale' | 'sepia' | 'saturate' | 'contrast' | 'brightness'; amount: number }
  | { kind: 'hueRotate'; degrees: number };

export interface Separation {
  filters: FilterStep[];
  blend: GlobalCompositeOperation;
  alpha: number;
}

/** Same values as the CSS separations in MatPrint.module.css. */
export const SEPARATIONS: Separation[] = [
  // deep shadows pressed into the green
  {
    filters: [{ kind: 'grayscale', amount: 1 }, { kind: 'contrast', amount: 1.6 }, { kind: 'brightness', amount: 0.55 }],
    blend: 'multiply',
    alpha: 0.85,
  },
  // ivory ink for the highlights
  {
    filters: [{ kind: 'grayscale', amount: 1 }, { kind: 'contrast', amount: 1.45 }, { kind: 'brightness', amount: 1.05 }, { kind: 'sepia', amount: 0.25 }],
    blend: 'screen',
    alpha: 0.32,
  },
  // a faint key layer that holds the image together
  {
    filters: [
      { kind: 'grayscale', amount: 1 }, { kind: 'contrast', amount: 1.2 }, { kind: 'brightness', amount: 0.8 },
      { kind: 'sepia', amount: 0.6 }, { kind: 'hueRotate', degrees: 85 }, { kind: 'saturate', amount: 1.4 },
    ],
    blend: 'soft-light',
    alpha: 0.55,
  },
];

type Matrix = [number, number, number, number, number, number, number, number, number];

/** Colour matrices from the Filter Effects spec (shorthand filter functions). */
function matrix(step: FilterStep): Matrix | null {
  switch (step.kind) {
    case 'grayscale': {
      const a = 1 - Math.min(1, step.amount);
      return [
        0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
      ];
    }
    case 'sepia': {
      const a = 1 - Math.min(1, step.amount);
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
      ];
    }
    case 'saturate': {
      const s = step.amount;
      return [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ];
    }
    case 'hueRotate': {
      const rad = (step.degrees * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    default:
      return null;
  }
}

const clamp = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Applies a CSS filter chain to RGBA pixels in place; each function's result is clamped, as in the browser. */
export function applyFilters(pixels: Uint8ClampedArray, filters: FilterStep[]): void {
  const steps = filters.map((step) => ({ step, m: matrix(step) }));
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i] / 255;
    let g = pixels[i + 1] / 255;
    let b = pixels[i + 2] / 255;
    for (const { step, m } of steps) {
      if (m) {
        const nr = m[0] * r + m[1] * g + m[2] * b;
        const ng = m[3] * r + m[4] * g + m[5] * b;
        const nb = m[6] * r + m[7] * g + m[8] * b;
        r = clamp(nr); g = clamp(ng); b = clamp(nb);
      } else if (step.kind === 'contrast') {
        const k = step.amount;
        r = clamp((r - 0.5) * k + 0.5); g = clamp((g - 0.5) * k + 0.5); b = clamp((b - 0.5) * k + 0.5);
      } else if (step.kind === 'brightness') {
        const k = step.amount;
        r = clamp(r * k); g = clamp(g * k); b = clamp(b * k);
      }
    }
    pixels[i] = Math.round(r * 255);
    pixels[i + 1] = Math.round(g * 255);
    pixels[i + 2] = Math.round(b * 255);
  }
}

/** Where `background-size: cover; background-position: 50% 30%` puts the art in a layer inset by -2%. */
export function coverRect(imageWidth: number, imageHeight: number, width: number, height: number) {
  const boxX = -0.02 * width;
  const boxY = -0.02 * height;
  const boxW = width * 1.04;
  const boxH = height * 1.04;
  const scale = Math.max(boxW / imageWidth, boxH / imageHeight);
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  return { x: boxX + (boxW - w) * 0.5, y: boxY + (boxH - h) * 0.3, w, h };
}

/** Longest side the art is filtered at: the print is soft, and this keeps the pixel work small. */
const ART_MAX = 768;

/**
 * The art's separations, filtered once.
 *
 * @throws when the image can't be read (a cross-origin picture without CORS): the caller prints it live instead
 */
export function separate(image: HTMLImageElement): HTMLCanvasElement[] {
  const fit = Math.min(1, ART_MAX / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * fit));
  const height = Math.max(1, Math.round(image.naturalHeight * fit));
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('no 2d canvas');
  sourceContext.drawImage(image, 0, 0, width, height);
  const original = sourceContext.getImageData(0, 0, width, height);
  return SEPARATIONS.map((separation) => {
    const pixels = new ImageData(new Uint8ClampedArray(original.data), width, height);
    applyFilters(pixels.data, separation.filters);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.putImageData(pixels, 0, 0);
    return canvas;
  });
}

export interface PressInk {
  /** --print-dye */
  dye: string;
  /** --shade-rgb, e.g. "8 12 10" */
  shade: string;
}

/**
 * Presses the print into `canvas` for a box of `width` x `height` CSS pixels at `scale` device pixels each: the
 * separations (if the art is in), then the dye and the halftone, like the live layers in that order.
 */
export function press(canvas: HTMLCanvasElement, layers: HTMLCanvasElement[], width: number, height: number, scale: number, ink: PressInk): void {
  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.imageSmoothingQuality = 'high';

  SEPARATIONS.forEach((separation, index) => {
    const layer = layers[index];
    if (!layer) return;
    const rect = coverRect(layer.width, layer.height, pixelWidth, pixelHeight);
    context.globalCompositeOperation = separation.blend;
    context.globalAlpha = separation.alpha;
    context.drawImage(layer, rect.x, rect.y, rect.w, rect.h);
  });

  // the print takes the mat's dye: hue from the neoprene, values from the art
  context.globalCompositeOperation = 'color';
  context.globalAlpha = 0.9;
  context.fillStyle = ink.dye;
  context.fillRect(0, 0, pixelWidth, pixelHeight);

  // printed halftone dots, 4 CSS pixels apart
  const pitch = Math.max(2, Math.round(4 * scale));
  const tile = document.createElement('canvas');
  tile.width = pitch;
  tile.height = pitch;
  const tileContext = tile.getContext('2d');
  if (tileContext) {
    const centre = pitch / 2;
    const outer = 1.3 * scale;
    const dot = tileContext.createRadialGradient(centre, centre, 0, centre, centre, outer);
    const colour = `rgb(${ink.shade} / 0.28)`;
    dot.addColorStop(0, colour);
    dot.addColorStop(0.9 / 1.3, colour);
    dot.addColorStop(1, 'rgb(0 0 0 / 0)');
    tileContext.fillStyle = dot;
    tileContext.fillRect(0, 0, pitch, pitch);
    const pattern = context.createPattern(tile, 'repeat');
    if (pattern) {
      context.globalCompositeOperation = 'multiply';
      context.globalAlpha = 1;
      context.fillStyle = pattern;
      context.fillRect(0, 0, pixelWidth, pixelHeight);
    }
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
}
