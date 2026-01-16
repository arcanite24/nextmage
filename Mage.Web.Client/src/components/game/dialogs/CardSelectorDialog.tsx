import React from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { CardView, PlayerView } from '../../../types';
import { cardImageService } from '../../../services/CardImageService';
import { Modal, Button } from '../../common'; // Adjust paths as needed
import './CardSelectorDialog.css';

import { PendingAction } from '../../../stores/gameStore';

interface CardSelectorDialogProps {
    isOpen?: boolean;
    pendingAction?: PendingAction;
    showingZone?: 'graveyard' | 'exile' | 'library' | 'sideboard';
    showingPlayerId?: string;
    onClose?: () => void;
}

export const CardSelectorDialog: React.FC<CardSelectorDialogProps> = (props) => {
    const store = useGameStore();

    // Use props if provided, otherwise fall back to store
    const pendingAction = props.pendingAction || store.pendingAction;
    const showingZone = props.showingZone || store.showingZone;
    const showingPlayerId = props.showingPlayerId || store.showingPlayerId;
    const gameView = store.gameView;
    const showZone = store.showZone;
    const sendUUID = store.sendUUID;
    const sendPlayerAction = store.sendPlayerAction;

    // Determine source of data: Pending Action OR Showing Zone
    const isTarget = pendingAction.type === 'target';
    const isSelect = pendingAction.type === 'select';
    const isViewing = !!(showingZone && showingPlayerId);

    if (!isTarget && !isSelect && !isViewing) {
        return null;
    }

    let cardsView: Record<string, CardView> | undefined;
    let message = '';
    let min = 0;
    let max = 0;
    let required = false;
    let validTargets: string[] = [];
    let handleCardClick = (cardId: string) => { };
    let handlePlayerClick = (playerId: string) => { };
    let handleCancel = () => { };

    if (isTarget || isSelect) {
        const actionData = pendingAction as any;
        cardsView = actionData.cardsView as Record<string, CardView> | undefined;
        message = actionData.message || 'Select a card';
        min = actionData.min || 1;
        max = actionData.max || 1;
        required = actionData.required;
        validTargets = actionData.validTargets || [];

        handleCardClick = (cardId: string) => {
            sendUUID(cardId);
        };

        handlePlayerClick = (playerId: string) => {
            sendUUID(playerId);
        };

        handleCancel = () => {
            if (!required) {
                sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
            }
        };
    } else if (isViewing && gameView) {
        // Find the player
        const player = gameView.players.find(p => p.playerId === showingPlayerId);
        if (player) {
            if (showingZone === 'graveyard') cardsView = player.graveyard;
            else if (showingZone === 'exile') cardsView = player.exile;
            else if (showingZone === 'sideboard') cardsView = player.sideboard;
            else if (showingZone === 'library') cardsView = {}; // Library usually hidden

            message = `${player.name}'s ${showingZone}`;
            required = false; // Viewing is never required

            handleCancel = () => {
                showZone(null, null); // Close viewer
            };
        }
    }

    const cards = cardsView ? Object.values(cardsView) : [];

    // Check if this is a player selection scenario
    // If message contains "player" and we have valid targets that match player IDs
    const isPlayerSelection = (isTarget || isSelect) &&
        validTargets.length > 0 &&
        gameView?.players?.some(p => validTargets.includes(p.playerId));

    // Get the players that are valid targets
    const targetablePlayers: PlayerView[] = isPlayerSelection && gameView?.players
        ? gameView.players.filter(p => validTargets.includes(p.playerId))
        : [];

    // If no cardsView and not player selection, don't show this dialog
    // (The main GamePage handles battlefield/hand targeting when no specific cardsView is provided)
    if (!cardsView && !isPlayerSelection && !isViewing) {
        return null;
    }

    // For interactive modes (target/select), if the provided list is empty and not player selection, 
    // it usually means we should be picking from the battlefield or hand.
    // If we are just viewing (e.g. graveyard), showing "No cards" is fine.
    if ((isTarget || isSelect) && cards.length === 0 && !isPlayerSelection) {
        return null;
    }

    return (
        <Modal
            isOpen={props.isOpen ?? true}
            onClose={props.onClose || (required ? () => { } : handleCancel)}
            title="Select Target"
            size="lg"
            closeOnBackdrop={!required}
            closeOnEscape={!required}
        >
            <div className="card-selector-container">
                <div className="card-selector-message" dangerouslySetInnerHTML={{ __html: message }} />

                {/* Player Selection UI */}
                {isPlayerSelection && targetablePlayers.length > 0 && (
                    <div className="player-selector-section">
                        <div className="player-selector-label">Select a Player:</div>
                        <div className="player-selector-list">
                            {targetablePlayers.map((player) => (
                                <div
                                    key={player.playerId}
                                    className="player-selector-item"
                                    onClick={() => handlePlayerClick(player.playerId)}
                                >
                                    <div className="player-selector-avatar">
                                        {player.userData?.avatarId ? (
                                            <img
                                                src={`/assets/avatars/${player.userData.avatarId}.jpg`}
                                                alt={player.name}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="player-selector-avatar-fallback">
                                                {player.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="player-selector-info">
                                        <div className="player-selector-name">{player.name}</div>
                                        <div className="player-selector-stats">
                                            <span>❤️ {player.life}</span>
                                            <span>✋ {player.handCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Card Selection UI */}
                {cards.length > 0 && (
                    <div className="card-selector-cards">
                        {cards.map((card) => (
                            <div
                                key={card.id}
                                className="card-selector-item"
                                onClick={() => handleCardClick(card.id)}
                            >
                                <img
                                    src={cardImageService.getImageUrl(card)}
                                    alt={card.name}
                                    loading="lazy"
                                    onError={(e) => e.currentTarget.src = cardImageService.getPlaceholderUrl()}
                                />
                                <div className="card-selector-name">{card.name}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state for viewing zones */}
                {cards.length === 0 && !isPlayerSelection && (
                    <div className="card-selector-empty">No cards to display</div>
                )}

                <div className="card-selector-footer">
                    {/* If optional or min=0, show Cancel/Done */}
                    {!required && (
                        <Button variant="secondary" onClick={handleCancel}>
                            Cancel
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
