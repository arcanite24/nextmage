import React, { useMemo } from 'react';
import { BookOpen, Skull, Sparkles, Zap } from 'lucide-react';
import { ManaType, PlayerView } from '../../types';
import { useAnimationStore } from '../../stores';
import { MatchPlayerFlagPill, MatchPlayerHudDetails } from './MatchPlayerHudDetails';
import './ArenaLayout.css';
import './AttackAnimation.css';

interface ArenaPlayerHUDProps {
    player: PlayerView;
    isMe?: boolean;
    isActivePlayer?: boolean;
    onShowZone?: (zone: 'graveyard' | 'exile' | 'library' | 'sideboard', playerId: string) => void;
    onInteract?: (uuid: string) => void;
    onManaClick?: (manaType: ManaType) => void;
    showPlayerName?: boolean;
    displayLifeOnAvatar?: boolean;
}

// Default avatar SVG
const DefaultAvatarSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
        <path d="M12 14c-4.418 0-8 2.015-8 4.5V22h16v-3.5c0-2.485-3.582-4.5-8-4.5z" />
    </svg>
);

export const ArenaPlayerHUD: React.FC<ArenaPlayerHUDProps> = React.memo(({ player, isActivePlayer, onShowZone, onInteract, onManaClick, showPlayerName = true, displayLifeOnAvatar = true }) => {
    // Check for deferred life update (visual override)
    const visualLifeTotals = useAnimationStore(state => state.visualLifeTotals);
    const displayedLife = visualLifeTotals?.[player.playerId] ?? player.life;

    const lifeClass = useMemo(() => displayedLife <= 5 ? 'low' : displayedLife >= 30 ? 'high' : '', [displayedLife]);
    const graveyardCount = useMemo(() => Object.keys(player.graveyard).length, [player.graveyard]);
    const exileCount = useMemo(() => Object.keys(player.exile).length, [player.exile]);

    const activeLifeEffect = useAnimationStore((state) => {
        const effect = state.activeDamageEffects.find((entry) => entry.targetId === player.playerId);
        return effect?.type ?? 'none';
    });

    // Build avatar container class names
    const avatarContainerClasses = useMemo(() => {
        const classes = ['arena-avatar-container'];
        if (isActivePlayer) classes.push('active-player');
        if (player.hasPriority) classes.push('has-priority');
        if (displayLifeOnAvatar && activeLifeEffect === 'damage') classes.push('taking-damage');
        if (displayLifeOnAvatar && activeLifeEffect === 'lifeGain') classes.push('gaining-life');
        return classes.join(' ');
    }, [isActivePlayer, player.hasPriority, activeLifeEffect, displayLifeOnAvatar]);

    return (
        <>
            {/* Player Name & Zone Buttons (Bottom Left) */}
            <div className="arena-player-info-left" data-testid="player-hud">
                {showPlayerName && (
                    <div
                        className="arena-player-name-box"
                        onClick={() => onInteract?.(player.playerId)}
                        data-testid="player-name"
                    >
                        <MatchPlayerFlagPill flagName={player.userData?.flagName} />
                        <span className="arena-player-name">{player.name}</span>
                        {player.hasPriority && (
                            <Zap className="priority-indicator-hud" size={13} aria-hidden="true" />
                        )}
                    </div>
                )}

                <div className="arena-zone-buttons">
                    {/* Graveyard */}
                    <button
                        type="button"
                        className="arena-zone-button"
                        onClick={() => onShowZone?.('graveyard', player.playerId)}
                        title="View Graveyard"
                        aria-label={`View ${player.name}'s graveyard`}
                        data-testid="player-zone-graveyard"
                    >
                        <div className="arena-zone-icon graveyard">
                            <Skull size={17} aria-hidden="true" />
                            {graveyardCount > 0 && (
                                <span className="arena-zone-count">{graveyardCount}</span>
                            )}
                        </div>
                    </button>

                    {/* Library/Deck */}
                    <button
                        type="button"
                        className="arena-zone-button"
                        onClick={() => onShowZone?.('library', player.playerId)}
                        title="View Library"
                        aria-label={`View ${player.name}'s library`}
                        data-testid="player-zone-library"
                    >
                        <div className="arena-zone-icon library">
                            <BookOpen size={17} aria-hidden="true" />
                            <span className="arena-zone-count">{player.libraryCount}</span>
                        </div>
                    </button>

                    {/* Exile */}
                    {exileCount > 0 && (
                        <button
                            type="button"
                            className="arena-zone-button"
                            onClick={() => onShowZone?.('exile', player.playerId)}
                            title="View Exile"
                            aria-label={`View ${player.name}'s exile`}
                            data-testid="player-zone-exile"
                        >
                            <div className="arena-zone-icon exile">
                                <Sparkles size={17} aria-hidden="true" />
                                <span className="arena-zone-count">{exileCount}</span>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Avatar & Life (Center, above hand) */}
            <div id={`player-${player.playerId}`} className={avatarContainerClasses} data-life-on-avatar={displayLifeOnAvatar ? 'true' : 'false'}>
                <div
                    className="arena-avatar"
                    onClick={() => onInteract?.(player.playerId)}
                    style={{ cursor: 'pointer' }}
                    title="Click to target yourself"
                >
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
                    {!player.userData?.avatarId && (
                        <div className="arena-avatar-fallback">
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {displayLifeOnAvatar && (
                    <div className="arena-life-display" data-testid="player-avatar-life">
                        <span className={`arena-life-value ${lifeClass}`}>
                            {displayedLife}
                        </span>
                    </div>
                )}

                <MatchPlayerHudDetails
                    player={player}
                    variant="player"
                    displayedLife={displayedLife}
                    onShowZone={onShowZone}
                    onManaClick={onManaClick}
                />
            </div>
        </>
    );
});
