import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PlayerView } from '../../types';
import { useAnimationStore, useGameStore } from '../../stores';
import './ArenaLayout.css';
import './AttackAnimation.css';

interface ArenaPlayerHUDProps {
    player: PlayerView;
    isMe?: boolean;
    isActivePlayer?: boolean;
    onShowZone?: (zone: 'graveyard' | 'exile' | 'library' | 'sideboard', playerId: string) => void;
    onInteract?: (uuid: string) => void;
}

// Default avatar SVG
const DefaultAvatarSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
        <path d="M12 14c-4.418 0-8 2.015-8 4.5V22h16v-3.5c0-2.485-3.582-4.5-8-4.5z" />
    </svg>
);

export const ArenaPlayerHUD: React.FC<ArenaPlayerHUDProps> = React.memo(({ player, isMe, isActivePlayer, onShowZone, onInteract }) => {
    // Check for deferred life update (visual override)
    const visualLifeTotals = useAnimationStore(useShallow(state => state.visualLifeTotals));
    const displayedLife = visualLifeTotals?.[player.playerId] ?? player.life;

    const lifeClass = useMemo(() => displayedLife <= 5 ? 'low' : displayedLife >= 30 ? 'high' : '', [displayedLife]);
    const graveyardCount = useMemo(() => Object.keys(player.graveyard).length, [player.graveyard]);
    const exileCount = useMemo(() => Object.keys(player.exile).length, [player.exile]);

    // Check if this player is currently taking damage
    const isTakingDamage = useAnimationStore(
        useShallow((state) => state.activeDamageEffects.some((d) => d.targetId === player.playerId))
    );

    // Check if player has any mana in pool
    const hasMana = useMemo(() => player.manaPool && (
        player.manaPool.white > 0 ||
        player.manaPool.blue > 0 ||
        player.manaPool.black > 0 ||
        player.manaPool.red > 0 ||
        player.manaPool.green > 0 ||
        player.manaPool.colorless > 0
    ), [player.manaPool]);

    // Build avatar container class names
    const avatarContainerClasses = useMemo(() => {
        const classes = ['arena-avatar-container'];
        if (isActivePlayer) classes.push('active-player');
        if (player.hasPriority) classes.push('has-priority');
        if (isTakingDamage) classes.push('taking-damage');
        return classes.join(' ');
    }, [isActivePlayer, player.hasPriority, isTakingDamage]);

    return (
        <>
            {/* Player Name & Zone Buttons (Bottom Left) */}
            <div className="arena-player-info-left">
                <div
                    className="arena-player-name-box"
                    onClick={() => onInteract?.(player.playerId)}
                >
                    <span className="arena-player-name">{player.name}</span>
                    {player.hasPriority && (
                        <span className="priority-indicator-hud">⚡</span>
                    )}
                </div>

                <div className="arena-zone-buttons">
                    {/* Graveyard */}
                    <div
                        className="arena-zone-button"
                        onClick={() => onShowZone?.('graveyard', player.playerId)}
                        title="View Graveyard"
                    >
                        <div className="arena-zone-icon graveyard">
                            💀
                            {graveyardCount > 0 && (
                                <span className="arena-zone-count">{graveyardCount}</span>
                            )}
                        </div>
                    </div>

                    {/* Library/Deck */}
                    <div
                        className="arena-zone-button"
                        onClick={() => onShowZone?.('library', player.playerId)}
                        title="View Library"
                    >
                        <div className="arena-zone-icon library">
                            📚
                            <span className="arena-zone-count">{player.libraryCount}</span>
                        </div>
                    </div>

                    {/* Exile */}
                    {exileCount > 0 && (
                        <div
                            className="arena-zone-button"
                            onClick={() => onShowZone?.('exile', player.playerId)}
                            title="View Exile"
                        >
                            <div className="arena-zone-icon exile">
                                🌌
                                <span className="arena-zone-count">{exileCount}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Avatar & Life (Center, above hand) */}
            <div id={`player-${player.playerId}`} className={avatarContainerClasses}>
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

                <div className="arena-life-display">
                    <span className={`arena-life-value ${lifeClass}`}>
                        {displayedLife}
                    </span>
                </div>

                {/* Mana pool display */}
                {hasMana && (
                    <div className="arena-mana-display">
                        {player.manaPool.white > 0 && (
                            <span className="arena-mana-pip w">{player.manaPool.white}</span>
                        )}
                        {player.manaPool.blue > 0 && (
                            <span className="arena-mana-pip u">{player.manaPool.blue}</span>
                        )}
                        {player.manaPool.black > 0 && (
                            <span className="arena-mana-pip b">{player.manaPool.black}</span>
                        )}
                        {player.manaPool.red > 0 && (
                            <span className="arena-mana-pip r">{player.manaPool.red}</span>
                        )}
                        {player.manaPool.green > 0 && (
                            <span className="arena-mana-pip g">{player.manaPool.green}</span>
                        )}
                        {player.manaPool.colorless > 0 && (
                            <span className="arena-mana-pip c">{player.manaPool.colorless}</span>
                        )}
                    </div>
                )}
            </div>
        </>
    );
});
