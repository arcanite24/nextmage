import React, { useState } from 'react';
import { DebugAction } from '../../types/debug';

interface ActionEntryProps {
  action: DebugAction;
}

export const ActionEntry: React.FC<ActionEntryProps> = ({ action }) => {
  const [expanded, setExpanded] = useState(false);

  const timestamp = new Date(action.timestamp).toLocaleTimeString();
  const relativeTime = getRelativeTime(action.timestamp);

  return (
    <div className="action-entry">
      <div
        className="action-entry-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="action-entry-meta">
          <span className="action-entry-timestamp" title={timestamp}>
            {relativeTime}
          </span>
          <span className={`action-entry-type action-entry-type-${action.actionType}`}>
            {action.actionType}
          </span>
          <span className="action-entry-method">
            {action.method}
          </span>
        </div>
        <div className="action-entry-summary">
          {action.summary}
        </div>
        <span className="action-entry-expand">
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div className="action-entry-details">
          <div className="action-entry-timestamp-full">
            Full timestamp: {timestamp}
          </div>

          <div className="action-entry-data">
            <div className="action-entry-data-label">Callback Data:</div>
            <pre className="action-entry-json">
              {JSON.stringify(action.data, null, 2)}
            </pre>
          </div>

          {action.gameView && (
            <div className="action-entry-gameview">
              <div className="action-entry-data-label">
                GameView Snapshot (keys: {Object.keys(action.gameView).length}):
              </div>
              <pre className="action-entry-json">
                {JSON.stringify(action.gameView, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}
