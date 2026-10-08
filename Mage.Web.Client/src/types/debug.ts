/**
 * Debug Interface Types
 */

import { UUID, TurnPhase, PhaseStep, ClientCallbackMethod } from './api.js';
import { GameView, ManaPoolView } from './game.js';

export interface DebugAction {
  id: string;
  timestamp: number;
  actionType: string;
  method: ClientCallbackMethod;
  summary: string;
  gameView?: GameView;
  data: unknown;
}

export interface DebugCallbackFixture {
  capturedAt: number;
  messageId: number;
  method: ClientCallbackMethod;
  objectId: UUID | null;
  data: unknown;
}

export interface DebugConfig {
  enabled: boolean;
  maxHistorySize: number;
  autoTrack: boolean;
}

export interface BoardStateSummary {
  timestamp: number;
  turn: number;
  phase: TurnPhase;
  step: PhaseStep;
  activePlayer: string;
  priorityPlayer: string;
  gameCycle: number;
  totalErrors: number;
  totalEffects: number;
  players: PlayerStateSummary[];
  stackItems: StackItemSummary[];
  combatGroups: number;
}

export interface PlayerStateSummary {
  playerId: UUID;
  name: string;
  life: number;
  handCount: number;
  graveyardCount: number;
  exileCount: number;
  battlefieldCount: number;
  libraryCount: number;
  manaPool: ManaPoolView;
  hasPriority: boolean;
  isActive: boolean;
  designations: string[];
}

export interface StackItemSummary {
  cardName: string;
  controller: string;
  type: string;
}

export interface DebugExportData {
  timestamp: number;
  config: {
    enabled: boolean;
    maxHistorySize: number;
  };
  currentGameView: GameView | null;
  boardStateSummary: BoardStateSummary | null;
  actionHistory: DebugAction[];
  callbackFixtures: DebugCallbackFixture[];
  metadata: {
    totalActions: number;
    totalCallbackFixtures: number;
    matchId: string | null;
    lastUpdate: number;
  };
}
