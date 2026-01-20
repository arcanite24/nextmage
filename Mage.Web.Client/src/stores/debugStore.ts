/**
 * Debug Store
 * 
 * Manages debug interface state including action history,
 * board state tracking, and configuration.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { UUID, ClientCallback, GameView } from '../types';
import { DebugAction, DebugConfig, BoardStateSummary, PlayerStateSummary, StackItemSummary, DebugExportData } from '../types/debug';

const STORAGE_KEY = 'mage-debug-config';

interface DebugState {
  config: DebugConfig;
  actions: DebugAction[];
  currentGameView: GameView | null;
  lastUpdateTimestamp: number;
  matchId: UUID | null;
}

interface DebugActions {
  toggleDebugMode: () => void;
  setMaxHistorySize: (size: number) => void;
  setAutoTrack: (enabled: boolean) => void;
  recordAction: (callback: ClientCallback) => void;
  startNewMatch: (matchId: UUID) => void;
  endMatch: () => void;
  clearHistory: () => void;
  getBoardStateSummary: () => BoardStateSummary | null;
  getActionHistory: (limit?: number) => DebugAction[];
  exportAsJson: () => Promise<void>;
  exportAsText: () => Promise<void>;
  exportToClipboard: () => Promise<void>;
  getFullExportData: () => DebugExportData;
}

function loadConfigFromStorage(): DebugConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load debug config from storage', e);
    }
  }
  return {
    enabled: true,
    maxHistorySize: 50,
    autoTrack: true,
  };
}

function saveConfigToStorage(config: DebugConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function getActionTypeCategory(method: string): string {
  if (method === 'gameError') return 'error';
  if (method.includes('Ask') || method.includes('Target') || method.includes('Select') || method.includes('Choose')) {
    return 'interaction';
  }
  if (['gameInit', 'gameUpdate', 'gameInform'].includes(method)) return 'state';
  return 'system';
}

function generateActionSummary(callback: ClientCallback, gameView?: GameView): string {
  const method = callback.method;
  const data = callback.data as any;

  switch (method) {
    case 'gameInit':
      return `Game initialized - Turn ${gameView?.turn || 0}`;
    case 'gameUpdate':
      const turn = gameView?.turn || 0;
      const phase = gameView?.phase || 'UNKNOWN';
      const step = gameView?.step || 'UNKNOWN';
      return `Update - Turn ${turn} ${phase}/${step}`;
    case 'gameInform':
    case 'gameInformPersonal':
      return `Inform: ${data.message || 'Game info'}`;
    case 'gameAsk':
      return `Ask: ${data.message || 'Respond?'}`;
    case 'gameTarget':
      return `Target: ${data.message || 'Select target'}`;
    case 'gameSelect':
      return `Select: ${data.message || 'Select cards'}`;
    case 'gameChooseAbility':
      return `Choose Ability: ${data.message || 'Select an ability'}`;
    case 'gameChooseChoice':
      return `Choose: ${data.choice?.message || 'Make a choice'}`;
    case 'gameChoosePile':
      return `Choose Pile: ${data.message || 'Choose a pile'}`;
    case 'gamePlayMana':
      return `Pay Mana: ${data.message || 'Select mana to pay'}`;
    case 'gamePlayXMana':
      return `Choose X Value: ${data.message || 'Choose X'}`;
    case 'gameGetAmount':
    case 'gameSelectAmount':
      return `Amount: ${data.message || 'Choose a number'} (${data.min || 0}-${data.max || 999})`;
    case 'gameGetMultiAmount':
    case 'gameSelectMultiAmount':
      return `Multi Amount: Choose values for ${data.messages?.length || 0} items`;
    case 'gameError':
      return `Error: ${data || 'Unknown error'}`;
    case 'gameOver':
      return `Game Over - Winners: ${(data as any)?.winners?.join(', ') || 'None'}`;
    case 'endGameInfo':
      return `End Game Info: Match completed`;
    default:
      return method.replace('game', '').replace(/([A-Z])/g, ' $1').trim();
  }
}

export const useDebugStore = create<DebugState & DebugActions>()(
  devtools(
    immer((set, get) => ({
      config: loadConfigFromStorage(),
      actions: [],
      currentGameView: null,
      lastUpdateTimestamp: 0,
      matchId: null,

      toggleDebugMode: () => {
        set((state) => {
          state.config.enabled = !state.config.enabled;
          saveConfigToStorage(state.config);
        });
      },

      setMaxHistorySize: (size) => {
        set((state) => {
          state.config.maxHistorySize = Math.max(10, Math.min(200, size));
          saveConfigToStorage(state.config);
          if (state.actions.length > state.config.maxHistorySize) {
            state.actions = state.actions.slice(0, state.config.maxHistorySize);
          }
        });
      },

      setAutoTrack: (enabled) => {
        set((state) => {
          state.config.autoTrack = enabled;
          saveConfigToStorage(state.config);
        });
      },

      recordAction: (callback) => {
        const { config, actions, matchId } = get();

        if (!config.autoTrack || !matchId) return;

        let gameView: GameView | undefined;
        const data = callback.data;

        if (typeof data === 'object' && data !== null) {
          if ((data as any).gameView) {
            gameView = (data as any).gameView;
          } else if (['gameInit', 'gameUpdate', 'gameInform'].includes(callback.method)) {
            gameView = data as GameView;
          }
        }

        const summary = generateActionSummary(callback, gameView);
        const actionType = getActionTypeCategory(callback.method);

        const action: DebugAction = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          actionType,
          method: callback.method,
          summary,
          gameView,
          data,
        };

        set((state) => {
          state.actions.unshift(action);
          state.currentGameView = gameView || state.currentGameView;
          state.lastUpdateTimestamp = action.timestamp;

          if (state.actions.length > state.config.maxHistorySize) {
            state.actions = state.actions.slice(0, state.config.maxHistorySize);
          }
        });
      },

      startNewMatch: (matchId) => {
        set((state) => {
          if (state.matchId && state.matchId !== matchId) {
            state.actions = [];
            state.currentGameView = null;
          }
          state.matchId = matchId;
        });
      },

      endMatch: () => {
        set((state) => {
          state.matchId = null;
        });
      },

      clearHistory: () => {
        set((state) => {
          state.actions = [];
          state.currentGameView = null;
          state.lastUpdateTimestamp = 0;
        });
      },

      getBoardStateSummary: () => {
        const { currentGameView } = get();
        if (!currentGameView) return null;

        const players: PlayerStateSummary[] = currentGameView.players.map(player => ({
          playerId: player.playerId,
          name: player.name,
          life: player.life,
          handCount: player.handCount,
          graveyardCount: Object.keys(player.graveyard).length,
          exileCount: Object.keys(player.exile).length,
          battlefieldCount: Object.keys(player.battlefield).length,
          libraryCount: player.libraryCount,
          manaPool: { ...player.manaPool },
          hasPriority: player.hasPriority,
          isActive: player.isActive,
          designations: player.designationNames,
        }));

        const stackItems: StackItemSummary[] = Object.values(currentGameView.stack).map(item => ({
          cardName: item.name,
          controller: (item as any).nameOwner || 'Unknown',
          type: item.cardTypes?.join(', ') || 'Unknown',
        }));

        return {
          timestamp: Date.now(),
          turn: currentGameView.turn,
          phase: currentGameView.phase,
          step: currentGameView.step,
          activePlayer: currentGameView.activePlayerName,
          priorityPlayer: currentGameView.priorityPlayerName,
          gameCycle: currentGameView.gameCycle,
          totalErrors: currentGameView.totalErrorsCount,
          totalEffects: currentGameView.totalEffectsCount,
          players,
          stackItems,
          combatGroups: currentGameView.combat.length,
        };
      },

      getActionHistory: (limit) => {
        const { actions } = get();
        return limit ? actions.slice(0, limit) : actions;
      },

      getFullExportData: () => {
        const { config, currentGameView, actions, matchId, lastUpdateTimestamp } = get();

        return {
          timestamp: Date.now(),
          config: {
            enabled: config.enabled,
            maxHistorySize: config.maxHistorySize,
          },
          currentGameView,
          boardStateSummary: get().getBoardStateSummary(),
          actionHistory: actions,
          metadata: {
            totalActions: actions.length,
            matchId: matchId || null,
            lastUpdate: lastUpdateTimestamp,
          },
        };
      },

      exportAsJson: async () => {
        const { DebugExportService } = await import('../services/DebugExportService');
        const data = get().getFullExportData();
        await DebugExportService.exportAsJson(data);
      },

      exportAsText: async () => {
        const { DebugExportService } = await import('../services/DebugExportService');
        const data = get().getFullExportData();
        await DebugExportService.exportAsText(data);
      },

      exportToClipboard: async () => {
        const { DebugExportService } = await import('../services/DebugExportService');
        const data = get().getFullExportData();
        await DebugExportService.exportToClipboard(data);
      },
    })),
    { name: 'DebugStore' }
  )
);
