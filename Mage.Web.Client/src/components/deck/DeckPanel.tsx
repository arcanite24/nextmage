/**
 * Deck Panel Component
 * 
 * Right panel showing the current deck contents in MTGA list style.
 * Displays main deck (75%) and sideboard (25%) with card thumbnails.
 * Supports drag & drop from collection browser.
 */

import React, { useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { DeckCardInfo, SearchCardView } from '../../types';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './DeckPanel.css';

interface DeckPanelProps {
    onRemoveCard: (card: DeckCardInfo, zone: 'main' | 'side') => void;
    onAddCard: (card: SearchCardView, zone: 'main' | 'side') => void;
}

export const DeckPanel: React.FC<DeckPanelProps> = ({ onRemoveCard, onAddCard }) => {
    const { currentDeck, setDeckName, setDeckFormat, isDirty } = useDeckStore();
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [previewCard, setPreviewCard] = useState<DeckCardInfo | null>(null);
    const [dragOverZone, setDragOverZone] = useState<'main' | 'side' | null>(null);

    // Available formats (synced with CreateTableDialog)
    const DECK_FORMATS = [
        'Constructed - Standard',
        'Constructed - Modern',
        'Constructed - Legacy',
        'Constructed - Vintage',
        'Constructed - Pioneer',
        'Constructed - Commander',
        'Constructed - Pauper',
    ];

    if (!currentDeck) {
        return (
            <div className="deck-panel">
                <div className="deck-panel-empty">No deck loaded</div>
            </div>
        );
    }

    const mainDeckCount = currentDeck.cards.reduce((sum, c) => sum + c.amount, 0);
    const sideboardCount = currentDeck.sideboard.reduce((sum, c) => sum + c.amount, 0);

    const handleNameClick = () => {
        setEditedName(currentDeck.name || '');
        setIsEditingName(true);
    };

    const handleNameBlur = () => {
        setIsEditingName(false);
        if (editedName.trim() && editedName !== currentDeck.name) {
            setDeckName(editedName.trim());
        }
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameBlur();
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
        }
    };

    const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setDeckFormat(e.target.value);
    };

    const handleCardClick = (card: DeckCardInfo, zone: 'main' | 'side') => {
        onRemoveCard(card, zone);
    };

    const handleCardRightClick = (e: React.MouseEvent, card: DeckCardInfo) => {
        e.preventDefault();
        setPreviewCard(card);
    };

    // Drag & Drop handlers
    const handleDragOver = (e: React.DragEvent, zone: 'main' | 'side') => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverZone(zone);
    };

    const handleDragLeave = () => {
        setDragOverZone(null);
    };

    const handleDrop = (e: React.DragEvent, zone: 'main' | 'side') => {
        e.preventDefault();
        setDragOverZone(null);

        try {
            const cardData = e.dataTransfer.getData('application/json');
            if (cardData) {
                const card = JSON.parse(cardData) as SearchCardView;
                onAddCard(card, zone);
            }
        } catch (err) {
            console.error('Failed to parse dropped card:', err);
        }
    };

    const getCardImageUrl = (card: DeckCardInfo): string => {
        if (card.setCode && card.cardNumber) {
            return `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.cardNumber}?format=image&version=art_crop`;
        }
        return '/back.webp';
    };

    const renderCardList = (cards: DeckCardInfo[], zone: 'main' | 'side') => {
        return cards.map((card, index) => (
            <div
                key={`${zone}-${card.setCode}-${card.cardNumber}-${index}`}
                className="deck-card-row"
                onClick={() => handleCardClick(card, zone)}
                onContextMenu={(e) => handleCardRightClick(e, card)}
            >
                <div className="card-row-art">
                    <img
                        src={getCardImageUrl(card)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/back.webp';
                        }}
                    />
                </div>
                <span className="card-row-quantity">{card.amount}x</span>
                <span className="card-row-name">{card.cardName}</span>
            </div>
        ));
    };

    return (
        <div className="deck-panel">
            <div className="deck-panel-header">
                {isEditingName ? (
                    <input
                        type="text"
                        className="deck-name-input"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        autoFocus
                    />
                ) : (
                    <h2 className="deck-name" onClick={handleNameClick}>
                        {currentDeck.name || 'Untitled Deck'}
                        {isDirty && <span className="dirty-indicator">*</span>}
                    </h2>
                )}
                <div className="deck-header-row">
                    <select
                        className="deck-format-select"
                        value={currentDeck.format || 'Constructed - Standard'}
                        onChange={handleFormatChange}
                    >
                        {DECK_FORMATS.map(format => (
                            <option key={format} value={format}>
                                {format.replace('Constructed - ', '')}
                            </option>
                        ))}
                    </select>
                    <span className="deck-card-count">{mainDeckCount} Cards</span>
                </div>
            </div>

            <div className="deck-panel-content">
                {/* Main Deck - 75% */}
                <div
                    className={`deck-section deck-section-main ${dragOverZone === 'main' ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, 'main')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'main')}
                >
                    <div className="deck-section-header">
                        <span>Main Deck</span>
                        <span className="section-count">{mainDeckCount}</span>
                    </div>
                    <div className="deck-card-list">
                        {currentDeck.cards.length === 0 ? (
                            <div className="deck-section-empty">
                                Click or drag cards to add them
                            </div>
                        ) : (
                            renderCardList(currentDeck.cards, 'main')
                        )}
                    </div>
                </div>

                {/* Sideboard - 25% */}
                <div
                    className={`deck-section deck-section-sideboard ${dragOverZone === 'side' ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, 'side')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'side')}
                >
                    <div className="deck-section-header">
                        <span>Sideboard</span>
                        <span className="section-count">{sideboardCount}</span>
                    </div>
                    <div className="deck-card-list">
                        {currentDeck.sideboard.length === 0 ? (
                            <div className="deck-section-empty">
                                Drag cards here for sideboard
                            </div>
                        ) : (
                            renderCardList(currentDeck.sideboard, 'side')
                        )}
                    </div>
                </div>
            </div>

            {previewCard && (
                <CardPreviewModal
                    card={{
                        id: `${previewCard.setCode}-${previewCard.cardNumber}`,
                        name: previewCard.cardName,
                        displayName: previewCard.cardName,
                        expansionSetCode: previewCard.setCode || '',
                        cardNumber: previewCard.cardNumber || '',
                        rules: [],
                        cardTypes: [],
                        subTypes: [],
                    } as any}
                    onClose={() => setPreviewCard(null)}
                />
            )}
        </div>
    );
};

export default DeckPanel;
