import React from 'react';
import { PlayerView } from '../../types';
import './ArenaLayout.css';

interface ArenaOpponentHUDProps {
    player: PlayerView;
    onShowZone?: (zone: 'graveyard' | 'exile' | 'library' | 'sideboard', playerId: string) => void;
    onInteract?: (uuid: string) => void;
}

// Default avatar SVG
const DefaultAvatarSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28, color: '#94a3b8' }}>
        <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
        <path d="M12 14c-4.418 0-8 2.015-8 4.5V22h16v-3.5c0-2.485-3.582-4.5-8-4.5z" />
    </svg>
);

export const ArenaOpponentHUD: React.FC<ArenaOpponentHUDProps> = ({ player, onShowZone, onInteract }) => {
    const graveyardCount = Object.keys(player.graveyard).length;
    const exileCount = Object.keys(player.exile).length;
    const lifeClass = player.life <= 5 ? 'low' : player.life >= 30 ? 'high' : '';

    return (
        <>
            {/* Opponent Info (Top Left) */}
            <div className="arena-opponent-info">
                <span className="arena-opponent-name">
                    {player.name}
                    {player.hasPriority && <span style={{ color: '#fbbf24', marginLeft: 4 }}>⚡</span>}
                </span>
                <div className="arena-opponent-stats">
                    <span
                        title="Graveyard"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onShowZone?.('graveyard', player.playerId)}
                    >
                        💀 {graveyardCount}
                    </span>
                    {exileCount > 0 && (
                        <span
                            title="Exile"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onShowZone?.('exile', player.playerId)}
                        >
                            🌌 {exileCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Opponent Avatar & Life (Top Center) */}
            <div className="arena-opponent-hud">
                <div
                    className="arena-opponent-avatar-container"
                    onClick={() => onInteract?.(player.playerId)}
                    style={{ cursor: 'pointer' }}
                    title="Click to target player"
                >
                    <div className="arena-opponent-avatar">
                        {player.userData?.avatarId ? (
                            <img
                                src={`/assets/avatars/${player.userData.avatarId}.jpg`}
                                alt={player.name}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : (
                            <DefaultAvatarSVG />
                        )}
                    </div>

                    <div className={`arena-opponent-life ${lifeClass}`}>
                        {player.life}
                    </div>
                </div>

                {/* Deck Info next to avatar */}
                <div className="arena-opponent-deck-info">
                    <div className="arena-opponent-zone-mini" title="Library">
                        📚 {player.libraryCount}
                    </div>
                    <div className="arena-opponent-zone-mini" title="Hand">
                        ✋ {player.handCount}
                    </div>
                </div>
            </div>

            {/* Opponent Hand Indicator (card backs) */}
            {player.handCount > 0 && (
                <div className="arena-opponent-hand-indicator">
                    {Array.from({ length: Math.min(player.handCount, 7) }).map((_, i) => (
                        <div key={i} className="arena-hand-back-card">
                            <img src="/back.webp" alt="Card back" />
                        </div>
                    ))}
                    {player.handCount > 7 && (
                        <div className="arena-hand-back-card extra-cards">
                            <img src="/back.webp" alt="Card back" />
                            <span className="extra-count">+{player.handCount - 7}</span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
