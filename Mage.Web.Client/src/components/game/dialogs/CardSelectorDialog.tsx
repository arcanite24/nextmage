import React from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { CardView } from '../../../types';
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
    let handleCardClick = (cardId: string) => { };
    let handleCancel = () => { };

    if (isTarget || isSelect) {
        const actionData = pendingAction as any;
        cardsView = actionData.cardsView as Record<string, CardView> | undefined;
        message = actionData.message || 'Select a card';
        min = actionData.min || 1;
        max = actionData.max || 1;
        required = actionData.required;

        handleCardClick = (cardId: string) => {
            sendUUID(cardId);
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

    // If no cardsView is present, this dialog shouldn't be responsible for the UI
    // (The main GamePage handles battlefield targeting)
    // If no cardsView is present (or empty for target/select), this dialog shouldn't be responsible for the UI
    // (The main GamePage handles battlefield/hand targeting when no specific cardsView is provided)
    if (!cardsView) {
        return null;
    }

    const cards = Object.values(cardsView);

    // For interactive modes (target/select), if the provided list is empty, 
    // it usually means we should be picking from the battlefield or hand.
    // If we are just viewing (e.g. graveyard), showing "No cards" is fine.
    if ((isTarget || isSelect) && cards.length === 0) {
        return null;
    }

    return (
        <Modal
            isOpen={props.isOpen ?? true}
            onClose={props.onClose || (required ? () => { } : handleCancel)}
            title="Select Cards"
            size="lg" // We might want a custom size for this
            closeOnBackdrop={!required}
            closeOnEscape={!required}
        >
            <div className="card-selector-container">
                <div className="card-selector-message" dangerouslySetInnerHTML={{ __html: message }} />

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
                    {cards.length === 0 && (
                        <div className="card-selector-empty">No cards to display</div>
                    )}
                </div>

                <div className="card-selector-footer">
                    {/* If optional or min=0, show Cancel/Done */}
                    {!required && (
                        <Button variant="secondary" onClick={handleCancel}>
                            Cancel
                        </Button>
                    )}
                    {/* 
              TODO: Validating min/max selections if we move to multi-select:
              <span className="selection-count">Selected: 0 / {max}</span>
              <Button variant="primary" disabled>Confirm</Button> 
           */}
                </div>
            </div>
        </Modal>
    );
};
