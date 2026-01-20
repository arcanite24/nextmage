import React, { useState } from 'react';
import { GameView } from '../../types/game';
import { JsonViewer } from './JsonViewer';

interface BoardStateJsonViewerProps {
  gameView: GameView;
}

export const BoardStateJsonViewer: React.FC<BoardStateJsonViewerProps> = ({ gameView }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="board-state-json-viewer">
      <div className="board-state-json-controls">
        <input
          type="text"
          className="board-state-json-search"
          placeholder="Search JSON..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          className="board-state-json-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Collapse All' : 'Expand All'}
        </button>
        <div className="board-state-json-info">
          {Object.keys(gameView).length} keys
        </div>
      </div>

      <div className="board-state-json-content">
        <JsonViewer
          data={gameView}
          searchTerm={searchTerm}
          defaultExpanded={expanded}
        />
      </div>
    </div>
  );
};
