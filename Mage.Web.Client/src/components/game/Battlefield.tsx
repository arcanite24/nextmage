import React from 'react';
import { PlayerView } from '../../types';
import { useGameStore } from '../../stores';
import { cardImageService } from '../../services/CardImageService';
import './GamePage.css';

interface BattlefieldProps {
    player: PlayerView;
    isMe?: boolean;
    onCardClick?: (cardId: string) => void;
    onCardInspect?: (cardId: string) => void;
}

export const Battlefield: React.FC<BattlefieldProps> = ({ player, isMe, onCardClick, onCardInspect }) => {
    const permanents = player.battlefield ? Object.values(player.battlefield) : [];

    const lands = permanents.filter(p => p.cardTypes.includes('Land'));
    const creatures = permanents.filter(p => !p.cardTypes.includes('Land'));

    const handleCardClick = (cardId: string) => {
        if (onCardClick) onCardClick(cardId);
    };

    const { gameView } = useGameStore();

    // Helper to check combat state
    const getCombatState = (cardId: string) => {
        if (!gameView || !gameView.combat) return null;

        for (const group of gameView.combat) {
            if (group.attackers && group.attackers[cardId]) return 'attacking';
            if (group.blockers && group.blockers[cardId]) return 'blocking';
        }
        return null;
    };

    const renderRow = (type: 'lands' | 'creatures', cards: typeof permanents) => (
        <div className={`battlefield-row ${type}`}>
            {cards.map(card => {
                const isLand = card.cardTypes.includes('Land');
                const isCreature = card.cardTypes.includes('Creature');
                const isPlaneswalker = card.cardTypes.includes('Planeswalker');
                const isBattle = card.cardTypes.includes('Battle');

                const combatState = getCombatState(card.id);
                // Summoning sickness: only relevant for creatures that are not tapped (usually) and controlled by active player? 
                // Actually server tells us `summoningSickness` boolean. Just use it.
                // Usually indicated by "dizzy" look.

                return (
                    <div
                        key={card.id}
                        id={`card-${card.id}`}
                        className={`permanent ${card.tapped ? 'tapped' : ''} ${card.isAbility ? 'ability' : ''} ${combatState ? combatState : ''}`}
                        onClick={() => handleCardClick(card.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            if (onCardInspect) onCardInspect(card.id);
                        }}
                    >
                        <img
                            src={cardImageService.getImageUrl(card)}
                            alt={card.name}
                            onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
                        />

                        {/* Status Icons Overlay */}
                        <div className="card-status-overlay">
                            {card.summoningSickness && (
                                <div className="status-icon sickness" title="Summoning Sickness">
                                    💫
                                </div>
                            )}
                            {combatState === 'attacking' && (
                                <div className="status-icon attacking" title="Attacking">
                                    ⚔️
                                </div>
                            )}
                            {combatState === 'blocking' && (
                                <div className="status-icon blocking" title="Blocking">
                                    🛡️
                                </div>
                            )}
                        </div>

                        {/* Only show P/T for creatures, or if it has non-empty power/toughness that isn't just a basic land default */}
                        {isCreature && card.power !== "" && card.toughness !== "" && (
                            <div className="pt-badge">{card.power}/{card.toughness}</div>
                        )}
                        {/* Loyalty for Planeswalkers */}
                        {isPlaneswalker && card.loyalty !== "" && (
                            <div className="loyalty-badge">{card.loyalty}</div>
                        )}
                        {/* Defense for Battles */}
                        {isBattle && card.defense !== "" && (
                            <div className="defense-badge">{card.defense}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={`battlefield ${isMe ? 'me' : 'opponent'}`}>
            {/* For me: creatures are in front (top), lands in back (bottom) */}
            {/* For opponent: lands in back (top), creatures in front (bottom) */}
            {isMe ? (
                <>
                    {renderRow('creatures', creatures)}
                    {renderRow('lands', lands)}
                </>
            ) : (
                <>
                    {renderRow('lands', lands)}
                    {renderRow('creatures', creatures)}
                </>
            )}
        </div>
    );
};
