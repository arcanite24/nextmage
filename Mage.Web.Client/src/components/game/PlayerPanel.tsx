import React from 'react';
import { PlayerView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { useSettingsStore } from '../../stores/settingsStore';
import './GamePage.css';

interface PlayerPanelProps {
    player: PlayerView;
    isMe?: boolean;
    isOpponent?: boolean;
    onClick?: (playerId: string) => void;
    onShowZone?: (zone: 'graveyard' | 'exile' | 'library' | 'sideboard', playerId: string) => void;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ player, isMe, isOpponent, onClick, onShowZone }) => {
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);

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
                    <span
                        className="stat-graveyard clickable-stat"
                        onClick={(e) => { e.stopPropagation(); onShowZone && onShowZone('graveyard', player.playerId); }}
                        title="View Graveyard"
                    >
                        💀 {Object.keys(player.graveyard).length}
                    </span>
                    <span
                        className="stat-exile clickable-stat"
                        onClick={(e) => { e.stopPropagation(); onShowZone && onShowZone('exile', player.playerId); }}
                        title="View Exile"
                    >
                        🌌 {Object.keys(player.exile).length}
                    </span>
                </div>
                <div className="player-mana">
                    {player.manaPool.white > 0 && <span className="mana-w">{player.manaPool.white}</span>}
                    {player.manaPool.blue > 0 && <span className="mana-u">{player.manaPool.blue}</span>}
                    {player.manaPool.black > 0 && <span className="mana-b">{player.manaPool.black}</span>}
                    {player.manaPool.red > 0 && <span className="mana-r">{player.manaPool.red}</span>}
                    {player.manaPool.green > 0 && <span className="mana-g">{player.manaPool.green}</span>}
                    {player.manaPool.colorless > 0 && <span className="mana-c">{player.manaPool.colorless}</span>}
                </div>
                {player.topCard && (
                    <div className="player-top-card" style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Top Card:</div>
                        <img
                            src={cardImageService.getImageUrl(player.topCard)}
                            alt="Top Card"
                            style={{ height: '60px', borderRadius: '4px' }}
                            onError={(event) => {
                                event.currentTarget.src = cardImageService.getFallbackImageUrl(player.topCard, cardImageFallbackMode);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
