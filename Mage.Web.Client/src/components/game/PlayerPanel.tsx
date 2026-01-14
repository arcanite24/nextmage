import React from 'react';
import { PlayerView } from '../../types';
import './GamePage.css';

interface PlayerPanelProps {
    player: PlayerView;
    isMe?: boolean;
    isOpponent?: boolean;
    onClick?: (playerId: string) => void;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ player, isMe, isOpponent, onClick }) => {
    return (
        <div
            id={`player-${player.playerId}`}
            className={`player-panel ${isMe ? 'me' : 'opponent'} ${onClick ? 'clickable' : ''}`}
            onClick={() => onClick && onClick(player.playerId)}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            <div className="player-avatar">
                <img
                    src={`/assets/avatars/${player.userData.avatarId}.jpg`}
                    alt={player.name}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        // The parent div will show the background or we could add a text fallback
                        const parent = e.currentTarget.parentElement;
                        if (parent && !parent.querySelector('.avatar-fallback')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'avatar-fallback';
                            fallback.innerText = player.name.charAt(0).toUpperCase();
                            fallback.style.width = '100%';
                            fallback.style.height = '100%';
                            fallback.style.display = 'flex';
                            fallback.style.alignItems = 'center';
                            fallback.style.justifyContent = 'center';
                            fallback.style.background = '#444';
                            fallback.style.color = '#ccc';
                            fallback.style.fontSize = '20px';
                            parent.appendChild(fallback);
                        }
                    }}
                />
            </div>
            <div className="player-info">
                <div className="player-name">
                    {player.name}
                    {player.hasPriority && <span className="priority-indicator">Priority</span>}
                </div>
                <div className="player-stats">
                    <span className="stat-life">❤️ {player.life}</span>
                    <span className="stat-hand">✋ {player.handCount}</span>
                    <span className="stat-library">📚 {player.libraryCount}</span>
                    <span className="stat-graveyard">💀 {Object.keys(player.graveyard).length}</span>
                </div>
                <div className="player-mana">
                    {player.manaPool.white > 0 && <span className="mana-w">{player.manaPool.white}</span>}
                    {player.manaPool.blue > 0 && <span className="mana-u">{player.manaPool.blue}</span>}
                    {player.manaPool.black > 0 && <span className="mana-b">{player.manaPool.black}</span>}
                    {player.manaPool.red > 0 && <span className="mana-r">{player.manaPool.red}</span>}
                    {player.manaPool.green > 0 && <span className="mana-g">{player.manaPool.green}</span>}
                    {player.manaPool.colorless > 0 && <span className="mana-c">{player.manaPool.colorless}</span>}
                </div>
            </div>
        </div>
    );
};
