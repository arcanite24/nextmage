import type { ChatSoundToPlay } from '../types/index.js';
import type { ClientSettings } from './AppConfigService.js';

type AudioCueKind = 'game' | 'draft' | 'skip' | 'other' | 'whisper';

const CUE_FREQUENCIES: Record<ChatSoundToPlay | AudioCueKind, number> = {
  PlayerLeft: 220,
  PlayerQuitTournament: 196,
  PlayerSubmittedDeck: 392,
  PlayerWhispered: 660,
  game: 330,
  draft: 523,
  skip: 294,
  other: 440,
  whisper: 660,
};

class AudioFeedbackService {
  private audioContext: AudioContext | null = null;
  private musicOscillator: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;

  unlock(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return false;
    this.audioContext ??= new AudioContextCtor();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return true;
  }

  playChatCue(cue: ChatSoundToPlay, settings: ClientSettings): void {
    if (!shouldPlayChatCue(cue, settings)) return;
    this.playTone(CUE_FREQUENCIES[cue], settings);
  }

  playSkipCue(settings: ClientSettings): void {
    if (!settings.skipButtonSoundsEnabled) return;
    this.playTone(CUE_FREQUENCIES.skip, settings);
  }

  startMatchMusic(settings: ClientSettings): void {
    if (!settings.matchMusicEnabled || settings.reducedAudioMode || settings.masterVolume <= 0 || settings.musicVolume <= 0) {
      this.stopMatchMusic();
      return;
    }
    if (!this.unlock() || !this.audioContext) return;

    const volume = (settings.masterVolume / 100) * (settings.musicVolume / 100) * 0.025;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.08);
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 110;
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start();
    this.musicOscillator = oscillator;
    this.musicGain = gain;
  }

  stopMatchMusic(): void {
    if (!this.audioContext || !this.musicOscillator || !this.musicGain) return;
    const now = this.audioContext.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(0.0001, now, 0.08);
    this.musicOscillator.stop(now + 0.25);
    this.musicOscillator.disconnect();
    this.musicGain.disconnect();
    this.musicOscillator = null;
    this.musicGain = null;
  }

  private playTone(frequency: number, settings: ClientSettings): void {
    if (settings.reducedAudioMode || settings.masterVolume <= 0 || settings.effectsVolume <= 0) return;
    if (!this.unlock() || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const volume = (settings.masterVolume / 100) * (settings.effectsVolume / 100) * 0.08;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }
}

function shouldPlayChatCue(cue: ChatSoundToPlay, settings: ClientSettings): boolean {
  if (cue === 'PlayerWhispered') return settings.otherSoundsEnabled;
  if (cue === 'PlayerSubmittedDeck' || cue === 'PlayerQuitTournament') return settings.draftSoundsEnabled || settings.gameSoundsEnabled;
  return settings.gameSoundsEnabled || settings.otherSoundsEnabled;
}

export const audioFeedbackService = new AudioFeedbackService();
