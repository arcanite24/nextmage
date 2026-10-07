import { create } from 'zustand';
import { api } from '../connection';
import type { UserData, UserSkipPrioritySteps } from '../../protocol/generated/views';
import { readJson, writeJson } from './persist';
import { useSession } from './session';

export interface PlaySettings {
  /** tap lands automatically when the payment is unambiguous */
  autoPayMana: boolean;
  /** only auto-pay with mana that can't be spent elsewhere this turn */
  autoPayRestricted: boolean;
  /** ask before passing with mana in the pool */
  confirmEmptyManaPool: boolean;
  /** order simultaneous triggers automatically when it doesn't matter */
  autoOrderTriggers: boolean;
  /** pick the only legal target automatically (0 off, 1 when obvious, 2 always) */
  autoTargetLevel: 0 | 1 | 2;
  /** where the game stops to give you priority */
  stops: UserSkipPrioritySteps;
  /** card motion: placed, flown between zones */
  animations: boolean;
  /** opponents may ask to see your hand */
  allowHandRequests: boolean;
  /** game sounds (synthesized, local only) */
  sound: boolean;
  /** 0 to 1 */
  volume: number;
}

const SETTINGS_KEY = 'playmat.settings';

export const DEFAULT_SETTINGS: PlaySettings = {
  autoPayMana: true,
  autoPayRestricted: true,
  confirmEmptyManaPool: true,
  autoOrderTriggers: true,
  autoTargetLevel: 1,
  animations: true,
  allowHandRequests: true,
  sound: true,
  volume: 0.6,
  stops: {
    yourTurn: { upkeep: false, draw: false, main1: true, beforeCombat: false, endOfCombat: false, main2: true, endOfTurn: false },
    opponentTurn: { upkeep: false, draw: false, main1: false, beforeCombat: false, endOfCombat: false, main2: false, endOfTurn: true },
    stopOnDeclareAttackers: true,
    stopOnDeclareBlockersWithZeroPermanents: false,
    stopOnDeclareBlockersWithAnyPermanents: true,
    stopOnAllMainPhases: true,
    stopOnAllEndPhases: true,
    stopOnStackNewObjects: true,
  },
};

interface SettingsState {
  settings: PlaySettings;
  update(patch: Partial<PlaySettings>): void;
  syncToServer(): Promise<void>;
}

/** The complete preference object the server keeps per user (every field is required server side). */
export function toUserData(settings: PlaySettings): UserData {
  return {
    groupId: 0,
    avatarId: 51,
    allowRequestShowHandCards: settings.allowHandRequests,
    userSkipPrioritySteps: settings.stops,
    flagName: 'world.png',
    askMoveToGraveOrder: false,
    manaPoolAutomatic: settings.autoPayMana,
    manaPoolAutomaticRestricted: settings.autoPayRestricted,
    passPriorityCast: false,
    passPriorityActivation: false,
    autoOrderTrigger: settings.autoOrderTriggers,
    autoTargetLevel: settings.autoTargetLevel,
    useSameSettingsForReplacementEffects: true,
    useFirstManaAbility: false,
    confirmEmptyManaPool: settings.confirmEmptyManaPool,
    userIdStr: '',
  };
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, ...readJson<Partial<PlaySettings>>(SETTINGS_KEY, {}) },

  update(patch) {
    const settings = { ...get().settings, ...patch };
    writeJson(SETTINGS_KEY, settings);
    set({ settings });
    void get().syncToServer();
  },

  async syncToServer() {
    if (useSession.getState().phase !== 'signedIn') return;
    await api.connectSetUserData(null, toUserData(get().settings), 'web', '').catch(() => undefined);
  },
}));

// the server forgets preferences with the session: send them after every login
useSession.subscribe((state, previous) => {
  if (state.phase === 'signedIn' && (previous.phase !== 'signedIn' || state.roomId !== previous.roomId)) {
    void useSettings.getState().syncToServer();
  }
});
