import React, { useMemo } from 'react';
import { BookOpen, Hand, Skull, Sparkles, Zap } from 'lucide-react';
import { PlayerView } from '../../types';
import { useAnimationStore } from '../../stores';
import { MatchPlayerFlagPill, MatchPlayerHudDetails } from './MatchPlayerHudDetails';
import './ArenaLayout.css';
import './AttackAnimation.css';

interface ArenaOpponentHUDProps {
    player: PlayerView;
    isActivePlayer?: boolean;
    onShowZone?: (zone: 'graveyard' | 'exile' | 'library' | 'sideboard', playerId: string) => void;
    onInteract?: (uuid: string) => void;
    showPlayerName?: boolean;
    displayLifeOnAvatar?: boolean;
}

// Default avatar SVG
const DefaultAvatarSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28, color: '#94a3b8' }}>
        <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
        <path d="M12 14c-4.418 0-8 2.015-8 4.5V22h16v-3.5c0-2.485-3.582-4.5-8-4.5z" />
    </svg>
);

export const ArenaOpponentHUD: React.FC<ArenaOpponentHUDProps> = React.memo(({ player, isActivePlayer, onShowZone, onInteract, showPlayerName = true, displayLifeOnAvatar = true }) => {
    // Check for deferred life update (visual override)
    const visualLifeTotals = useAnimationStore(state => state.visualLifeTotals);
    const displayedLife = visualLifeTotals?.[player.playerId] ?? player.life;

    const graveyardCount = useMemo(() => Object.keys(player.graveyard).length, [player.graveyard]);
    const exileCount = useMemo(() => Object.keys(player.exile).length, [player.exile]);
    const lifeClass = useMemo(() => displayedLife <= 5 ? 'low' : displayedLife >= 30 ? 'high' : '', [displayedLife]);

    const activeLifeEffect = useAnimationStore((state) => {
        const effect = state.activeDamageEffects.find((entry) => entry.targetId === player.playerId);
        return effect?.type ?? 'none';
    });

    // Build avatar container class names
    const avatarContainerClasses = useMemo(() => {
        const classes = ['arena-opponent-avatar-container', 'clickable-stat'];
        if (isActivePlayer) classes.push('active-player');
        if (player.hasPriority) classes.push('has-priority');
        if (displayLifeOnAvatar && activeLifeEffect === 'damage') classes.push('taking-damage');
        if (displayLifeOnAvatar && activeLifeEffect === 'lifeGain') classes.push('gaining-life');
        return classes.join(' ');
    }, [isActivePlayer, player.hasPriority, activeLifeEffect, displayLifeOnAvatar]);

    return (
        <>
            {/* Opponent Info (Top Left) */}
            <div className="arena-opponent-info" data-testid="opponent-hud">
                {showPlayerName && (
                    <span className="arena-opponent-name" data-testid="opponent-name">
                        <MatchPlayerFlagPill flagName={player.userData?.flagName} />
                        {player.name}
                        {player.hasPriority && <Zap className="priority-indicator-opponent" size={13} aria-hidden="true" />}
                    </span>
                )}
                <div className="arena-opponent-stats">
                    <button
                        type="button"
                        title="Graveyard"
                        className="clickable-stat"
                        onClick={() => onShowZone?.('graveyard', player.playerId)}
                        aria-label={`View ${player.name}'s graveyard`}
                        data-testid="opponent-zone-graveyard"
                    >
                        <Skull size={14} aria-hidden="true" /> {graveyardCount}
                    </button>
                    {exileCount > 0 && (
                        <button
                            type="button"
                            title="Exile"
                            className="clickable-stat"
                            onClick={() => onShowZone?.('exile', player.playerId)}
                            aria-label={`View ${player.name}'s exile`}
                            data-testid="opponent-zone-exile"
                        >
                            <Sparkles size={14} aria-hidden="true" /> {exileCount}
                        </button>
                    )}
                </div>
            </div>

            {/* Opponent Avatar & Life (Top Center) */}
            <div className="arena-opponent-hud">
                <div
                    id={`player-${player.playerId}`}
                    className={avatarContainerClasses}
                    data-life-on-avatar={displayLifeOnAvatar ? 'true' : 'false'}
                    onClick={() => onInteract?.(player.playerId)}
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

                {displayLifeOnAvatar && (
                    <div className={`arena-opponent-life ${lifeClass}`} data-testid="opponent-avatar-life">
                        {displayedLife}
                    </div>
                )}

                <MatchPlayerHudDetails
                    player={player}
                    variant="opponent"
                    displayedLife={displayedLife}
                    onShowZone={onShowZone}
                />
            </div>

                {/* Deck Info next to avatar */}
                <div className="arena-opponent-deck-info">
                    <div className="arena-opponent-zone-mini" title="Library">
                        <BookOpen size={13} aria-hidden="true" /> {player.libraryCount}
                    </div>
                    <div className="arena-opponent-zone-mini" title="Hand">
                        <Hand size={13} aria-hidden="true" /> {player.handCount}
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
});
