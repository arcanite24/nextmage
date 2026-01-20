import React, { useState } from 'react';
import { GameView } from '../../types/game';

interface BoardStateSummaryProps {
  gameView: GameView;
}

export const BoardStateSummary: React.FC<BoardStateSummaryProps> = ({ gameView }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['players', 'gameInfo']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderSection = (id: string, title: string, children: React.ReactNode) => (
    <div className="board-state-section">
      <div
        className="board-state-section-header"
        onClick={() => toggleSection(id)}
      >
        <span className="board-state-section-icon">
          {expandedSections.has(id) ? '▼' : '▶'}
        </span>
        <span className="board-state-section-title">{title}</span>
      </div>
      {expandedSections.has(id) && (
        <div className="board-state-section-content">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="board-state-summary">
      {renderSection('gameInfo', 'Game Information', (
        <div className="board-state-game-info">
          <div className="board-state-info-row">
            <span className="board-state-label">Turn:</span>
            <span className="board-state-value">{gameView.turn}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Phase:</span>
            <span className="board-state-value">{gameView.phase}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Step:</span>
            <span className="board-state-value">{gameView.step}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Active Player:</span>
            <span className="board-state-value">{gameView.activePlayerName}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Priority Player:</span>
            <span className="board-state-value">{gameView.priorityPlayerName}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Game Cycle:</span>
            <span className="board-state-value">{gameView.gameCycle}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Total Effects:</span>
            <span className="board-state-value">{gameView.totalEffectsCount}</span>
          </div>
          <div className="board-state-info-row">
            <span className="board-state-label">Total Errors:</span>
            <span className="board-state-value error">{gameView.totalErrorsCount}</span>
          </div>
        </div>
      ))}

      {renderSection('players', 'Players', (
        <div className="board-state-players">
          {gameView.players.map(player => (
            <div key={player.playerId} className="board-state-player-card">
              <div className="board-state-player-header">
                <span className="board-state-player-name">{player.name}</span>
                <div className="board-state-player-badges">
                  {player.isActive && <span className="badge badge-active">Active</span>}
                  {player.hasPriority && <span className="badge badge-priority">Priority</span>}
                  {player.monarch && <span className="badge badge-monarch">Monarch</span>}
                  {player.initiative && <span className="badge badge-initiative">Initiative</span>}
                </div>
              </div>

              <div className="board-state-player-stats">
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Life:</span>
                  <span className="board-state-stat-value">{player.life}</span>
                </div>
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Hand:</span>
                  <span className="board-state-stat-value">{player.handCount}</span>
                </div>
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Graveyard:</span>
                  <span className="board-state-stat-value">{Object.keys(player.graveyard).length}</span>
                </div>
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Exile:</span>
                  <span className="board-state-stat-value">{Object.keys(player.exile).length}</span>
                </div>
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Battlefield:</span>
                  <span className="board-state-stat-value">{Object.keys(player.battlefield).length}</span>
                </div>
                <div className="board-state-stat">
                  <span className="board-state-stat-label">Library:</span>
                  <span className="board-state-stat-value">{player.libraryCount}</span>
                </div>
              </div>

              <div className="board-state-player-mana">
                <span className="board-state-mana-label">Mana Pool:</span>
                <span className="board-state-mana-pool">
                  W:{player.manaPool.white}
                  U:{player.manaPool.blue}
                  B:{player.manaPool.black}
                  R:{player.manaPool.red}
                  G:{player.manaPool.green}
                  C:{player.manaPool.colorless}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {renderSection('stack', 'Stack', (
        <div className="board-state-stack">
          {Object.keys(gameView.stack).length === 0 ? (
            <div className="board-state-empty">Stack is empty</div>
          ) : (
            Object.values(gameView.stack).map(item => (
              <div key={item.id} className="board-state-stack-item">
                <span className="board-state-stack-name">{item.name}</span>
                <span className="board-state-stack-type">{item.cardTypes.join(', ')}</span>
              </div>
            ))
          )}
        </div>
      ))}

      {renderSection('combat', 'Combat', (
        <div className="board-state-combat">
          {gameView.combat.length === 0 ? (
            <div className="board-state-empty">No combat</div>
          ) : (
            <div className="board-state-combat-groups">
              {gameView.combat.map((group, idx) => (
                <div key={idx} className="board-state-combat-group">
                  <div className="board-state-combat-header">
                    Combat Group {idx + 1}: {group.defenderName}
                  </div>
                  <div className="board-state-combat-details">
                    <div>Attackers: {Object.keys(group.attackers).length}</div>
                    <div>Blockers: {Object.keys(group.blockers).length}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {renderSection('myHand', 'My Hand', (
        <div className="board-state-hand">
          {Object.keys(gameView.myHand).length === 0 ? (
            <div className="board-state-empty">Hand is empty</div>
          ) : (
            <div className="board-state-hand-cards">
              {Object.values(gameView.myHand).map(card => (
                <div key={card.id} className="board-state-hand-card">
                  {card.name}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
