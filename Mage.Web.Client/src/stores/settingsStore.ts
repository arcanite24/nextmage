import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  appConfigService,
  clientSettingsToUserData,
  DEFAULT_CLIENT_SETTINGS,
  type ClientSettings,
} from '../services/AppConfigService';
import { cardImageService } from '../services/CardImageService';
import { imageCacheManager } from '../services/ImageCacheManager';
import type { PlayerAction } from '../types';
import { useAnimationStore } from './animationStore';
import { useGameStore } from './gameStore';
import { useSessionStore } from './sessionStore';

interface SettingsState {
  settings: ClientSettings;
}

interface SettingsActions {
  setSetting: <K extends keyof ClientSettings>(key: K, value: ClientSettings[K]) => void;
  resetSettings: () => void;
  syncRuntimeSettings: () => void;
}

const USER_DATA_SETTING_KEYS = new Set<keyof ClientSettings>([
  'avatarId',
  'flagName',
  'allowRequestShowHandCards',
  'confirmEmptyManaPool',
  'askMoveToGraveOrder',
  'passPriorityCast',
  'passPriorityActivation',
  'autoOrderTrigger',
  'autoTargetLevel',
  'useSameSettingsForReplacementEffects',
  'autoTapManaPayment',
  'manaPoolAutomaticRestricted',
  'useFirstManaAbility',
  'skipPrioritySteps',
]);

type ManaAutomationSettingKey =
  | 'autoTapManaPayment'
  | 'manaPoolAutomaticRestricted'
  | 'useFirstManaAbility';

const MANA_AUTOMATION_ACTIONS: Record<ManaAutomationSettingKey, { enabled: PlayerAction; disabled: PlayerAction; error: string }> = {
  autoTapManaPayment: {
    enabled: 'MANA_AUTO_PAYMENT_ON',
    disabled: 'MANA_AUTO_PAYMENT_OFF',
    error: 'mana auto-payment',
  },
  manaPoolAutomaticRestricted: {
    enabled: 'MANA_AUTO_PAYMENT_RESTRICTED_ON',
    disabled: 'MANA_AUTO_PAYMENT_RESTRICTED_OFF',
    error: 'restricted mana auto-payment',
  },
  useFirstManaAbility: {
    enabled: 'USE_FIRST_MANA_ABILITY_ON',
    disabled: 'USE_FIRST_MANA_ABILITY_OFF',
    error: 'first mana ability setting',
  },
};

function applyRuntimeSettings(settings: ClientSettings, changedKey?: keyof ClientSettings) {
  const applyAll = changedKey === undefined;

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.clientTheme = settings.clientTheme;
    root.dataset.battlefieldBackground = settings.battlefieldBackgroundMode;
    root.dataset.cardRenderingMode = settings.cardRenderingMode;
    root.dataset.showCardNames = String(settings.showCardNames);
    root.dataset.showCardImageSource = String(settings.showCardImageSource);
    root.dataset.showAbilityIcons = String(settings.showAbilityIcons);
    root.dataset.showPlayableIcons = String(settings.showPlayableIcons);
    root.dataset.showAbilityTextOverlay = String(settings.showAbilityTextOverlay);
    root.dataset.showSetSymbol = String(settings.showSetSymbol);
    root.style.setProperty('--mage-hand-card-size', `${settings.handCardSize}px`);
    root.style.setProperty('--mage-editor-card-size', `${settings.editorCardSize}px`);
    root.style.setProperty('--mage-other-zone-card-size', `${settings.otherZoneCardSize}px`);
    root.style.setProperty('--mage-dialog-font-size', `${settings.dialogFontSize}px`);
    root.style.setProperty('--mage-chat-font-size', `${settings.chatFontSize}px`);
    root.style.setProperty('--mage-player-panel-scale', `${settings.playerPanelSize / 100}`);
    root.style.setProperty('--mage-tooltip-width', `${settings.tooltipSize}px`);
    root.style.setProperty('--mage-tooltip-delay-ms', `${settings.tooltipDelayMs}ms`);
    root.style.setProperty('--mage-login-background-image', settings.customLoginBackground ? `url("${settings.customLoginBackground}")` : 'none');
    root.style.setProperty('--mage-battlefield-background-image', settings.customBattlefieldBackground ? `url("${settings.customBattlefieldBackground}")` : 'none');
  }

  if (applyAll || changedKey === 'preferredImageLanguage') {
    cardImageService.setPreferredLanguage(settings.preferredImageLanguage);
  }

  if (applyAll || changedKey === 'imageCacheMaxSizeMb') {
    imageCacheManager.setMaxSizeBytes(settings.imageCacheMaxSizeMb * 1024 * 1024);
    imageCacheManager
      .enforceSizeLimit()
      .catch((error) => console.error('[Settings] Failed to enforce image cache size', error));
  }

  const animationStore = useAnimationStore.getState();
  if (applyAll || changedKey === 'animationsEnabled') {
    animationStore.toggleAnimations(settings.animationsEnabled);
  }
  if (applyAll || changedKey === 'animationSpeed') {
    animationStore.setAnimationSpeed(settings.animationSpeed);
  }

  const sessionStore = useSessionStore.getState();
  const syncUserData = applyAll || (changedKey !== undefined && USER_DATA_SETTING_KEYS.has(changedKey));
  if (syncUserData && sessionStore.isAuthenticated && sessionStore.userData) {
    sessionStore
      .setUserData(clientSettingsToUserData(settings))
      .catch((error) => console.error('[Settings] Failed to sync user profile settings', error));
  }

  const gameStore = useGameStore.getState();
  if (!gameStore.gameId) return;

  for (const key of Object.keys(MANA_AUTOMATION_ACTIONS) as ManaAutomationSettingKey[]) {
    if (!applyAll && changedKey !== key) {
      continue;
    }
    const action = MANA_AUTOMATION_ACTIONS[key];
    gameStore
      .sendPlayerAction(settings[key] ? action.enabled : action.disabled)
      .catch((error) => console.error(`[Settings] Failed to sync ${action.error}`, error));
  }
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  devtools(
    immer((set, get) => ({
      settings: appConfigService.loadSettings(),

      setSetting: (key, value) => {
        set((state) => {
          state.settings[key] = value;
        });
        const nextSettings = get().settings;
        appConfigService.saveSettings(nextSettings);
        applyRuntimeSettings(nextSettings, key);
      },

      resetSettings: () => {
        const defaults = appConfigService.resetSettings();
        set((state) => {
          state.settings = { ...defaults };
        });
        applyRuntimeSettings(defaults);
      },

      syncRuntimeSettings: () => {
        applyRuntimeSettings(get().settings);
      },
    })),
    { name: 'SettingsStore' }
  )
);

export type { ClientSettings };
export { DEFAULT_CLIENT_SETTINGS };
