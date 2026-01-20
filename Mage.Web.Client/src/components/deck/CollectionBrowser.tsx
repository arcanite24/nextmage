/**
 * Collection Browser Component
 * 
 * Left panel displaying searchable card collection in a grid.
 * - Left-click: Add to main deck
 * - Right-click: Open card preview modal
 * - Drag: Drop to main deck or sideboard zones
 */

import React, { useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { SearchCardView } from '../../types';
import { CardView } from './CardView';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './CollectionBrowser.css';

interface CollectionBrowserProps {
    onAddCard: (card: SearchCardView, zone: 'main' | 'side') => void;
}

export const CollectionBrowser: React.FC<CollectionBrowserProps> = ({ onAddCard }) => {
    const { searchResults, isSearching } = useDeckStore();
    const [previewCard, setPreviewCard] = useState<SearchCardView | null>(null);

    const handleCardClick = (card: SearchCardView) => {
        onAddCard(card, 'main');
    };

    const handleCardContextMenu = (e: React.MouseEvent, card: SearchCardView) => {
        e.preventDefault();
        setPreviewCard(card);
    };

    const handleDragStart = (e: React.DragEvent, card: SearchCardView) => {
        e.dataTransfer.setData('application/json', JSON.stringify(card));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="collection-browser">
            {isSearching ? (
                <div className="collection-loading">
                    <div className="loading-spinner" />
                    <span>Searching cards...</span>
                </div>
            ) : searchResults.length === 0 ? (
                <div className="collection-empty">
                    <p>Search for cards to add to your deck</p>
                    <p className="hint">Use the filters above and click "Search"</p>
                </div>
            ) : (
                <div className="collection-grid">
                    {searchResults.map((card, index) => (
                        <div
                            key={`${card.id}-${index}`}
                            className="collection-card-wrapper"
                            draggable
                            onDragStart={(e) => handleDragStart(e, card)}
                        >
                            <CardView
                                card={card}
                                size="small"
                                onClick={() => handleCardClick(card)}
                                onContextMenu={(e) => handleCardContextMenu(e, card)}
                            />
                            <div className="card-add-hint">
                                <span className="hint-main">Click or drag to add</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previewCard && (
                <CardPreviewModal
                    card={previewCard as any}
                    onClose={() => setPreviewCard(null)}
                />
            )}
        </div>
    );
};

export default CollectionBrowser;
