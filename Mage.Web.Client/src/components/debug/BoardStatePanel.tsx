import React, { useState } from 'react';
import { GameView } from '../../types/game';
import { BoardStateSummary as BoardSummaryComponent } from './BoardStateSummary';
import { BoardStateJsonViewer } from './BoardStateJsonViewer';

interface BoardStatePanelProps {
  gameView: GameView | null;
}

export const BoardStatePanel: React.FC<BoardStatePanelProps> = ({ gameView }) => {
  const [viewMode, setViewMode] = useState<'summary' | 'json'>('summary');

  if (!gameView) {
    return (
      <div className="board-state-panel empty">
        <div className="board-state-empty-message">
          No game state available
        </div>
      </div>
    );
  }

  return (
    <div className="board-state-panel">
      <div className="board-state-header">
        <h2 className="board-state-title">Board State</h2>
        <div className="board-state-controls">
          <button
            className={`board-state-view-btn ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            Summary
          </button>
          <button
            className={`board-state-view-btn ${viewMode === 'json' ? 'active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            Full JSON
          </button>
        </div>
      </div>

      {viewMode === 'summary' && (
        <BoardSummaryComponent gameView={gameView} />
      )}

      {viewMode === 'json' && (
        <BoardStateJsonViewer gameView={gameView} />
      )}
    </div>
  );
};
