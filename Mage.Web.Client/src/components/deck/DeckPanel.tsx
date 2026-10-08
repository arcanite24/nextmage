/**
 * Deck Panel Component
 * 
 * Right panel showing the current deck contents in MTGA list style.
 * Displays main deck (75%) and sideboard (25%) with card thumbnails.
 * Supports drag & drop from collection browser.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { DeckCardInfo, DeckCardLists, SearchCardView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './DeckPanel.css';

type DeckZone = 'main' | 'side';

interface DeckPanelProps {
    onRemoveCard: (card: DeckCardInfo, zone: DeckZone) => void;
    onAddCard: (card: SearchCardView, zone: DeckZone) => void;
    onSetCardAmount: (card: DeckCardInfo, zone: DeckZone, amount: number) => void;
    onMoveCard: (card: DeckCardInfo, fromZone: DeckZone, toZone: DeckZone) => void;
    selectedCardNames?: string[];
    formatInvalidCardNames?: string[];
}

const CARD_CLICK_COMMIT_DELAY_MS = 220;
const DECK_ROW_DRAG_MIME = 'application/x-mage-deck-card';

function normalizeDeckCardName(cardName: string): string {
    return cardName.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface DeckRowDragData {
    card: DeckCardInfo;
    sourceZone: DeckZone;
}

interface SelectedDeckCard {
    key: string;
    card: DeckCardInfo;
    zone: DeckZone;
}

export const DeckPanel: React.FC<DeckPanelProps> = ({
    onRemoveCard,
    onAddCard,
    onSetCardAmount,
    onMoveCard,
    selectedCardNames = [],
    formatInvalidCardNames = [],
}) => {
    const {
        currentDeck,
        editorMode,
        editorConfig,
        setDeckName,
        setDeckDescription,
        setDeckFormat,
        isDirty,
        updateEditorModeConfig,
    } = useDeckStore();
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [previewCard, setPreviewCard] = useState<DeckCardInfo | null>(null);
    const [dragOverZone, setDragOverZone] = useState<DeckZone | null>(null);
    const [draggingDeckCardKey, setDraggingDeckCardKey] = useState<string | null>(null);
    const [selectedDeckCardKeys, setSelectedDeckCardKeys] = useState<Set<string>>(() => new Set());
    const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null);
    const clickTimerRef = useRef<number | null>(null);
    const deckPanelRef = useRef<HTMLDivElement | null>(null);
    const pendingDeckRowFocusKeyRef = useRef<string | null>(null);
    const modeConfig = editorConfig.modes[editorMode];
    const selectedCardNameSet = useMemo(
        () => new Set(selectedCardNames.map(normalizeDeckCardName)),
        [selectedCardNames],
    );
    const formatInvalidCardNameSet = useMemo(
        () => new Set(formatInvalidCardNames.map(normalizeDeckCardName)),
        [formatInvalidCardNames],
    );
    const selectedDeckCards = useMemo(
        () => collectSelectedDeckCards(currentDeck, selectedDeckCardKeys),
        [currentDeck, selectedDeckCardKeys],
    );
    const selectedDeckCardCount = selectedDeckCards.length;
    const selectedMainDeckCardCount = selectedDeckCards.filter(({ zone }) => zone === 'main').length;
    const selectedSideboardCardCount = selectedDeckCards.filter(({ zone }) => zone === 'side').length;

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

    useEffect(() => {
        return () => {
            if (clickTimerRef.current !== null) {
                window.clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setSelectedDeckCardKeys((selectedKeys) => {
            if (selectedKeys.size === 0) return selectedKeys;
            const availableKeys = getAvailableDeckCardKeys(currentDeck);
            const nextSelectedKeys = new Set([...selectedKeys].filter(key => availableKeys.has(key)));
            return nextSelectedKeys.size === selectedKeys.size ? selectedKeys : nextSelectedKeys;
        });
        setSelectionAnchorKey((anchorKey) => {
            if (!anchorKey || getAvailableDeckCardKeys(currentDeck).has(anchorKey)) return anchorKey;
            return null;
        });
    }, [currentDeck]);

    useEffect(() => {
        if (modeConfig.showSideboard) return;

        if (clickTimerRef.current !== null) {
            window.clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        setSelectedDeckCardKeys((selectedKeys) => {
            if (selectedKeys.size === 0) return selectedKeys;
            const nextSelectedKeys = new Set([...selectedKeys].filter(isMainDeckCardKey));
            return nextSelectedKeys.size === selectedKeys.size ? selectedKeys : nextSelectedKeys;
        });
        setSelectionAnchorKey((anchorKey) => (anchorKey && isMainDeckCardKey(anchorKey) ? anchorKey : null));
    }, [modeConfig.showSideboard]);

    const focusDeckCardRow = (cardKey: string | null | undefined): boolean => {
        if (!cardKey) return false;

        const row = Array.from(deckPanelRef.current?.querySelectorAll<HTMLElement>('[data-testid="deck-card-row"]') ?? [])
            .find(element => element.dataset.cardKey === cardKey);
        if (!row) return false;

        row.focus();
        return true;
    };

    useLayoutEffect(() => {
        const pendingFocusKey = pendingDeckRowFocusKeyRef.current;
        if (!pendingFocusKey) return;

        // Focus once after the deck change commits; keeping the key around would let later
        // deck updates steal focus from dialogs opened in the meantime.
        if (focusDeckCardRow(pendingFocusKey)) {
            pendingDeckRowFocusKeyRef.current = null;
        }
    }, [currentDeck, selectedDeckCardKeys]);

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
        clearPendingCardClick();
        setEditedName(currentDeck.name || '');
        setIsEditingName(true);
    };

    const handleNameBlur = () => {
        clearPendingCardClick();
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
        clearPendingCardClick();
        setDeckFormat(e.target.value);
    };

    const handleDeckSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        clearPendingCardClick();
        updateEditorModeConfig({ deckSortBy: e.target.value as typeof modeConfig.deckSortBy });
    };

    const handleDeckSortDirectionToggle = () => {
        clearPendingCardClick();
        updateEditorModeConfig({ deckSortDirection: modeConfig.deckSortDirection === 'asc' ? 'desc' : 'asc' });
    };

    const handleSideboardVisibilityToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        clearPendingCardClick();
        updateEditorModeConfig({ showSideboard: e.target.checked });
    };

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

    const toggleDeckCardSelection = (cardKey: string) => {
        setSelectedDeckCardKeys((selectedKeys) => {
            const nextSelectedKeys = new Set(selectedKeys);
            if (nextSelectedKeys.has(cardKey)) {
                nextSelectedKeys.delete(cardKey);
            } else {
                nextSelectedKeys.add(cardKey);
            }
            return nextSelectedKeys;
        });
        setSelectionAnchorKey(cardKey);
    };

    const selectDeckCardRange = (cardKey: string) => {
        const renderedKeys = getRenderedDeckCardKeys(
            currentDeck,
            modeConfig.deckSortBy,
            modeConfig.deckSortDirection,
            modeConfig.showSideboard,
        );
        const targetIndex = renderedKeys.indexOf(cardKey);
        const anchorIndex = selectionAnchorKey ? renderedKeys.indexOf(selectionAnchorKey) : -1;
        if (targetIndex === -1 || anchorIndex === -1) {
            toggleDeckCardSelection(cardKey);
            return;
        }

        const startIndex = Math.min(anchorIndex, targetIndex);
        const endIndex = Math.max(anchorIndex, targetIndex);
        const rangeKeys = renderedKeys.slice(startIndex, endIndex + 1);
        setSelectedDeckCardKeys((selectedKeys) => {
            const nextSelectedKeys = new Set(selectedKeys);
            rangeKeys.forEach(key => nextSelectedKeys.add(key));
            return nextSelectedKeys;
        });
    };

    const selectAllRenderedDeckCards = () => {
        const renderedKeys = getRenderedDeckCardKeys(
            currentDeck,
            modeConfig.deckSortBy,
            modeConfig.deckSortDirection,
            modeConfig.showSideboard,
        );
        setSelectedDeckCardKeys(new Set(renderedKeys));
        setSelectionAnchorKey(renderedKeys[0] ?? null);
    };

    const handleCardClick = (event: React.MouseEvent, card: DeckCardInfo, zone: DeckZone, cardKey: string) => {
        if (event.shiftKey) {
            event.preventDefault();
            clearPendingCardClick();
            selectDeckCardRange(cardKey);
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            clearPendingCardClick();
            toggleDeckCardSelection(cardKey);
            return;
        }

        scheduleCardClick(() => handleRemoveOneCard(card, zone));
    };

    const handleCardDoubleClick = (event: React.MouseEvent, card: DeckCardInfo, zone: DeckZone) => {
        event.preventDefault();
        clearPendingCardClick();

        if (event.altKey) {
            handleMoveCard(card, zone, zone === 'main' ? 'side' : 'main');
        } else {
            handleRemoveOneCard(card, zone);
        }
    };

    const handleCardRightClick = (e: React.MouseEvent, card: DeckCardInfo) => {
        e.preventDefault();
        clearPendingCardClick();
        setPreviewCard(card);
    };

    const isEditableCardControlTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable) return true;
        if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
        return target instanceof HTMLInputElement && target.type !== 'checkbox';
    };

    const handleCardKeyDown = (event: React.KeyboardEvent, card: DeckCardInfo, zone: DeckZone) => {
        if (event.key === 'Escape' && selectedDeckCardCount > 0) {
            if (isEditableCardControlTarget(event.target)) return;

            event.preventDefault();
            handleClearSelection(getDeckCardKey(card, zone));
            return;
        }

        if (event.currentTarget !== event.target) return;

        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            clearPendingCardClick();
            setPreviewCard(card);
            return;
        }

        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDeckCardCount > 0) {
            event.preventDefault();
            handleRemoveSelected();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selectAllRenderedDeckCards();
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (event.shiftKey) {
                selectDeckCardRange(getDeckCardKey(card, zone));
                return;
            }

            if (event.ctrlKey || event.metaKey) {
                toggleDeckCardSelection(getDeckCardKey(card, zone));
                return;
            }

            if (event.altKey) {
                handleMoveCard(card, zone, zone === 'main' ? 'side' : 'main');
            } else {
                handleRemoveOneCard(card, zone);
            }
        }
    };

    const handleCountChange = (event: React.ChangeEvent<HTMLInputElement>, card: DeckCardInfo, zone: DeckZone) => {
        const rawAmount = event.currentTarget.value;
        if (rawAmount === '') return;

        const amount = Number(rawAmount);
        if (!Number.isNaN(amount)) {
            clearPendingCardClick();
            if (amount <= 0) {
                const focusAfterRemoveKey = getSingleRemovalFocusKey(
                    currentDeck,
                    getDeckCardKey(card, zone),
                    modeConfig.deckSortBy,
                    modeConfig.deckSortDirection,
                    modeConfig.showSideboard,
                );
                onSetCardAmount(card, zone, amount);
                scheduleDeckCardRowFocus(focusAfterRemoveKey);
                return;
            }
            onSetCardAmount(card, zone, amount);
        }
    };

    const handleCountKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, card: DeckCardInfo, zone: DeckZone) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            const focusedAmount = Number(event.currentTarget.dataset.focusAmount ?? card.amount);
            if (!Number.isNaN(focusedAmount)) {
                clearPendingCardClick();
                onSetCardAmount(card, zone, focusedAmount);
            }
            event.currentTarget.blur();
        }
    };

    const stopRowActionPropagation = (event: React.SyntheticEvent) => {
        clearPendingCardClick();
        event.stopPropagation();
    };

    const handleSelectionToggle = (event: React.ChangeEvent<HTMLInputElement>, cardKey: string) => {
        stopRowActionPropagation(event);
        const checked = event.currentTarget.checked;

        setSelectedDeckCardKeys((selectedKeys) => {
            const nextSelectedKeys = new Set(selectedKeys);
            if (checked) {
                nextSelectedKeys.add(cardKey);
            } else {
                nextSelectedKeys.delete(cardKey);
            }
            return nextSelectedKeys;
        });
        setSelectionAnchorKey(cardKey);
    };

    const handleSelectionClick = (event: React.MouseEvent<HTMLInputElement>, cardKey: string) => {
        if (!event.shiftKey) {
            stopRowActionPropagation(event);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        clearPendingCardClick();
        selectDeckCardRange(cardKey);
    };

    const handleSelectionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, cardKey: string) => {
        if (!event.shiftKey || event.key !== ' ') return;

        event.preventDefault();
        event.stopPropagation();
        clearPendingCardClick();
        selectDeckCardRange(cardKey);
    };

    const scheduleDeckCardRowFocus = (cardKey: string | null | undefined) => {
        if (!cardKey) return;

        pendingDeckRowFocusKeyRef.current = cardKey;
        focusDeckCardRow(cardKey);
        window.setTimeout(() => {
            if (pendingDeckRowFocusKeyRef.current === cardKey) {
                pendingDeckRowFocusKeyRef.current = null;
            }
        }, 200);
    };

    const handleClearSelection = (restoreFocusCardKey?: string | null) => {
        clearPendingCardClick();
        setSelectedDeckCardKeys(new Set());
        setSelectionAnchorKey(null);
        scheduleDeckCardRowFocus(restoreFocusCardKey);
    };

    const handleRemoveSelected = () => {
        clearPendingCardClick();
        const focusAfterRemoveKey = getBulkRemovalFocusKey(
            currentDeck,
            selectedDeckCardKeys,
            modeConfig.deckSortBy,
            modeConfig.deckSortDirection,
            modeConfig.showSideboard,
        );
        selectedDeckCards.forEach(({ card, zone }) => onSetCardAmount(card, zone, 0));
        setSelectedDeckCardKeys(new Set());
        setSelectionAnchorKey(null);
        scheduleDeckCardRowFocus(focusAfterRemoveKey);
    };

    const handleRemoveOneCard = (card: DeckCardInfo, zone: DeckZone) => {
        clearPendingCardClick();
        const focusAfterRemoveKey = card.amount <= 1
            ? getSingleRemovalFocusKey(
                currentDeck,
                getDeckCardKey(card, zone),
                modeConfig.deckSortBy,
                modeConfig.deckSortDirection,
                modeConfig.showSideboard,
            )
            : null;

        onRemoveCard(card, zone);
        scheduleDeckCardRowFocus(focusAfterRemoveKey);
    };

    const handleRemoveAllCard = (card: DeckCardInfo, zone: DeckZone) => {
        clearPendingCardClick();
        const focusAfterRemoveKey = getSingleRemovalFocusKey(
            currentDeck,
            getDeckCardKey(card, zone),
            modeConfig.deckSortBy,
            modeConfig.deckSortDirection,
            modeConfig.showSideboard,
        );
        onSetCardAmount(card, zone, 0);
        scheduleDeckCardRowFocus(focusAfterRemoveKey);
    };

    const handleMoveCard = (card: DeckCardInfo, fromZone: DeckZone, toZone: DeckZone) => {
        clearPendingCardClick();
        const fromKey = getDeckCardKey(card, fromZone);
        const fallbackFocusKey = card.amount > 1
            ? fromKey
            : getSingleRemovalFocusKey(
                currentDeck,
                fromKey,
                modeConfig.deckSortBy,
                modeConfig.deckSortDirection,
                modeConfig.showSideboard,
            );
        const destinationIsVisible = toZone === 'main' || modeConfig.showSideboard;

        onMoveCard(card, fromZone, toZone);
        scheduleDeckCardRowFocus(destinationIsVisible ? getDeckCardKey(card, toZone) : fallbackFocusKey);
    };

    // Drag & Drop handlers
    const handleDragOver = (e: React.DragEvent, zone: DeckZone) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DECK_ROW_DRAG_MIME) ? 'move' : 'copy';
        setDragOverZone(zone);
    };

    const handleDragLeave = (event: React.DragEvent) => {
        event.stopPropagation();
        setDragOverZone(null);
    };

    const handleDrop = (e: React.DragEvent, zone: DeckZone) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverZone(null);
        setDraggingDeckCardKey(null);

        try {
            const deckRowData = e.dataTransfer.getData(DECK_ROW_DRAG_MIME);
            if (deckRowData) {
                const { card, sourceZone } = JSON.parse(deckRowData) as DeckRowDragData;
                if (sourceZone !== zone) {
                    handleMoveCard(card, sourceZone, zone);
                }
                return;
            }

            const cardData = e.dataTransfer.getData('application/json');
            if (cardData) {
                const card = JSON.parse(cardData) as SearchCardView;
                onAddCard(card, zone);
            }
        } catch (err) {
            console.error('Failed to parse dropped card:', err);
        }
    };

    const handleCardDragStart = (event: React.DragEvent, card: DeckCardInfo, zone: DeckZone) => {
        clearPendingCardClick();
        const payload: DeckRowDragData = { card, sourceZone: zone };
        setDraggingDeckCardKey(getDeckCardKey(card, zone));
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(DECK_ROW_DRAG_MIME, JSON.stringify(payload));
        event.dataTransfer.setData('text/plain', `${card.amount} ${card.cardName}`);
    };

    const handleCardDragEnd = () => {
        setDragOverZone(null);
        setDraggingDeckCardKey(null);
    };

    const getCardImageUrl = (card: DeckCardInfo): string => {
        if (card.setCode && card.cardNumber) {
            // Use service to handle special characters in card numbers
            return cardImageService.getImageUrl(
                { expansionSetCode: card.setCode, cardNumber: card.cardNumber } as any,
                'art_crop'
            );
        }
        return '/back.webp';
    };

    const renderCardList = (cards: DeckCardInfo[], zone: DeckZone) => {
        return cards.map((card) => {
            const cardKey = getDeckCardKey(card, zone);
            const isLegalitySelected = selectedCardNameSet.has(normalizeDeckCardName(card.cardName));
            const isFormatInvalid = formatInvalidCardNameSet.has(normalizeDeckCardName(card.cardName));
            const isRowSelected = selectedDeckCardKeys.has(cardKey);
            const isDragging = draggingDeckCardKey === cardKey;

            return (
            <div
                key={cardKey}
                className={`deck-card-row ${isFormatInvalid ? 'deck-card-row-format-invalid' : ''} ${isLegalitySelected || isRowSelected ? 'deck-card-row-selected' : ''} ${isRowSelected ? 'deck-card-row-bulk-selected' : ''} ${isDragging ? 'deck-card-row-dragging' : ''}`}
                onClick={(e) => handleCardClick(e, card, zone, cardKey)}
                onDoubleClick={(e) => handleCardDoubleClick(e, card, zone)}
                onContextMenu={(e) => handleCardRightClick(e, card)}
                onKeyDown={(e) => handleCardKeyDown(e, card, zone)}
                onBlur={clearPendingCardClick}
                onDragStart={(e) => handleCardDragStart(e, card, zone)}
                onDragEnd={handleCardDragEnd}
                draggable
                tabIndex={0}
                aria-label={`${card.amount} ${card.cardName} in ${zone === 'main' ? 'main deck' : 'sideboard'}`}
                data-selected={isLegalitySelected || undefined}
                data-format-invalid={isFormatInvalid || undefined}
                data-row-selected={isRowSelected || undefined}
                data-dragging={isDragging || undefined}
                data-testid="deck-card-row"
                data-zone={zone}
                data-card-name={card.cardName}
                data-card-key={cardKey}
                data-set-code={card.setCode}
                data-card-number={card.cardNumber}
            >
                <input
                    type="checkbox"
                    className="deck-card-select"
                    checked={isRowSelected}
                    aria-label={`Select ${card.cardName} in ${zone === 'main' ? 'main deck' : 'sideboard'}`}
                    onClick={(event) => handleSelectionClick(event, cardKey)}
                    onDoubleClick={stopRowActionPropagation}
                    onKeyDown={(event) => handleSelectionKeyDown(event, cardKey)}
                    onChange={(event) => handleSelectionToggle(event, cardKey)}
                    data-testid="deck-card-select-checkbox"
                />
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
                <input
                    type="number"
                    className="deck-card-count-input"
                    min={0}
                    max={999}
                    step={1}
                    value={card.amount}
                    aria-label={`Set ${card.cardName} count`}
                    title="Set exact count"
                    onClick={stopRowActionPropagation}
                    onDoubleClick={stopRowActionPropagation}
                    onFocus={(e) => {
                        e.currentTarget.dataset.focusAmount = String(card.amount);
                        e.currentTarget.select();
                    }}
                    onChange={(e) => handleCountChange(e, card, zone)}
                    onKeyDown={(e) => handleCountKeyDown(e, card, zone)}
                    data-testid="deck-card-count-input"
                />
                <span className="card-row-name">{card.cardName}</span>
                <button
                    type="button"
                    className="deck-card-remove-all"
                    aria-label={`Remove all ${card.cardName}`}
                    title="Remove all copies"
                    onClick={(e) => {
                        stopRowActionPropagation(e);
                        handleRemoveAllCard(card, zone);
                    }}
                    onDoubleClick={stopRowActionPropagation}
                    data-testid="deck-card-remove-all-button"
                >
                    Remove
                </button>
            </div>
        );
        });
    };

    const sortedMainDeck = sortDeckCards(currentDeck.cards, modeConfig.deckSortBy, modeConfig.deckSortDirection);
    const sortedSideboard = sortDeckCards(currentDeck.sideboard, modeConfig.deckSortBy, modeConfig.deckSortDirection);

    return (
        <div
            className="deck-panel"
            ref={deckPanelRef}
            data-testid="deck-panel"
            data-selection-state={selectedDeckCardCount > 0 ? 'active' : 'idle'}
            data-selected-count={selectedDeckCardCount}
            data-selected-main-count={selectedMainDeckCardCount}
            data-selected-sideboard-count={selectedSideboardCardCount}
            data-main-row-count={currentDeck.cards.length}
            data-sideboard-row-count={modeConfig.showSideboard ? currentDeck.sideboard.length : 0}
            data-sideboard-visible={modeConfig.showSideboard ? 'true' : 'false'}
        >
            <div className="deck-panel-header">
                {isEditingName ? (
                    <input
                        type="text"
                        className="deck-name-input"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onClick={clearPendingCardClick}
                        onFocus={clearPendingCardClick}
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
                <input
                    type="text"
                    className="deck-description-input"
                    value={currentDeck.description || ''}
                    onClick={clearPendingCardClick}
                    onFocus={clearPendingCardClick}
                    onChange={(event) => setDeckDescription(event.currentTarget.value)}
                    placeholder="Description or sideboard notes..."
                    aria-label="Deck description"
                    data-testid="deck-description-input"
                />
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
                <div className="deck-header-row deck-layout-row">
                    <select
                        className="deck-sort-select"
                        value={modeConfig.deckSortBy}
                        onChange={handleDeckSortChange}
                        data-testid="deck-editor-deck-sort-select"
                    >
                        <option value="custom">Deck order</option>
                        <option value="name">Name</option>
                        <option value="amount">Quantity</option>
                        <option value="set">Set/No.</option>
                    </select>
                    <button
                        type="button"
                        className="deck-sort-direction"
                        onClick={handleDeckSortDirectionToggle}
                        aria-label={modeConfig.deckSortDirection === 'asc' ? 'Sort deck ascending' : 'Sort deck descending'}
                        data-testid="deck-editor-deck-sort-direction-button"
                    >
                        {modeConfig.deckSortDirection === 'asc' ? 'Asc' : 'Desc'}
                    </button>
                    <label className="deck-sideboard-toggle">
                        <input
                            type="checkbox"
                            checked={modeConfig.showSideboard}
                            onChange={handleSideboardVisibilityToggle}
                            data-testid="deck-editor-sideboard-toggle"
                        />
                        <span>Sideboard</span>
                    </label>
                </div>
                {selectedDeckCardCount > 0 && (
                    <div
                        className="deck-header-row deck-selection-row"
                        data-testid="deck-selection-toolbar"
                        data-selected-count={selectedDeckCardCount}
                        data-selected-main-count={selectedMainDeckCardCount}
                        data-selected-sideboard-count={selectedSideboardCardCount}
                        data-selection-state="active"
                    >
                        <span data-testid="deck-selected-count">{selectedDeckCardCount} selected</span>
                        <button
                            type="button"
                            className="deck-selection-button deck-selection-button-danger"
                            onClick={handleRemoveSelected}
                            data-testid="deck-remove-selected-button"
                        >
                            Remove selected
                        </button>
                        <button
                            type="button"
                            className="deck-selection-button"
                            onClick={() => handleClearSelection(selectedDeckCards[0]?.key)}
                            data-testid="deck-clear-selection-button"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            <div className="deck-panel-content">
                {/* Main Deck - 75% */}
                <div
                    className={`deck-section deck-section-main ${dragOverZone === 'main' ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, 'main')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'main')}
                    data-testid="deck-section-main"
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
                            renderCardList(sortedMainDeck, 'main')
                        )}
                    </div>
                </div>

                {/* Sideboard - 25% */}
                {modeConfig.showSideboard && (
                    <div
                        className={`deck-section deck-section-sideboard ${dragOverZone === 'side' ? 'drag-over' : ''}`}
                        onDragOver={(e) => handleDragOver(e, 'side')}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'side')}
                        data-testid="deck-section-sideboard"
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
                                renderCardList(sortedSideboard, 'side')
                            )}
                        </div>
                    </div>
                )}
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

function sortDeckCards(
    cards: DeckCardInfo[],
    sortBy: 'custom' | 'name' | 'amount' | 'set',
    direction: 'asc' | 'desc',
): DeckCardInfo[] {
    if (sortBy === 'custom') return cards;

    const multiplier = direction === 'desc' ? -1 : 1;
    return [...cards].sort((a, b) => compareDeckCards(a, b, sortBy) * multiplier);
}

function compareDeckCards(a: DeckCardInfo, b: DeckCardInfo, sortBy: 'name' | 'amount' | 'set'): number {
    switch (sortBy) {
        case 'amount':
            return a.amount - b.amount || compareText(a.cardName, b.cardName);
        case 'set':
            return compareText(a.setCode, b.setCode) || compareText(a.cardNumber, b.cardNumber) || compareText(a.cardName, b.cardName);
        case 'name':
        default:
            return compareText(a.cardName, b.cardName);
    }
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
    return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}

function getDeckCardKey(card: DeckCardInfo, zone: DeckZone): string {
    return [
        zone,
        normalizeDeckCardName(card.cardName),
        card.setCode ?? '',
        card.cardNumber ?? '',
    ].join('|');
}

function getRenderedDeckCardKeys(
    deck: DeckCardLists | null,
    sortBy: 'custom' | 'name' | 'amount' | 'set',
    direction: 'asc' | 'desc',
    showSideboard: boolean,
): string[] {
    if (!deck) return [];

    return [
        ...sortDeckCards(deck.cards, sortBy, direction).map(card => getDeckCardKey(card, 'main')),
        ...(showSideboard ? sortDeckCards(deck.sideboard, sortBy, direction).map(card => getDeckCardKey(card, 'side')) : []),
    ];
}

function getBulkRemovalFocusKey(
    deck: DeckCardLists | null,
    selectedKeys: Set<string>,
    sortBy: 'custom' | 'name' | 'amount' | 'set',
    direction: 'asc' | 'desc',
    showSideboard: boolean,
): string | null {
    const renderedKeys = getRenderedDeckCardKeys(deck, sortBy, direction, showSideboard);
    if (renderedKeys.length === 0 || selectedKeys.size === 0) return null;

    const firstSelectedIndex = renderedKeys.findIndex(key => selectedKeys.has(key));
    if (firstSelectedIndex === -1) return null;

    return renderedKeys.slice(firstSelectedIndex + 1).find(key => !selectedKeys.has(key))
        ?? [...renderedKeys.slice(0, firstSelectedIndex)].reverse().find(key => !selectedKeys.has(key))
        ?? null;
}

function getSingleRemovalFocusKey(
    deck: DeckCardLists | null,
    removedKey: string,
    sortBy: 'custom' | 'name' | 'amount' | 'set',
    direction: 'asc' | 'desc',
    showSideboard: boolean,
): string | null {
    const renderedKeys = getRenderedDeckCardKeys(deck, sortBy, direction, showSideboard);
    const removedIndex = renderedKeys.indexOf(removedKey);
    if (removedIndex === -1) return null;

    return renderedKeys[removedIndex + 1] ?? renderedKeys[removedIndex - 1] ?? null;
}

function collectSelectedDeckCards(deck: DeckCardLists | null, selectedKeys: Set<string>): SelectedDeckCard[] {
    if (!deck || selectedKeys.size === 0) return [];

    const selectedCards: SelectedDeckCard[] = [];
    for (const card of deck.cards) {
        const key = getDeckCardKey(card, 'main');
        if (selectedKeys.has(key)) {
            selectedCards.push({ key, card, zone: 'main' });
        }
    }
    for (const card of deck.sideboard) {
        const key = getDeckCardKey(card, 'side');
        if (selectedKeys.has(key)) {
            selectedCards.push({ key, card, zone: 'side' });
        }
    }
    return selectedCards;
}

function getAvailableDeckCardKeys(deck: DeckCardLists | null): Set<string> {
    const keys = new Set<string>();
    if (!deck) return keys;

    for (const card of deck.cards) {
        keys.add(getDeckCardKey(card, 'main'));
    }
    for (const card of deck.sideboard) {
        keys.add(getDeckCardKey(card, 'side'));
    }
    return keys;
}

function isMainDeckCardKey(cardKey: string): boolean {
    return cardKey.startsWith('main|');
}
