import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  appConfigService,
  clientSettingsToUserData,
  DEFAULT_CLIENT_SETTINGS,
  type ClientSettings,
} from '../services/AppConfigService';
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

function applyRuntimeSettings(settings: ClientSettings) {
  const animationStore = useAnimationStore.getState();
  animationStore.toggleAnimations(settings.animationsEnabled);
  animationStore.setAnimationSpeed(settings.animationSpeed);

  const sessionStore = useSessionStore.getState();
  if (sessionStore.isAuthenticated && sessionStore.userData) {
    sessionStore
      .setUserData(clientSettingsToUserData(settings))
      .catch((error) => console.error('[Settings] Failed to sync user profile settings', error));
  }

  const gameStore = useGameStore.getState();
  if (!gameStore.gameId) return;

  gameStore
    .sendPlayerAction(settings.autoTapManaPayment ? 'MANA_AUTO_PAYMENT_ON' : 'MANA_AUTO_PAYMENT_OFF')
    .catch((error) => console.error('[Settings] Failed to sync mana auto-payment', error));
  gameStore
    .sendPlayerAction(settings.manaPoolAutomaticRestricted ? 'MANA_AUTO_PAYMENT_RESTRICTED_ON' : 'MANA_AUTO_PAYMENT_RESTRICTED_OFF')
    .catch((error) => console.error('[Settings] Failed to sync restricted mana auto-payment', error));
  gameStore
    .sendPlayerAction(settings.useFirstManaAbility ? 'USE_FIRST_MANA_ABILITY_ON' : 'USE_FIRST_MANA_ABILITY_OFF')
    .catch((error) => console.error('[Settings] Failed to sync first mana ability setting', error));
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
        applyRuntimeSettings(nextSettings);
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
