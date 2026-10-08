/**
 * XMage Web Client - Main Application
 * 
 * A modern, Magic Arena-inspired web client for XMage.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LoginPage } from './components/login';
import { LobbyPage } from './components/lobby';
import { GamePage } from './components/game';
import { DeckEditorPage } from './components/deck/DeckEditorPage';
import { DeckManagerPage } from './components/deck/DeckManagerPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { DebugMode } from './components/debug/DebugMode';
import { ActivityWorkspace } from './components/activity/ActivityWorkspace';
import { ActivitySwitcher, Button, Modal, NotificationToastHost, SupportMenu, UserRequestModal } from './components/common';
import { useSessionStore, useGameStore, useSettingsStore, useActivityStore, initializeCallbackDispatcher } from './stores';
import { useDeckStore } from './stores/deckStore';
import {
  getActivityDestination,
  shouldShowFloatingActivityShell,
  type ActivityKind,
} from './services/ActivityShellService';
import { buildDraftAutosaveDeck } from './services/DraftDeckAutosaveService';
import { deckStorage } from './core/decks/DeckStorageService';
import type { DeckEditorModeKey } from './services/AppConfigService';
import type { ClientActivity } from './stores/activityStore';
import type { DeckCardLists } from './types';
import './App.css';

type AppView = 'login' | 'lobby' | 'game' | 'deck-manager' | 'deck-editor' | 'settings' | 'activity';
type ActivityDeckEditorContext = {
  tableId: string;
  kind: 'sideboard' | 'construction';
  title: string;
  limitedSideboard?: boolean;
};

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [gameId, setGameId] = useState<string | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | undefined>(undefined);
  const [activityDeckEditorContext, setActivityDeckEditorContext] = useState<ActivityDeckEditorContext | null>(null);
  const [debugModeOpen, setDebugModeOpen] = useState(false);
  const openedGameIdRef = useRef<string | null>(null);
  const autosavedDraftIdsRef = useRef<Set<string>>(new Set());

  const { isAuthenticated, connectionStatus } = useSessionStore();
  const submitActivityDeck = useGameStore(state => state.submitDeck);
  const syncRuntimeSettings = useSettingsStore(state => state.syncRuntimeSettings);
  const activities = useActivityStore(state => state.activities);
  const activeActivityId = useActivityStore(state => state.activeActivityId);
  const setActiveActivity = useActivityStore(state => state.setActiveActivity);
  const openUtilityActivity = useActivityStore(state => state.openUtilityActivity);
  const activeActivity = activities.find(activity => activity.id === activeActivityId) ?? null;
  const activeActivityIsCurrentReplay = activeActivity?.kind === 'replay' && activeActivity.objectId === gameId;
  const openedActivityIdRef = useRef<string | null>(null);

  const confirmDiscardDirtyDeck = (action: string): boolean => {
    const deckState = useDeckStore.getState();
    if (currentView !== 'deck-editor' || !deckState.isDirty) {
      return true;
    }

    if (!window.confirm(`Discard unsaved changes and ${action}?`)) {
      return false;
    }

    deckState.closeDeck();
    setEditingDeckId(undefined);
    setActivityDeckEditorContext(null);
    return true;
  };

  // Initialize callback dispatcher on mount
  useEffect(() => {
    const unsubscribe = initializeCallbackDispatcher();
    syncRuntimeSettings();
    return () => unsubscribe();
  }, [syncRuntimeSettings]);

  // Sync view with authentication state and handle restoration
  const { restoreSession } = useSessionStore();
  const activeGameId = useGameStore(state => state.gameId);

  useEffect(() => {
    if (activeGameId && activeGameId !== openedGameIdRef.current) {
      openedGameIdRef.current = activeGameId;
      setGameId(activeGameId);
      setCurrentView('game');
      return;
    }

    if (!activeGameId) {
      openedGameIdRef.current = null;
      setGameId(null);
      setCurrentView(view => view === 'game' ? 'lobby' : view);
    }
  }, [activeGameId]);

  useEffect(() => {
    if (!activeActivity || activeActivity.status === 'completed') return;
    if (!['construction', 'sideboard', 'draft', 'replay', 'tournament'].includes(activeActivity.kind)) return;
    if (openedActivityIdRef.current === activeActivity.id) return;
    if (currentView === 'deck-editor' && useDeckStore.getState().isDirty) return;

    openedActivityIdRef.current = activeActivity.id;
    setCurrentView('activity');
  }, [activeActivity, currentView]);

  useEffect(() => {
    for (const activity of activities) {
      if (
        activity.kind !== 'draft'
        || activity.status !== 'completed'
        || !activity.deck
        || activity.deck.cards.length === 0
        || autosavedDraftIdsRef.current.has(activity.id)
      ) {
        continue;
      }

      autosavedDraftIdsRef.current.add(activity.id);
      const autosaveDeck = buildDraftAutosaveDeck(activity.deck, activity.objectId);
      deckStorage.saveDeck(autosaveDeck, { forceNew: true })
        .then(async (deckId) => {
          const deckState = useDeckStore.getState();
          await deckState.loadDecks();
          deckState.selectDeck(deckId);
        })
        .catch((error) => {
          autosavedDraftIdsRef.current.delete(activity.id);
          console.error('[App] Failed to autosave completed draft deck:', error);
        });
    }
  }, [activities]);

  useEffect(() => {
    if (isAuthenticated) {
      // If authenticated but not connected (e.g. refresh), try to restore
      if (connectionStatus === 'disconnected') {
        restoreSession().then(success => {
          if (success) {
            setCurrentView('lobby');
          } else {
            setCurrentView('login');
          }
        });
      }
    } else if (currentView !== 'login') {
      setCurrentView('login');
    }
  }, [isAuthenticated, connectionStatus, currentView, restoreSession]);

  const handleLoginSuccess = () => {
    setCurrentView('lobby');
  };

  const handleLogout = () => {
    if (!confirmDiscardDirtyDeck('log out')) return false;
    openedGameIdRef.current = null;
    setGameId(null);
    setCurrentView('login');
    return true;
  };

  const handleEnterGame = (id: string) => {
    if (!confirmDiscardDirtyDeck('enter the game')) return;
    openedGameIdRef.current = id;
    setGameId(id);
    setCurrentView('game');
  };

  const handleLeaveGame = () => {
    openedGameIdRef.current = null;
    setGameId(null);
    setCurrentView('lobby');
  };

  const handleOpenLobby = () => {
    if (!confirmDiscardDirtyDeck('go to the lobby')) return;
    setCurrentView('lobby');
  };

  const handleOpenDeckManager = () => {
    if (!confirmDiscardDirtyDeck('open Decks')) return;
    openUtilityActivity('deck-manager');
    setCurrentView('deck-manager');
  };

  const handleOpenSettings = () => {
    if (!confirmDiscardDirtyDeck('open settings')) return;
    openUtilityActivity('settings');
    setCurrentView('settings');
  };

  const handleOpenDebug = () => {
    if (!confirmDiscardDirtyDeck('open debug tools')) return;
    openUtilityActivity('debug');
    setDebugModeOpen(true);
    setCurrentView('activity');
  };

  const handleOpenCardViewer = () => {
    if (!confirmDiscardDirtyDeck('open the card viewer')) return;
    openUtilityActivity('card-viewer');
    setCurrentView('activity');
  };

  const handleOpenTournamentActivity = (tableId: string, title: string) => {
    if (!confirmDiscardDirtyDeck('open the tournament')) return;
    openUtilityActivity('tournament', {
      title: title || `Tournament ${tableId.slice(0, 8)}`,
    });
    setCurrentView('activity');
  };

  const handleEditDeck = (deckId: string) => {
    if (!confirmDiscardDirtyDeck('open another deck')) return;
    setActivityDeckEditorContext(null);
    openUtilityActivity('deck-editor', { objectId: deckId, title: 'Deck editor' });
    setEditingDeckId(deckId);
    setCurrentView('deck-editor');
  };

  const handleCreateDeck = () => {
    if (!confirmDiscardDirtyDeck('start a new deck')) return;
    setActivityDeckEditorContext(null);
    useDeckStore.getState().createNewDeck();
    openUtilityActivity('deck-editor', { title: 'New deck' });
    setEditingDeckId(undefined);
    setCurrentView('deck-editor');
  };

  const handleOpenActivityDeckEditor = (
    deck: DeckCardLists,
    mode: DeckEditorModeKey,
    title: string,
    activityContext?: { kind: ClientActivity['kind']; tableId?: string; limitedSideboard?: boolean },
  ) => {
    if (!confirmDiscardDirtyDeck('open this activity deck in the full editor')) return;

    const deckState = useDeckStore.getState();
    deckState.closeDeck();
    deckState.setEditorMode(mode);
    deckState.replaceCurrentDeck({
      ...deck,
      id: undefined,
      name: deck.name || title || 'Activity Deck',
    });
    setActivityDeckEditorContext(
      activityContext?.tableId && (activityContext.kind === 'sideboard' || activityContext.kind === 'construction')
        ? {
          tableId: activityContext.tableId,
          kind: activityContext.kind,
          title,
          limitedSideboard: activityContext.limitedSideboard,
        }
        : null,
    );
    openUtilityActivity('deck-editor', { title: title || deck.name || 'Activity deck' });
    setEditingDeckId(undefined);
    setCurrentView('deck-editor');
  };

  const handleDoneEditing = () => {
    setEditingDeckId(undefined);
    setActivityDeckEditorContext(null);
    setCurrentView('deck-manager');
  };

  const handleNavigation = (page: string) => {
    if (page === 'lobby') handleOpenLobby();
    if (page === 'decks') handleOpenDeckManager();
    if (page === 'settings') handleOpenSettings();
  };

  const handleOpenActivity = (activity: ClientActivity) => {
    const destination = getActivityDestination(activity.kind as ActivityKind);
    const guardAction = destination === 'game'
      ? 'enter the game'
      : destination === 'deck-manager'
        ? 'open Decks'
        : destination === 'deck-editor'
          ? 'open another deck'
          : destination === 'settings'
            ? 'open settings'
            : destination === 'debug'
              ? 'open debug tools'
              : 'open the activity';
    if (!confirmDiscardDirtyDeck(guardAction)) return;

    setActiveActivity(activity.id);

    if (destination === 'game' && activity.objectId) {
      handleEnterGame(activity.objectId);
      return;
    }

    if (destination === 'deck-manager') {
      setCurrentView('deck-manager');
      return;
    }

    if (destination === 'deck-editor') {
      setEditingDeckId(activity.objectId ?? undefined);
      setCurrentView('deck-editor');
      return;
    }

    if (destination === 'settings') {
      setCurrentView('settings');
      return;
    }

    if (destination === 'debug') {
      setDebugModeOpen(true);
      setCurrentView('activity');
      return;
    }

    setCurrentView('activity');
  };

  const showActivitySwitcher = shouldShowFloatingActivityShell({
    isAuthenticated,
    currentView,
    activities,
  });
  const showFloatingSupportMenu = isAuthenticated && (
    currentView === 'game' ||
    currentView === 'activity'
  );
  const renderNavbarSupportMenu = () => (
    <SupportMenu
      placement="inline"
      onOpenDebug={handleOpenDebug}
      onOpenCardViewer={handleOpenCardViewer}
      onOpenSettings={handleOpenSettings}
    />
  );

  return (
    <div className={`app-container ${showActivitySwitcher ? 'app-container-with-activity-switcher' : ''} ${currentView === 'game' ? 'app-container-game-view' : ''}`}>
      {currentView === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {currentView === 'lobby' && (
        <LobbyPage
          onEnterGame={handleEnterGame}
          onLogout={handleLogout}
          onOpenDeckEditor={handleOpenDeckManager}
          onOpenTournament={handleOpenTournamentActivity}
          supportMenu={renderNavbarSupportMenu()}
        />
      )}

      {currentView === 'game' && gameId && (
        <GamePage gameId={gameId} onLeave={handleLeaveGame} isReplay={activeActivityIsCurrentReplay} />
      )}

      {currentView === 'deck-manager' && (
        <DeckManagerPage
          onExit={() => setCurrentView('lobby')}
          onNavigate={handleNavigation}
          onEditDeck={handleEditDeck}
          onCreateDeck={handleCreateDeck}
          supportMenu={renderNavbarSupportMenu()}
        />
      )}

      {currentView === 'deck-editor' && (
        <DeckEditorPage
          deckId={editingDeckId}
          onExit={() => setCurrentView('lobby')}
          onNavigate={handleNavigation}
          onDone={handleDoneEditing}
          supportMenu={renderNavbarSupportMenu()}
          activitySubmitContext={activityDeckEditorContext}
          onSubmitActivityDeck={submitActivityDeck}
        />
      )}

      {currentView === 'settings' && (
        <SettingsPage
          onExit={() => setCurrentView('lobby')}
          onNavigate={handleNavigation}
          onLogout={handleLogout}
          supportMenu={renderNavbarSupportMenu()}
        />
      )}

      {currentView === 'activity' && (
        <ActivityWorkspace
          activity={activeActivity}
          activities={activities}
          onOpenDecks={handleOpenDeckManager}
          onOpenGame={handleEnterGame}
          onOpenLobby={handleOpenLobby}
          onOpenSettings={handleOpenSettings}
          onOpenDebug={handleOpenDebug}
          onSubmitDeck={submitActivityDeck}
          onOpenDeckEditor={handleOpenActivityDeckEditor}
        />
      )}

      {showActivitySwitcher && (
        <ActivitySwitcher
          currentView={currentView}
          currentGameId={gameId}
          onOpenLobby={handleOpenLobby}
          onOpenDecks={handleOpenDeckManager}
          onOpenSettings={handleOpenSettings}
          onOpenGame={handleEnterGame}
          onOpenActivity={handleOpenActivity}
        />
      )}

      {showFloatingSupportMenu && (
        <SupportMenu
          onOpenDebug={handleOpenDebug}
          onOpenCardViewer={handleOpenCardViewer}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {debugModeOpen && (
        <DebugMode onClose={() => setDebugModeOpen(false)} />
      )}

      <GlobalAlert />
      <GlobalUserRequest />
      <NotificationToastHost />
    </div>
  );
}

function GlobalUserRequest() {
  const { userRequest, respondToUserRequest, closeUserRequest } = useSessionStore();

  return (
    <UserRequestModal
      request={userRequest.request}
      isOpen={userRequest.isOpen}
      isExecuting={userRequest.isExecuting}
      error={userRequest.error}
      onRespond={respondToUserRequest}
      onClose={closeUserRequest}
    />
  );
}

function GlobalAlert() {
  const { alert, closeAlert } = useSessionStore();

  if (!alert.isOpen) return null;

  return (
    <Modal isOpen={alert.isOpen} onClose={closeAlert} title={alert.title} closeOnBackdrop={false}>
      <div className="global-alert">
        <p>{alert.message}</p>
        <div className="global-alert-actions">
          <Button onClick={closeAlert}>OK</Button>
        </div>
      </div>
    </Modal>
  );
}

export default App;
