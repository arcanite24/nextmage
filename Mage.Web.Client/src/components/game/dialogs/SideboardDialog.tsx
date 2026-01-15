import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../common';
import { DeckView, SimpleCardView, SimpleCardsView } from '../../../types/api';
import { cardImageService } from '../../../services/CardImageService';
import './SideboardDialog.css';

interface SideboardDialogProps {
    isOpen: boolean;
    deck: DeckView;
    onClose: () => void; // Should probably be 'onCancel' effectively
    onSubmit: (deck: DeckView) => void;
}

// Helper to convert SimpleCardsView (Record<UUID, SimpleCardView>) to array for rendering
const toArray = (cards: SimpleCardsView): SimpleCardView[] => {
    return Object.values(cards).sort((a, b) => a.name.localeCompare(b.name));
};

export const SideboardDialog: React.FC<SideboardDialogProps> = ({
    isOpen,
    deck: initialDeck,
    onClose,
    onSubmit
}) => {
    // We need to manage local state of maindeck and sideboard
    // The server sends us specific card instances (UUIDs), so we move them between lists.
    const [mainDeck, setMainDeck] = useState<SimpleCardView[]>([]);
    const [sideboard, setSideboard] = useState<SimpleCardView[]>([]);
    const [selectedMain, setSelectedMain] = useState<Set<string>>(new Set());
    const [selectedSide, setSelectedSide] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (initialDeck && isOpen) {
            setMainDeck(toArray(initialDeck.cards));
            setSideboard(toArray(initialDeck.sideboard));
            setSelectedMain(new Set());
            setSelectedSide(new Set());
        }
    }, [initialDeck, isOpen]);

    const handleCardClick = (cardId: string, isSideboard: boolean) => {
        if (isSideboard) {
            const newSelected = new Set(selectedSide);
            if (newSelected.has(cardId)) {
                newSelected.delete(cardId);
            } else {
                newSelected.add(cardId);
            }
            setSelectedSide(newSelected);
        } else {
            const newSelected = new Set(selectedMain);
            if (newSelected.has(cardId)) {
                newSelected.delete(cardId);
            } else {
                newSelected.add(cardId);
            }
            setSelectedMain(newSelected);
        }
    };

    const moveToSideboard = () => {
        const toMove = mainDeck.filter(c => selectedMain.has(c.id));
        const newMain = mainDeck.filter(c => !selectedMain.has(c.id));
        const newSide = [...sideboard, ...toMove].sort((a, b) => a.name.localeCompare(b.name));

        setMainDeck(newMain);
        setSideboard(newSide);
        setSelectedMain(new Set());
    };

    const moveToMain = () => {
        const toMove = sideboard.filter(c => selectedSide.has(c.id));
        const newSide = sideboard.filter(c => !selectedSide.has(c.id));
        const newMain = [...mainDeck, ...toMove].sort((a, b) => a.name.localeCompare(b.name));

        setSideboard(newSide);
        setMainDeck(newMain);
        setSelectedSide(new Set());
    };

    const handleSubmit = () => {
        // Reconstruct DeckView
        // We need to convert arrays back to Records, but wait...
        // The server DeckView uses SimpleCardsView which is Record<UUID, SimpleCardView>.
        // Moving cards doesn't change their properties, just which list they are in.

        const cardsRecord: SimpleCardsView = {};
        mainDeck.forEach(c => cardsRecord[c.id] = c);

        const sideboardRecord: SimpleCardsView = {};
        sideboard.forEach(c => sideboardRecord[c.id] = c);

        onSubmit({
            name: initialDeck.name,
            cards: cardsRecord,
            sideboard: sideboardRecord
        });
    };

    const renderCard = (card: SimpleCardView, isSideboard: boolean) => {
        const isSelected = isSideboard ? selectedSide.has(card.id) : selectedMain.has(card.id);
        const imageUrl = cardImageService.getImageUrl({ ...card, expansionSetCode: card.expansionSetCode, cardNumber: card.cardNumber });

        return (
            <div
                key={card.id}
                className={`card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCardClick(card.id, isSideboard)}
            >
                <img src={imageUrl} alt={card.name} loading="lazy" />
                {/* Overlay or border for selection */}
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Sideboarding: ${initialDeck.name}`}
            size="lg" // Use full screen or large modal
            footer={
                <>
                    <div className="stats" style={{ marginRight: 'auto' }}>
                        Main: {mainDeck.length} | Side: {sideboard.length}
                    </div>
                    <Button variant="ghost" onClick={onClose}>
                        Forfeit
                    </Button>
                    <Button variant="primary" onClick={handleSubmit}>
                        Submit Deck
                    </Button>
                </>
            }
        >
            <div className="sideboard-container">
                <div className="deck-section main-deck">
                    <h4>Main Deck ({mainDeck.length})</h4>
                    <div className="card-grid">
                        {mainDeck.map(c => renderCard(c, false))}
                    </div>
                </div>

                <div className="controls">
                    <Button
                        onClick={moveToSideboard}
                        disabled={selectedMain.size === 0}
                        title="Move selected to Sideboard"
                    >
                        &gt;
                    </Button>
                    <Button
                        onClick={moveToMain}
                        disabled={selectedSide.size === 0}
                        title="Move selected to Main Deck"
                    >
                        &lt;
                    </Button>
                </div>

                <div className="deck-section sideboard">
                    <h4>Sideboard ({sideboard.length})</h4>
                    <div className="card-grid">
                        {sideboard.map(c => renderCard(c, true))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
