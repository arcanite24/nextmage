import React, { useEffect, useState } from 'react';
import { Navbar, type NavPage } from '../common/Navbar';
import { Button } from '../common';
import { audioFeedbackService, cardImageService, KEYBIND_ACTION_METADATA } from '../../services';
import {
  BATTLEFIELD_CARD_SIZE_MAX,
  BATTLEFIELD_CARD_SIZE_MIN,
  CARD_SIZE_MAX,
  CARD_SIZE_MIN,
  DEFAULT_KEYBINDS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type ClientKeybindConfig,
  type KeybindActionId,
} from '../../services/AppConfigService';
import type { ProfanityFilterLevel } from '../../services/ChatMessageService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { SkipPrioritySteps, UserSkipPrioritySteps } from '../../types';
import './SettingsPage.css';

interface SettingsPageProps {
  onExit: () => void;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  supportMenu?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

const FLAG_OPTIONS = [
  { value: 'world', label: 'World' },
  { value: 'us', label: 'United States' },
  { value: 'mx', label: 'Mexico' },
  { value: 'ca', label: 'Canada' },
  { value: 'br', label: 'Brazil' },
  { value: 'de', label: 'Germany' },
  { value: 'europeanunion', label: 'European Union' },
  { value: 'jp', label: 'Japan' },
];

const AUTO_TARGET_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Most' },
  { value: 2, label: 'All' },
];

const PROFANITY_FILTER_OPTIONS: Array<{ value: ProfanityFilterLevel; label: string }> = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Show warning' },
  { value: 2, label: 'Hide message' },
];

const IMAGE_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zhs', label: 'Chinese Simplified' },
  { value: 'zht', label: 'Chinese Traditional' },
];

const SKIP_STEP_OPTIONS: Array<{ key: keyof SkipPrioritySteps; label: string }> = [
  { key: 'upkeep', label: 'Upkeep' },
  { key: 'draw', label: 'Draw' },
  { key: 'main1', label: 'Main 1' },
  { key: 'beforeCombat', label: 'Before Combat' },
  { key: 'endOfCombat', label: 'End Combat' },
  { key: 'main2', label: 'Main 2' },
  { key: 'endOfTurn', label: 'End Turn' },
];

const PRIORITY_STOP_OPTIONS: Array<{ key: keyof Omit<UserSkipPrioritySteps, 'yourTurn' | 'opponentTurn'>; label: string }> = [
  { key: 'stopOnDeclareAttackers', label: 'Declare attackers' },
  { key: 'stopOnDeclareBlockersWithZeroPermanents', label: 'Declare blockers, no blockers' },
  { key: 'stopOnDeclareBlockersWithAnyPermanents', label: 'Declare blockers, blockers available' },
  { key: 'stopOnAllMainPhases', label: 'All main phases' },
  { key: 'stopOnAllEndPhases', label: 'All end phases' },
  { key: 'stopOnStackNewObjects', label: 'New stack objects' },
];

const KEYBIND_EVENT_OPTIONS = ['keydown', 'keyup'] as const;

export const SettingsPage: React.FC<SettingsPageProps> = ({ onExit, onNavigate, onLogout, supportMenu }) => {
  const { settings, setSetting, resetSettings } = useSettingsStore();
  const [cacheSummary, setCacheSummary] = useState('Loading...');
  const [missingImageSummary, setMissingImageSummary] = useState('No missing images recorded');
  const [cacheBusy, setCacheBusy] = useState(false);

  const updateSkipStep = React.useCallback((
    turn: 'yourTurn' | 'opponentTurn',
    step: keyof SkipPrioritySteps,
    value: boolean,
  ) => {
    setSetting('skipPrioritySteps', {
      ...settings.skipPrioritySteps,
      [turn]: {
        ...settings.skipPrioritySteps[turn],
        [step]: value,
      },
    });
  }, [settings.skipPrioritySteps, setSetting]);

  const updatePriorityStop = React.useCallback((
    key: keyof Omit<UserSkipPrioritySteps, 'yourTurn' | 'opponentTurn'>,
    value: boolean,
  ) => {
    setSetting('skipPrioritySteps', {
      ...settings.skipPrioritySteps,
      [key]: value,
    });
  }, [settings.skipPrioritySteps, setSetting]);

  const updateKeybind = React.useCallback((actionId: KeybindActionId, patch: Partial<ClientKeybindConfig>) => {
    setSetting('keybinds', {
      ...settings.keybinds,
      [actionId]: {
        ...settings.keybinds[actionId],
        ...patch,
      },
    });
  }, [settings.keybinds, setSetting]);

  const resetKeybind = React.useCallback((actionId: KeybindActionId) => {
    updateKeybind(actionId, DEFAULT_KEYBINDS[actionId]);
  }, [updateKeybind]);

  const unlockAudio = React.useCallback(() => {
    const unlocked = audioFeedbackService.unlock(settings);
    setSetting('browserAudioUnlocked', unlocked);
  }, [settings, setSetting]);

  const refreshCacheSummary = React.useCallback(async () => {
    const stats = await cardImageService.getCacheStats();
    setCacheSummary(`${stats.entryCount} images, ${formatBytes(stats.totalSize)} of ${settings.imageCacheMaxSizeMb} MB, ${stats.hitRate.toFixed(0)}% hit rate`);
    const missingImages = cardImageService.getMissingImageDiagnostics();
    setMissingImageSummary(missingImages.length === 0
      ? 'No missing images recorded'
      : `${missingImages.length} missing image${missingImages.length === 1 ? '' : 's'} recorded`);
  }, [settings.imageCacheMaxSizeMb]);

  useEffect(() => {
    void refreshCacheSummary();
  }, [refreshCacheSummary]);

  const clearCache = async () => {
    setCacheBusy(true);
    try {
      await cardImageService.clearAllCaches();
      await refreshCacheSummary();
    } finally {
      setCacheBusy(false);
    }
  };

  const trimCache = async () => {
    setCacheBusy(true);
    try {
      await cardImageService.clearOldCache(settings.imageCacheMaxAgeDays);
      await cardImageService.enforceCacheSizeLimit();
      await refreshCacheSummary();
    } finally {
      setCacheBusy(false);
    }
  };

  return (
    <div className="settings-page">
      <Navbar currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} supportMenu={supportMenu} />

      <main className="settings-shell">
        <div className="settings-header">
          <div>
            <h1>Client Settings</h1>
            <p>Profile, prompts, mana automation, and local image cache.</p>
          </div>
          <Button variant="secondary" onClick={onExit}>Back to Lobby</Button>
        </div>

        <section className="settings-grid">
          <div className="settings-panel settings-panel-wide">
            <h2>Profile</h2>
            <label className="setting-field">
              <span>
                <strong>Avatar ID</strong>
                <small>Sent to the server for lobby seats and player panels.</small>
              </span>
              <input
                type="number"
                min="1"
                max="9999"
                value={settings.avatarId}
                onChange={(event) => setSetting('avatarId', Number(event.target.value))}
                data-testid="settings-avatar-id"
              />
            </label>

            <label className="setting-field">
              <span>
                <strong>Flag</strong>
                <small>Country/flag resource name, without the image extension.</small>
              </span>
              <input
                list="settings-flag-options"
                value={settings.flagName}
                onChange={(event) => setSetting('flagName', event.target.value)}
                data-testid="settings-flag-name"
              />
              <datalist id="settings-flag-options">
                {FLAG_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </datalist>
            </label>
          </div>

          <div className="settings-panel">
            <h2>Game Feel</h2>
            <label className="setting-row">
              <span>
                <strong>Animations</strong>
                <small>Card movement, combat hits, and damage feedback.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.animationsEnabled}
                onChange={(event) => setSetting('animationsEnabled', event.target.checked)}
              />
            </label>

            <label className="setting-slider">
              <span>
                <strong>Animation speed</strong>
                <small>{settings.animationSpeed.toFixed(1)}x</small>
              </span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.animationSpeed}
                onChange={(event) => setSetting('animationSpeed', Number(event.target.value))}
              />
            </label>

            <label className="setting-slider">
              <span>
                <strong>Battlefield permanents</strong>
                <small>{settings.battlefieldCardSize}</small>
              </span>
              <input
                type="range"
                min={BATTLEFIELD_CARD_SIZE_MIN}
                max={BATTLEFIELD_CARD_SIZE_MAX}
                step="1"
                value={settings.battlefieldCardSize}
                onChange={(event) => setSetting('battlefieldCardSize', Number(event.target.value))}
                data-testid="settings-battlefield-card-size"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Life on avatar</strong>
                <small>Show life totals over match avatar images.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.displayLifeOnAvatar}
                onChange={(event) => setSetting('displayLifeOnAvatar', event.target.checked)}
                data-testid="settings-life-on-avatar"
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Mana</h2>
            <label className="setting-row">
              <span>
                <strong>Auto-pay mana</strong>
                <small>Send Java's mana pool automatic preference on connect.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoTapManaPayment}
                onChange={(event) => setSetting('autoTapManaPayment', event.target.checked)}
                data-testid="settings-mana-automatic"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Restrict auto-pay</strong>
                <small>Only use one automatic mana source when Java would restrict payment.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.manaPoolAutomaticRestricted}
                onChange={(event) => setSetting('manaPoolAutomaticRestricted', event.target.checked)}
                data-testid="settings-mana-restricted"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Use first mana ability</strong>
                <small>Prefer the first available mana ability on lands.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.useFirstManaAbility}
                onChange={(event) => setSetting('useFirstManaAbility', event.target.checked)}
                data-testid="settings-use-first-mana-ability"
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Prompts</h2>
            <label className="setting-row">
              <span>
                <strong>Allow hand requests</strong>
                <small>Let other players ask to view your hand.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.allowRequestShowHandCards}
                onChange={(event) => setSetting('allowRequestShowHandCards', event.target.checked)}
                data-testid="settings-allow-hand-requests"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Confirm empty mana pool</strong>
                <small>Ask before passing while mana remains in pool.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.confirmEmptyManaPool}
                onChange={(event) => setSetting('confirmEmptyManaPool', event.target.checked)}
                data-testid="settings-confirm-empty-mana"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Ask graveyard order</strong>
                <small>Prompt when multiple cards move to graveyard together.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.askMoveToGraveOrder}
                onChange={(event) => setSetting('askMoveToGraveOrder', event.target.checked)}
                data-testid="settings-ask-grave-order"
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Chat</h2>
            <label className="setting-field">
              <span>
                <strong>Profanity filter</strong>
                <small>Matches Java's /w your-name profanity 0, 1, or 2 behavior.</small>
              </span>
              <select
                value={settings.chatProfanityFilterLevel}
                onChange={(event) => setSetting('chatProfanityFilterLevel', Number(event.target.value) as ProfanityFilterLevel)}
                data-testid="settings-chat-profanity-filter"
              >
                {PROFANITY_FILTER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Priority & Targets</h2>
            <label className="setting-row">
              <span>
                <strong>Pass priority after casting</strong>
                <small>Mirror Java's pass-priority cast preference.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.passPriorityCast}
                onChange={(event) => setSetting('passPriorityCast', event.target.checked)}
                data-testid="settings-pass-priority-cast"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Pass priority after activating</strong>
                <small>Mirror Java's pass-priority activation preference.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.passPriorityActivation}
                onChange={(event) => setSetting('passPriorityActivation', event.target.checked)}
                data-testid="settings-pass-priority-activation"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Auto-order triggers</strong>
                <small>Let the server order triggers automatically when allowed.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoOrderTrigger}
                onChange={(event) => setSetting('autoOrderTrigger', event.target.checked)}
                data-testid="settings-auto-order-trigger"
              />
            </label>

            <label className="setting-field">
              <span>
                <strong>Auto-target level</strong>
                <small>Off, Most, or All target automation.</small>
              </span>
              <select
                value={settings.autoTargetLevel}
                onChange={(event) => setSetting('autoTargetLevel', Number(event.target.value))}
                data-testid="settings-auto-target-level"
              >
                {AUTO_TARGET_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="setting-row">
              <span>
                <strong>Reuse replacement choices</strong>
                <small>Use the same auto-choice settings for matching replacement effects.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.useSameSettingsForReplacementEffects}
                onChange={(event) => setSetting('useSameSettingsForReplacementEffects', event.target.checked)}
                data-testid="settings-same-replacement-effects"
              />
            </label>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Priority Stops</h2>
            <div className="settings-subgrid">
              <div>
                <h3>Your Turn</h3>
                {SKIP_STEP_OPTIONS.map(option => (
                  <label className="setting-row compact" key={`your-${option.key}`}>
                    <span><strong>{option.label}</strong><small>{settings.skipPrioritySteps.yourTurn[option.key] ? 'Skip' : 'Stop'}</small></span>
                    <input
                      type="checkbox"
                      checked={settings.skipPrioritySteps.yourTurn[option.key]}
                      onChange={(event) => updateSkipStep('yourTurn', option.key, event.target.checked)}
                      data-testid={`settings-priority-your-${option.key}`}
                    />
                  </label>
                ))}
              </div>
              <div>
                <h3>Opponent Turn</h3>
                {SKIP_STEP_OPTIONS.map(option => (
                  <label className="setting-row compact" key={`opponent-${option.key}`}>
                    <span><strong>{option.label}</strong><small>{settings.skipPrioritySteps.opponentTurn[option.key] ? 'Skip' : 'Stop'}</small></span>
                    <input
                      type="checkbox"
                      checked={settings.skipPrioritySteps.opponentTurn[option.key]}
                      onChange={(event) => updateSkipStep('opponentTurn', option.key, event.target.checked)}
                      data-testid={`settings-priority-opponent-${option.key}`}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="settings-chip-grid">
              {PRIORITY_STOP_OPTIONS.map(option => (
                <label className="setting-row compact" key={option.key}>
                  <span><strong>{option.label}</strong></span>
                  <input
                    type="checkbox"
                    checked={settings.skipPrioritySteps[option.key]}
                    onChange={(event) => updatePriorityStop(option.key, event.target.checked)}
                    data-testid={`settings-priority-${option.key}`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Cards & Layout</h2>
            <label className="setting-slider">
              <span><strong>Tooltip delay</strong><small>{settings.tooltipDelayMs} ms</small></span>
              <input type="range" min="0" max="3000" step="50" value={settings.tooltipDelayMs} onChange={(event) => setSetting('tooltipDelayMs', Number(event.target.value))} data-testid="settings-tooltip-delay" />
            </label>
            <div className="settings-chip-grid">
              <label className="setting-row compact">
                <span><strong>Show card names</strong></span>
                <input type="checkbox" checked={settings.showCardNames} onChange={(event) => setSetting('showCardNames', event.target.checked)} data-testid="settings-show-card-names" />
              </label>
              <label className="setting-row compact">
                <span><strong>Image source debug</strong></span>
                <input type="checkbox" checked={settings.showCardImageSource} onChange={(event) => setSetting('showCardImageSource', event.target.checked)} data-testid="settings-card-image-source" />
              </label>
              <label className="setting-row compact">
                <span><strong>Player names</strong></span>
                <input type="checkbox" checked={settings.alwaysShowPlayerNames} onChange={(event) => setSetting('alwaysShowPlayerNames', event.target.checked)} data-testid="settings-player-names" />
              </label>
              <label className="setting-row compact">
                <span><strong>Life on avatar</strong></span>
                <input type="checkbox" checked={settings.displayLifeOnAvatar} onChange={(event) => setSetting('displayLifeOnAvatar', event.target.checked)} data-testid="settings-layout-life-on-avatar" />
              </label>
            </div>
            <div className="settings-subgrid">
              <SizeSlider label="Hand cards" value={settings.handCardSize} min={CARD_SIZE_MIN} max={CARD_SIZE_MAX} onChange={(value) => setSetting('handCardSize', value)} testId="settings-hand-card-size" />
              <SizeSlider label="Editor cards" value={settings.editorCardSize} min={CARD_SIZE_MIN} max={CARD_SIZE_MAX} onChange={(value) => setSetting('editorCardSize', value)} testId="settings-editor-card-size" />
              <SizeSlider label="Other-zone cards" value={settings.otherZoneCardSize} min={CARD_SIZE_MIN} max={CARD_SIZE_MAX} onChange={(value) => setSetting('otherZoneCardSize', value)} testId="settings-other-zone-card-size" />
              <SizeSlider label="Player panel" value={settings.playerPanelSize} min={70} max={140} onChange={(value) => setSetting('playerPanelSize', value)} testId="settings-player-panel-size" />
              <SizeSlider label="Dialog font" value={settings.dialogFontSize} min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} onChange={(value) => setSetting('dialogFontSize', value)} testId="settings-dialog-font-size" />
              <SizeSlider label="Chat font" value={settings.chatFontSize} min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} onChange={(value) => setSetting('chatFontSize', value)} testId="settings-chat-font-size" />
              <SizeSlider label="Tooltip width" value={settings.tooltipSize} min={220} max={560} onChange={(value) => setSetting('tooltipSize', value)} testId="settings-tooltip-size" />
            </div>
          </div>

          <div className="settings-panel">
            <h2>Rendering</h2>
            <label className="setting-field">
              <span><strong>Card rendering</strong><small>Image, hybrid, or text fallback first.</small></span>
              <select value={settings.cardRenderingMode} onChange={(event) => setSetting('cardRenderingMode', event.target.value as typeof settings.cardRenderingMode)} data-testid="settings-card-rendering-mode">
                <option value="image">Images</option>
                <option value="hybrid">Hybrid</option>
                <option value="text-only">Text only</option>
              </select>
            </label>
            <label className="setting-row"><span><strong>Ability icons</strong></span><input type="checkbox" checked={settings.showAbilityIcons} onChange={(event) => setSetting('showAbilityIcons', event.target.checked)} data-testid="settings-ability-icons" /></label>
            <label className="setting-row"><span><strong>Playable icons</strong></span><input type="checkbox" checked={settings.showPlayableIcons} onChange={(event) => setSetting('showPlayableIcons', event.target.checked)} data-testid="settings-playable-icons" /></label>
            <label className="setting-row"><span><strong>Reminder text</strong></span><input type="checkbox" checked={settings.showCardReminderText} onChange={(event) => setSetting('showCardReminderText', event.target.checked)} data-testid="settings-reminder-text" /></label>
            <label className="setting-row"><span><strong>Ability text overlay</strong></span><input type="checkbox" checked={settings.showAbilityTextOverlay} onChange={(event) => setSetting('showAbilityTextOverlay', event.target.checked)} data-testid="settings-ability-overlay" /></label>
            <label className="setting-row"><span><strong>Set symbol</strong></span><input type="checkbox" checked={settings.showSetSymbol} onChange={(event) => setSetting('showSetSymbol', event.target.checked)} data-testid="settings-set-symbol" /></label>
          </div>

          <div className="settings-panel">
            <h2>Appearance</h2>
            <label className="setting-field">
              <span><strong>Theme</strong><small>Arena shell plus Java-inspired palettes.</small></span>
              <select value={settings.clientTheme} onChange={(event) => setSetting('clientTheme', event.target.value as typeof settings.clientTheme)} data-testid="settings-client-theme">
                <option value="arena">Arena</option>
                <option value="java-dark">Java dark</option>
                <option value="java-light">Java light</option>
              </select>
            </label>
            <label className="setting-field">
              <span><strong>Login background</strong><small>HTTPS or data image URL.</small></span>
              <input value={settings.customLoginBackground} onChange={(event) => setSetting('customLoginBackground', event.target.value)} data-testid="settings-login-background" />
            </label>
            <label className="setting-field">
              <span><strong>Battlefield background</strong></span>
              <select value={settings.battlefieldBackgroundMode} onChange={(event) => setSetting('battlefieldBackgroundMode', event.target.value as typeof settings.battlefieldBackgroundMode)} data-testid="settings-battlefield-background-mode">
                <option value="default">Default</option>
                <option value="custom">Custom</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="setting-field">
              <span><strong>Custom battlefield image</strong><small>HTTPS or data image URL.</small></span>
              <input value={settings.customBattlefieldBackground} onChange={(event) => setSetting('customBattlefieldBackground', event.target.value)} data-testid="settings-battlefield-background" />
            </label>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Audio</h2>
            <div className="settings-chip-grid">
              <label className="setting-row compact"><span><strong>Game sounds</strong></span><input type="checkbox" checked={settings.gameSoundsEnabled} onChange={(event) => setSetting('gameSoundsEnabled', event.target.checked)} data-testid="settings-game-sounds" /></label>
              <label className="setting-row compact"><span><strong>Draft sounds</strong></span><input type="checkbox" checked={settings.draftSoundsEnabled} onChange={(event) => setSetting('draftSoundsEnabled', event.target.checked)} data-testid="settings-draft-sounds" /></label>
              <label className="setting-row compact"><span><strong>Skip sounds</strong></span><input type="checkbox" checked={settings.skipButtonSoundsEnabled} onChange={(event) => setSetting('skipButtonSoundsEnabled', event.target.checked)} data-testid="settings-skip-sounds" /></label>
              <label className="setting-row compact"><span><strong>Other sounds</strong></span><input type="checkbox" checked={settings.otherSoundsEnabled} onChange={(event) => setSetting('otherSoundsEnabled', event.target.checked)} data-testid="settings-other-sounds" /></label>
              <label className="setting-row compact"><span><strong>Match music</strong></span><input type="checkbox" checked={settings.matchMusicEnabled} onChange={(event) => setSetting('matchMusicEnabled', event.target.checked)} data-testid="settings-match-music" /></label>
              <label className="setting-row compact"><span><strong>Reduced audio</strong></span><input type="checkbox" checked={settings.reducedAudioMode} onChange={(event) => setSetting('reducedAudioMode', event.target.checked)} data-testid="settings-reduced-audio" /></label>
            </div>
            <div className="settings-subgrid">
              <SizeSlider label="Master volume" value={settings.masterVolume} min={0} max={100} onChange={(value) => setSetting('masterVolume', value)} testId="settings-master-volume" />
              <SizeSlider label="Effects volume" value={settings.effectsVolume} min={0} max={100} onChange={(value) => setSetting('effectsVolume', value)} testId="settings-effects-volume" />
              <SizeSlider label="Music volume" value={settings.musicVolume} min={0} max={100} onChange={(value) => setSetting('musicVolume', value)} testId="settings-music-volume" />
            </div>
            <div className="setting-row">
              <span><strong>Browser audio unlocked</strong><small>Set after the first user gesture permits browser audio.</small></span>
              <button type="button" className="settings-inline-button" onClick={unlockAudio} data-testid="settings-audio-unlocked">
                {settings.browserAudioUnlocked ? 'Unlocked' : 'Unlock'}
              </button>
            </div>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Keybinds</h2>
            <div className="keybind-list">
              {KEYBIND_ACTION_METADATA.map(action => {
                const keybind = settings.keybinds[action.actionId];
                return (
                  <div className="keybind-row" key={action.actionId} data-testid={`settings-keybind-${action.actionId}`}>
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.description}</small>
                    </span>
                    <input
                      value={keybind.key}
                      onChange={(event) => updateKeybind(action.actionId, { key: event.target.value })}
                      aria-label={`${action.label} key`}
                    />
                    <select value={keybind.eventType} onChange={(event) => updateKeybind(action.actionId, { eventType: event.target.value as ClientKeybindConfig['eventType'] })}>
                      {KEYBIND_EVENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <label><input type="checkbox" checked={keybind.ctrlOrMeta} onChange={(event) => updateKeybind(action.actionId, { ctrlOrMeta: event.target.checked })} /> Ctrl/Cmd</label>
                    <label><input type="checkbox" checked={keybind.altKey} onChange={(event) => updateKeybind(action.actionId, { altKey: event.target.checked })} /> Alt</label>
                    <label><input type="checkbox" checked={keybind.shiftKey} onChange={(event) => updateKeybind(action.actionId, { shiftKey: event.target.checked })} /> Shift</label>
                    <label><input type="checkbox" checked={keybind.enabled} onChange={(event) => updateKeybind(action.actionId, { enabled: event.target.checked })} /> Enabled</label>
                    <button type="button" className="settings-inline-button" onClick={() => resetKeybind(action.actionId)}>Reset</button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-panel">
            <h2>Connection</h2>
            <label className="setting-row"><span><strong>Reconnect chat channels</strong><small>Rejoin joined chat channels after websocket recovery.</small></span><input type="checkbox" checked={settings.reconnectRecoveryEnabled} onChange={(event) => setSetting('reconnectRecoveryEnabled', event.target.checked)} data-testid="settings-reconnect-recovery" /></label>
            <label className="setting-row"><span><strong>Restore session</strong><small>Attempt session restore after reconnect.</small></span><input type="checkbox" checked={settings.restoreSessionOnReconnect} onChange={(event) => setSetting('restoreSessionOnReconnect', event.target.checked)} data-testid="settings-restore-session" /></label>
            <label className="setting-row"><span><strong>Status messages</strong><small>Show reconnect/loss status toasts.</small></span><input type="checkbox" checked={settings.showConnectionStatusMessages} onChange={(event) => setSetting('showConnectionStatusMessages', event.target.checked)} data-testid="settings-connection-status" /></label>
          </div>

          <div className="settings-panel">
            <h2>Advanced</h2>
            <label className="setting-row"><span><strong>Debug mode</strong><small>Enable debug tools by default.</small></span><input type="checkbox" checked={settings.debugModeEnabled} onChange={(event) => setSetting('debugModeEnabled', event.target.checked)} data-testid="settings-debug-mode" /></label>
            <label className="setting-row"><span><strong>Debug captures</strong><small>Opt in to extra callback/debug capture surfaces.</small></span><input type="checkbox" checked={settings.debugCaptureEnabled} onChange={(event) => setSetting('debugCaptureEnabled', event.target.checked)} data-testid="settings-debug-captures" /></label>
            <label className="setting-row"><span><strong>Persist panel layout</strong><small>Keep table, deck, game, and activity panel choices in app config.</small></span><input type="checkbox" checked={settings.persistPanelLayout} onChange={(event) => setSetting('persistPanelLayout', event.target.checked)} data-testid="settings-persist-panel-layout" /></label>
          </div>

          <div className="settings-panel">
            <h2>Images & Cache</h2>
            <label className="setting-field">
              <span>
                <strong>Preferred image language</strong>
                <small>Use localized card images when the image source has them.</small>
              </span>
              <select
                value={settings.preferredImageLanguage}
                onChange={(event) => setSetting('preferredImageLanguage', event.target.value)}
                data-testid="settings-image-language"
              >
                {IMAGE_LANGUAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="setting-row">
              <span>
                <strong>Preload match images</strong>
                <small>Cache visible hand, battlefield, stack, graveyard, and exile images as match state arrives.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.preloadMatchImages}
                onChange={(event) => setSetting('preloadMatchImages', event.target.checked)}
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Preload visible card lists</strong>
                <small>Cache card viewer pages as you browse them.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.preloadVisibleCardImages}
                onChange={(event) => setSetting('preloadVisibleCardImages', event.target.checked)}
                data-testid="settings-preload-visible-card-images"
              />
            </label>

            <label className="setting-field">
              <span>
                <strong>Image fallback</strong>
                <small>Choose what appears when a card image is missing.</small>
              </span>
              <select
                value={settings.cardImageFallbackMode}
                onChange={(event) => setSetting('cardImageFallbackMode', event.target.value as typeof settings.cardImageFallbackMode)}
                data-testid="settings-card-image-fallback"
              >
                <option value="card-back">Card back</option>
                <option value="text-card">Text card</option>
              </select>
            </label>

            <label className="setting-slider">
              <span>
                <strong>Cache trim age</strong>
                <small>{settings.imageCacheMaxAgeDays} days</small>
              </span>
              <input
                type="range"
                min="1"
                max="90"
                step="1"
                value={settings.imageCacheMaxAgeDays}
                onChange={(event) => setSetting('imageCacheMaxAgeDays', Number(event.target.value))}
              />
            </label>

            <label className="setting-slider">
              <span>
                <strong>Cache size</strong>
                <small>{settings.imageCacheMaxSizeMb} MB</small>
              </span>
              <input
                type="range"
                min="25"
                max="500"
                step="25"
                value={settings.imageCacheMaxSizeMb}
                onChange={(event) => setSetting('imageCacheMaxSizeMb', Number(event.target.value))}
                data-testid="settings-image-cache-size"
              />
            </label>

            <div className="cache-actions">
              <span>{cacheSummary}</span>
              <Button variant="secondary" size="sm" onClick={trimCache} disabled={cacheBusy}>Trim Old</Button>
              <Button variant="ghost" size="sm" onClick={clearCache} disabled={cacheBusy}>Clear</Button>
            </div>
            <p className="settings-cache-diagnostics" data-testid="settings-image-missing-summary">{missingImageSummary}</p>
            <p className="settings-cache-diagnostics">
              Resource packs are represented by browser caching: symbols use bundled web assets, and card images stream from the selected image source into this local cache.
            </p>
          </div>
        </section>

        <div className="settings-footer">
          <Button variant="ghost" onClick={resetSettings}>Reset Defaults</Button>
        </div>
      </main>
    </div>
  );
};

interface SizeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}

const SizeSlider: React.FC<SizeSliderProps> = ({ label, value, min, max, onChange, testId }) => (
  <label className="setting-slider compact">
    <span>
      <strong>{label}</strong>
      <small>{value}</small>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      data-testid={testId}
    />
  </label>
);
