import { audio, type Bus } from '../match/sound';
import { useSettings } from '../stores/settings';

/**
 * Career's menu music: a slow, quiet pad that never repeats exactly, synthesized like every other sound (nothing to
 * license or download). It plays only on Career's screens, fades out for a game, and follows Settings: the sound
 * switch, the master volume and the music volume.
 */

/** A folk-ish loop of four chords (A minor, F, C, G), as frequencies: bass, then the pad's three voices. */
const CHORDS: [number, number[]][] = [
  [110, [220, 261.63, 329.63]],
  [87.31, [174.61, 220, 261.63]],
  [130.81, [196, 261.63, 329.63]],
  [98, [196, 246.94, 293.66]],
];
/** the pentatonic notes the bells pick from, over every chord */
const BELLS = [440, 523.25, 587.33, 659.25, 783.99, 880];
const BAR = 6.4;
const LOOKAHEAD = 2.5;
const FADE = 1.4;

interface Player {
  bus: Bus;
  master: GainNode;
  pad: BiquadFilterNode;
  timer: number;
  next: number;
  bar: number;
}

let player: Player | null = null;
let seed = 7;

function random(): number {
  // a small fixed-seed generator: the bells wander, but no two visits start the same way
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function level(): number {
  const { sound, volume, careerMusic, musicVolume } = useSettings.getState().settings;
  if (!sound || !careerMusic) return 0;
  return volume * volume * musicVolume * 0.32;
}

function voice({ ctx }: Bus, out: AudioNode, freq: number, start: number, length: number, gain: number, type: OscillatorType) {
  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 1.6);
    env.gain.setValueAtTime(gain, start + length - 1.2);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length + 1.4);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + length + 1.5);
  }
}

function pluck({ ctx }: Bus, out: AudioNode, freq: number, start: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(0.05, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + 2.5);
}

function schedule(p: Player) {
  const { ctx } = p.bus;
  while (p.next < ctx.currentTime + LOOKAHEAD) {
    const [bass, pad] = CHORDS[p.bar % CHORDS.length];
    voice(p.bus, p.pad, bass, p.next, BAR, 0.08, 'sine');
    pad.forEach((freq) => voice(p.bus, p.pad, freq, p.next, BAR, 0.035, 'triangle'));
    // two or three bells somewhere in the bar
    const bells = 2 + Math.floor(random() * 2);
    for (let i = 0; i < bells; i++) {
      pluck(p.bus, p.master, BELLS[Math.floor(random() * BELLS.length)], p.next + 0.8 + random() * (BAR - 1.6));
    }
    p.next += BAR;
    p.bar++;
  }
}

/** Starts the music (or brings it back up); safe to call again while it plays. */
export function startCareerMusic() {
  const target = level();
  if (player) {
    setMusicLevel(target);
    return;
  }
  if (target <= 0) return;
  const bus = audio();
  if (!bus) return;
  const { ctx } = bus;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(target, ctx.currentTime + FADE * 2);
  master.connect(bus.input);
  const pad = ctx.createBiquadFilter();
  pad.type = 'lowpass';
  pad.frequency.value = 950;
  pad.Q.value = 0.4;
  pad.connect(master);
  seed = 1 + Math.floor(Math.random() * 100000);
  const next: Player = { bus, master, pad, timer: 0, next: ctx.currentTime + 0.1, bar: 0 };
  schedule(next);
  next.timer = window.setInterval(() => schedule(next), 1000);
  player = next;
}

/** Fades the music out and stops it. */
export function stopCareerMusic() {
  const current = player;
  if (!current) return;
  player = null;
  window.clearInterval(current.timer);
  const { ctx } = current.bus;
  current.master.gain.cancelScheduledValues(ctx.currentTime);
  current.master.gain.setValueAtTime(Math.max(current.master.gain.value, 0.0001), ctx.currentTime);
  current.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE);
  window.setTimeout(() => current.master.disconnect(), (FADE + 0.2) * 1000);
}

/** Follows a change of the music's level (Settings changed while it plays); silence stops it. */
export function setMusicLevel(target = level()) {
  if (!player) return;
  if (target <= 0) {
    stopCareerMusic();
    return;
  }
  const { ctx } = player.bus;
  player.master.gain.cancelScheduledValues(ctx.currentTime);
  player.master.gain.setTargetAtTime(target, ctx.currentTime, 0.3);
}

export function careerMusicPlaying(): boolean {
  return player !== null;
}
