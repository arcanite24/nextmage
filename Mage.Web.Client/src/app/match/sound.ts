import { useSettings } from '../stores/settings';

/**
 * Game cues, synthesized with Web Audio: no sound files to license or load. Each cue is short and quiet,
 * tuned to sit under conversation: felt more than heard, like cards on a mat.
 */
export type Cue = 'turn' | 'decide' | 'cast' | 'damage' | 'draw' | 'attack' | 'victory' | 'defeat';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  context ??= new AudioContext();
  // browsers start the context suspended until a user gesture; game cues always follow one
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
}

function tone(ctx: AudioContext, out: AudioNode, { freq, start, length, type = 'sine', gain = 0.3, slide }: {
  freq: number;
  start: number;
  length: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
}) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, start + length);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function noise(ctx: AudioContext, out: AudioNode, { start, length, from, to, gain = 0.25 }: {
  start: number;
  length: number;
  from: number;
  to: number;
  gain?: number;
}) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(env).connect(out);
  source.start(start);
}

export function playCue(cue: Cue) {
  const { sound, volume } = useSettings.getState().settings;
  if (!sound || volume <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.value = volume * 0.5;
  out.connect(ctx.destination);
  const t = ctx.currentTime + 0.01;
  switch (cue) {
    case 'turn':
      // two soft bell partials: your turn
      tone(ctx, out, { freq: 523.25, start: t, length: 0.5, type: 'triangle', gain: 0.22 });
      tone(ctx, out, { freq: 783.99, start: t + 0.09, length: 0.6, type: 'triangle', gain: 0.18 });
      break;
    case 'decide':
      tone(ctx, out, { freq: 880, start: t, length: 0.12, gain: 0.08 });
      break;
    case 'cast':
      noise(ctx, out, { start: t, length: 0.28, from: 600, to: 3200, gain: 0.16 });
      tone(ctx, out, { freq: 392, start: t + 0.05, length: 0.3, type: 'sine', gain: 0.08, slide: 784 });
      break;
    case 'damage':
      tone(ctx, out, { freq: 120, start: t, length: 0.25, type: 'sine', gain: 0.4, slide: 55 });
      noise(ctx, out, { start: t, length: 0.12, from: 400, to: 150, gain: 0.18 });
      break;
    case 'draw':
      noise(ctx, out, { start: t, length: 0.09, from: 2500, to: 5000, gain: 0.1 });
      break;
    case 'attack':
      tone(ctx, out, { freq: 98, start: t, length: 0.22, type: 'triangle', gain: 0.35 });
      tone(ctx, out, { freq: 98, start: t + 0.16, length: 0.3, type: 'triangle', gain: 0.3 });
      break;
    case 'victory':
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, out, { freq, start: t + i * 0.11, length: 0.7, type: 'triangle', gain: 0.18 }));
      break;
    case 'defeat':
      [392, 311.13, 261.63].forEach((freq, i) => tone(ctx, out, { freq, start: t + i * 0.16, length: 0.8, type: 'sine', gain: 0.16 }));
      break;
  }
}
