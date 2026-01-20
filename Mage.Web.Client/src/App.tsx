/**
 * XMage Web Client - Main Application
 * 
 * A modern, Magic Arena-inspired web client for XMage.
 */

import React, { useEffect, useState } from 'react';
import { LoginPage } from './components/login';
import { LobbyPage } from './components/lobby';
import { GamePage } from './components/game';
import { DeckEditorPage } from './components/deck/DeckEditorPage';
import { DeckManagerPage } from './components/deck/DeckManagerPage';
import { useSessionStore, useGameStore, initializeCallbackDispatcher } from './stores';
import { useDeckStore } from './stores/deckStore';
import './App.css';

type AppView = 'login' | 'lobby' | 'game' | 'deck-manager' | 'deck-editor';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [gameId, setGameId] = useState<string | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | undefined>(undefined);

  const { isAuthenticated, connectionStatus } = useSessionStore();

  // Initialize callback dispatcher on mount
  useEffect(() => {
    const unsubscribe = initializeCallbackDispatcher();
    return () => unsubscribe();
  }, []);

  // Sync view with authentication state and handle restoration
  const { restoreSession } = useSessionStore();
  const activeGameId = useGameStore(state => state.gameId);

  useEffect(() => {
    if (activeGameId) {
      setGameId(activeGameId);
      setCurrentView('game');
    } else if (currentView === 'game' && !activeGameId) {
      setGameId(null);
      setCurrentView('lobby');
    }
  }, [activeGameId, currentView]);

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
    setCurrentView('login');
  };

  const handleEnterGame = (id: string) => {
    setGameId(id);
    setCurrentView('game');
  };

  const handleLeaveGame = () => {
    setGameId(null);
    setCurrentView('lobby');
  };

  const handleOpenDeckManager = () => {
    setCurrentView('deck-manager');
  };

  const handleEditDeck = (deckId: string) => {
    setEditingDeckId(deckId);
    setCurrentView('deck-editor');
  };

  const handleCreateDeck = () => {
    useDeckStore.getState().createNewDeck();
    setEditingDeckId(undefined);
    setCurrentView('deck-editor');
  };

  const handleDoneEditing = () => {
    setEditingDeckId(undefined);
    setCurrentView('deck-manager');
  };

  const handleNavigation = (page: string) => {
    if (page === 'lobby') setCurrentView('lobby');
    if (page === 'decks') setCurrentView('deck-manager');
  };

  return (
    <div className="app-container">
      {currentView === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {currentView === 'lobby' && (
        <LobbyPage
          onEnterGame={handleEnterGame}
          onLogout={handleLogout}
          onOpenDeckEditor={handleOpenDeckManager}
        />
      )}

      {currentView === 'game' && gameId && (
        <GamePage gameId={gameId} onLeave={handleLeaveGame} />
      )}

      {currentView === 'deck-manager' && (
        <DeckManagerPage
          onExit={() => setCurrentView('lobby')}
          onNavigate={handleNavigation}
          onEditDeck={handleEditDeck}
          onCreateDeck={handleCreateDeck}
        />
      )}

      {currentView === 'deck-editor' && (
        <DeckEditorPage
          deckId={editingDeckId}
          onExit={() => setCurrentView('lobby')}
          onNavigate={handleNavigation}
          onDone={handleDoneEditing}
        />
      )}

      {/* Global Alert Dialog */}

      <GlobalAlert />
    </div>
  );
}

function GlobalAlert() {
  const { alert, closeAlert } = useSessionStore();

  if (!alert.isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>{alert.title}</h3>
          <button className="modal-close" onClick={closeAlert}>×</button>
        </div>
        <div className="modal-content">
          <p>{alert.message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={closeAlert}>OK</button>
        </div>
      </div>
    </div>
  );
}

export default App;

