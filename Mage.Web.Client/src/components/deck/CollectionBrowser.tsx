/**
 * Collection Browser Component
 * 
 * Left panel displaying searchable card collection in a grid.
 * - Left-click: Add to main deck
 * - Right-click: Open card preview modal
 * - Drag: Drop to main deck or sideboard zones
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { createSearchResultPiles } from '../../services/DeckSearchFilterService';
import { SearchCardView } from '../../types';
import { CardView } from './CardView';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './CollectionBrowser.css';

interface CollectionBrowserProps {
    onAddCard: (card: SearchCardView, zone: 'main' | 'side') => void;
}

const CARD_CLICK_COMMIT_DELAY_MS = 220;

export const CollectionBrowser: React.FC<CollectionBrowserProps> = ({ onAddCard }) => {
    const { searchResults, isSearching, filters, editorMode, editorConfig } = useDeckStore();
    const [previewCard, setPreviewCard] = useState<SearchCardView | null>(null);
    const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null);
    const clickTimerRef = useRef<number | null>(null);
    const modeConfig = editorConfig.modes[editorMode];

    useEffect(() => {
        return () => {
            if (clickTimerRef.current !== null) {
                window.clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    const clearPendingCardClick = () => {
        if (clickTimerRef.current !== null) {
            window.clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
    };

    const scheduleCardClick = (callback: () => void) => {
        clearPendingCardClick();
        clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            callback();
        }, CARD_CLICK_COMMIT_DELAY_MS);
    };

    const handleCardClick = (card: SearchCardView) => {
        scheduleCardClick(() => onAddCard(card, 'main'));
    };

    const handleCardDoubleClick = (event: React.MouseEvent, card: SearchCardView) => {
        event.preventDefault();
        clearPendingCardClick();
        onAddCard(card, event.altKey ? 'side' : 'main');
    };

    const handleCardContextMenu = (e: React.MouseEvent, card: SearchCardView) => {
        e.preventDefault();
        clearPendingCardClick();
        setPreviewCard(card);
    };

    const handleCardKeyDown = (event: React.KeyboardEvent, card: SearchCardView) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            clearPendingCardClick();
            setPreviewCard(card);
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        clearPendingCardClick();
        onAddCard(card, event.altKey ? 'side' : 'main');
    };

    const handleDragStart = (e: React.DragEvent, card: SearchCardView) => {
        setDraggingCardKey(getCollectionCardKey(card));
        e.dataTransfer.setData('application/json', JSON.stringify(card));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragEnd = () => {
        setDraggingCardKey(null);
    };

    const renderGridCards = (cards: SearchCardView[]) => (
        <>
            {cards.map((card, index) => {
                const cardKey = getCollectionCardKey(card);

                return (
                    <div
                        key={`${card.id}-${index}`}
                        className="collection-card-wrapper"
                        role="button"
                        tabIndex={0}
                        draggable
                        aria-label={`Add ${card.displayName || card.name} to deck`}
                        onClick={() => handleCardClick(card)}
                        onDoubleClick={(e) => handleCardDoubleClick(e, card)}
                        onKeyDown={(e) => handleCardKeyDown(e, card)}
                        onContextMenu={(e) => handleCardContextMenu(e, card)}
                        onBlur={clearPendingCardClick}
                        onDragStart={(e) => handleDragStart(e, card)}
                        onDragEnd={handleDragEnd}
                        data-dragging={draggingCardKey === cardKey || undefined}
                        data-testid="deck-editor-collection-card"
                        data-card-name={card.name}
                        data-set-code={card.expansionSetCode}
                        data-rarity={card.rarity}
                        data-mana-value={card.manaValue}
                        data-card-types={card.cardTypes.join(' ')}
                        data-card-colors={cardColors(card).join(' ')}
                    >
                        <CardView
                            card={card}
                            size="normal"
                        />
                        <div className="card-add-hint">
                            <span className="hint-main">Click, double-click, or Alt+double-click</span>
                        </div>
                    </div>
                );
            })}
        </>
    );

    const renderGrid = () => (
        <div className="collection-grid" data-testid="deck-editor-collection-grid">
            {renderGridCards(searchResults)}
        </div>
    );

    const renderListRows = (cards: SearchCardView[]) => (
        <>
            {cards.map((card, index) => {
                const cardKey = getCollectionCardKey(card);

                return (
                    <div
                        key={`${card.id}-${index}`}
                        className="collection-list-row"
                        role="button"
                        tabIndex={0}
                        draggable
                        aria-label={`Add ${card.displayName || card.name} to deck`}
                        onClick={() => handleCardClick(card)}
                        onDoubleClick={(e) => handleCardDoubleClick(e, card)}
                        onKeyDown={(e) => handleCardKeyDown(e, card)}
                        onContextMenu={(e) => handleCardContextMenu(e, card)}
                        onBlur={clearPendingCardClick}
                        onDragStart={(e) => handleDragStart(e, card)}
                        onDragEnd={handleDragEnd}
                        data-dragging={draggingCardKey === cardKey || undefined}
                        data-testid="deck-editor-collection-card"
                        data-card-name={card.name}
                        data-set-code={card.expansionSetCode}
                        data-rarity={card.rarity}
                        data-mana-value={card.manaValue}
                        data-card-types={card.cardTypes.join(' ')}
                        data-card-colors={cardColors(card).join(' ')}
                    >
                        <div className="collection-list-preview">
                            <CardView card={card} size="small" />
                        </div>
                        <div className="collection-list-main">
                            <span className="collection-list-name">{card.displayName || card.name}</span>
                            <span className="collection-list-meta">
                                {card.expansionSetCode} {card.cardNumber}
                            </span>
                        </div>
                        <span className="collection-list-pill">{card.manaValue}</span>
                        <span className="collection-list-pill">{String(card.rarity).replace('MYTHIC', 'MYTHIC RARE')}</span>
                    </div>
                );
            })}
        </>
    );

    const renderList = () => (
        <div className="collection-list" data-testid="deck-editor-collection-list">
            {renderListRows(searchResults)}
        </div>
    );

    const renderPiles = () => (
        <div className="collection-piles" data-testid="deck-editor-collection-piles">
            {createSearchResultPiles(searchResults, filters).map(pile => (
                <section className="collection-pile" key={pile.key}>
                    <h3>
                        <span>{pile.label}</span>
                        <strong data-testid="deck-editor-collection-pile-count">{pile.cards.length}</strong>
                    </h3>
                    {modeConfig.collectionView === 'list' ? (
                        <div className="collection-list collection-list-pile">
                            {renderListRows(pile.cards)}
                        </div>
                    ) : (
                        <div className="collection-grid collection-grid-pile">
                            {renderGridCards(pile.cards)}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );

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
                filters.piles ? renderPiles() : modeConfig.collectionView === 'list' ? renderList() : renderGrid()
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

function cardColors(card: SearchCardView): string[] {
    const color = card.color ?? card.frameColor;
    if (!color) return ['colorless'];

    const colors: string[] = [];
    if (color.white) colors.push('white');
    if (color.blue) colors.push('blue');
    if (color.black) colors.push('black');
    if (color.red) colors.push('red');
    if (color.green) colors.push('green');
    return colors.length > 0 ? colors : ['colorless'];
}

function getCollectionCardKey(card: SearchCardView): string {
    return [
        card.id,
        card.name,
        card.expansionSetCode,
        card.cardNumber,
    ].join('|');
}
