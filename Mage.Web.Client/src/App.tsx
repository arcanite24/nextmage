/**
 * XMage Web Client - Main Application
 * 
 * A modern, Magic Arena-inspired web client for XMage.
 */

import React, { useEffect, useState } from 'react';
import { LoginPage } from './components/login';
import { LobbyPage } from './components/lobby';
import { useSessionStore, initializeCallbackDispatcher } from './stores';
import './App.css';

type AppView = 'login' | 'lobby' | 'game';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [gameId, setGameId] = useState<string | null>(null);

  const { isAuthenticated, connectionStatus } = useSessionStore();

  // Initialize callback dispatcher on mount
  useEffect(() => {
    const unsubscribe = initializeCallbackDispatcher();
    return () => unsubscribe();
  }, []);

  // Sync view with authentication state
  // Sync view with authentication state and handle restoration
  const { restoreSession } = useSessionStore();

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

  return (
    <div className="app-container">
      {currentView === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {currentView === 'lobby' && (
        <LobbyPage
          onEnterGame={handleEnterGame}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'game' && gameId && (
        <div className="game-placeholder">
          <div className="game-placeholder-content glass-panel">
            <h2>Game View</h2>
            <p>Game ID: {gameId}</p>
            <p>The game view is coming in Phase 3!</p>
            <button
              className="btn btn-secondary"
              onClick={handleLeaveGame}
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
