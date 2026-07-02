/**
 * Pile Dialog
 * 
 * Dialog for choosing between two piles of cards (e.g., Fact or Fiction).
 */

import React from 'react';
import { Modal, Button } from '../common';
import { useGameStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import { CardView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import './PileDialog.css';

interface PileDialogProps {
    isOpen: boolean;
    message: string;
    pile1: Record<string, CardView>;
    pile2: Record<string, CardView>;
}

export const PileDialog: React.FC<PileDialogProps> = ({
    isOpen,
    message,
    pile1,
    pile2,
}) => {
    const sendBoolean = useGameStore(state => state.sendBoolean);
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);

    const pile1Cards = Object.values(pile1);
    const pile2Cards = Object.values(pile2);

    const handleSelectPile = (isPile1: boolean) => {
        sendBoolean(isPile1);
    };

    const handleSelectButtonClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        isPile1: boolean,
    ) => {
        event.stopPropagation();
        handleSelectPile(isPile1);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { }} // Can't close without selecting
            title="Choose a Pile"
            size="lg"
            closeOnBackdrop={false}
            closeOnEscape={false}
            showCloseButton={false}
        >
            <div className="pile-dialog">
                <p className="pile-message" dangerouslySetInnerHTML={{ __html: message }} />

                <div className="pile-container">
                    {/* Pile 1 */}
                    <div
                        className="pile pile-1"
                        onClick={() => handleSelectPile(true)}
                    >
                        <div className="pile-header">
                            <span className="pile-label">Pile 1</span>
                            <span className="pile-count">{pile1Cards.length} card{pile1Cards.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="pile-cards">
                            {pile1Cards.length > 0 ? (
                                pile1Cards.map((card) => (
                                    <div key={card.id} className="pile-card">
                                        <img
                                            src={cardImageService.getImageUrl(card)}
                                            alt={card.name}
                                            className="pile-card-image"
                                            onError={(event) => {
                                                event.currentTarget.src = cardImageService.getFallbackImageUrl(card, cardImageFallbackMode);
                                            }}
                                        />
                                        <div className="pile-card-name">{card.name}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="pile-empty">No cards</div>
                            )}
                        </div>
                        <Button
                            variant="primary"
                            size="md"
                            className="pile-select-btn"
                            onClick={(event) => handleSelectButtonClick(event, true)}
                            autoFocus
                        >
                            Select Pile 1
                        </Button>
                    </div>

                    {/* Divider */}
                    <div className="pile-divider">
                        <span>OR</span>
                    </div>

                    {/* Pile 2 */}
                    <div
                        className="pile pile-2"
                        onClick={() => handleSelectPile(false)}
                    >
                        <div className="pile-header">
                            <span className="pile-label">Pile 2</span>
                            <span className="pile-count">{pile2Cards.length} card{pile2Cards.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="pile-cards">
                            {pile2Cards.length > 0 ? (
                                pile2Cards.map((card) => (
                                    <div key={card.id} className="pile-card">
                                        <img
                                            src={cardImageService.getImageUrl(card)}
                                            alt={card.name}
                                            className="pile-card-image"
                                            onError={(event) => {
                                                event.currentTarget.src = cardImageService.getFallbackImageUrl(card, cardImageFallbackMode);
                                            }}
                                        />
                                        <div className="pile-card-name">{card.name}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="pile-empty">No cards</div>
                            )}
                        </div>
                        <Button
                            variant="primary"
                            size="md"
                            className="pile-select-btn"
                            onClick={(event) => handleSelectButtonClick(event, false)}
                        >
                            Select Pile 2
                        </Button>
                    </div>
                </div>

                <div className="pile-hint">
                    💡 Click on a pile or its button to select
                </div>
            </div>
        </Modal>
    );
};
