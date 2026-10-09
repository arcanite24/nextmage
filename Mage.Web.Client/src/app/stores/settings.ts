import { create } from 'zustand';
import { api } from '../connection';
import type { TurnCombatStops } from '../../core/game/autoPass';
import { serverStops } from '../../core/game/stops';
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
  /** combat steps where the client doesn't pass for you once creatures attack (local only) */
  combatStops: TurnCombatStops;
  /** card motion: placed, flown between zones */
  animations: boolean;
  /** opponents may ask to see your hand */
  allowHandRequests: boolean;
  /** pass priority for the player when they have nothing to cast, play or activate (local only) */
  autoPass: boolean;
  /** answer "no attacks" / "no blocks" when nothing can attack or block (local only) */
  autoSkipCombat: boolean;
  /** stop for permanents' activated abilities during the opponent's turn (local only) */
  abilitiesOnTheirTurn: boolean;
  /** don't take priority back after casting a spell or activating an ability: it resolves unless the opponent responds */
  passAfterCasting: boolean;
  /** game sounds (synthesized, local only); M toggles it during a game */
  sound: boolean;
  /** master volume, 0 to 1 */
  volume: number;
  /** only your turn, decisions, the clock and the result make a sound */
  importantCuesOnly: boolean;
  /** browser notifications while the tab is in the background: your move, a draft pick, a game starting, a whisper */
  notifications: boolean;
  /** profile: the sigil shown for the player (server avatar ids 10 to 32; 10 shows the initial) */
  avatarId: number;
  /** profile: a country code ("de") or "world" */
  flag: string;
}

const SETTINGS_KEY = 'playmat.settings';

/** Arena-like: the game moves on by itself whenever the player has no real decision. */
export const STREAMLINED: Partial<PlaySettings> = {
  autoPass: true, autoSkipCombat: true, abilitiesOnTheirTurn: false, passAfterCasting: true, autoPayMana: true, autoTargetLevel: 1, autoOrderTriggers: true,
};

/** Classic XMage: every stop and every choice is the player's. */
export const FULL_CONTROL: Partial<PlaySettings> = {
  autoPass: false, autoSkipCombat: false, abilitiesOnTheirTurn: true, passAfterCasting: false, autoPayMana: false, autoTargetLevel: 0, autoOrderTriggers: false,
};

export const DEFAULT_SETTINGS: PlaySettings = {
  autoPayMana: true,
  autoPayRestricted: true,
  confirmEmptyManaPool: true,
  autoOrderTriggers: true,
  autoTargetLevel: 1,
  animations: true,
  allowHandRequests: true,
  autoPass: true,
  autoSkipCombat: true,
  abilitiesOnTheirTurn: false,
  passAfterCasting: true,
  sound: true,
  volume: 0.6,
  importantCuesOnly: false,
  notifications: false,
  avatarId: 10,
  flag: 'world',
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
  combatStops: {
    yourTurn: { attackers: false, blockers: false },
    opponentTurn: { attackers: false, blockers: false },
  },
};

interface SettingsState {
  settings: PlaySettings;
  /**
   * Arena's full control, for this visit: the game stops at every step, nothing is passed for the player and priority
   * comes back after each spell. Not saved, like on Arena.
   */
  fullControl: boolean;
  setFullControl(on: boolean): void;
  update(patch: Partial<PlaySettings>): void;
  syncToServer(): Promise<void>;
}

/** The complete preference object the server keeps per user (every field is required server side). */
export function toUserData(settings: PlaySettings, fullControl = false): UserData {
  return {
    groupId: 0,
    avatarId: settings.avatarId,
    allowRequestShowHandCards: settings.allowHandRequests,
    userSkipPrioritySteps: serverStops(settings.stops, fullControl),
    flagName: `${settings.flag || 'world'}.png`,
    askMoveToGraveOrder: false,
    manaPoolAutomatic: settings.autoPayMana,
    manaPoolAutomaticRestricted: settings.autoPayRestricted,
    passPriorityCast: settings.passAfterCasting && !fullControl,
    passPriorityActivation: settings.passAfterCasting && !fullControl,
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
  fullControl: false,

  setFullControl(on) {
    if (get().fullControl === on) return;
    set({ fullControl: on });
    void get().syncToServer();
  },

  update(patch) {
    const settings = { ...get().settings, ...patch };
    writeJson(SETTINGS_KEY, settings);
    set({ settings });
    void get().syncToServer();
  },

  async syncToServer() {
    if (useSession.getState().phase !== 'signedIn') return;
    await api.connectSetUserData(null, toUserData(get().settings, get().fullControl), 'web', '').catch(() => undefined);
  },
}));

// the server forgets preferences with the session: send them after every login
useSession.subscribe((state, previous) => {
  if (state.phase === 'signedIn' && (previous.phase !== 'signedIn' || state.roomId !== previous.roomId)) {
    void useSettings.getState().syncToServer();
  }
});
