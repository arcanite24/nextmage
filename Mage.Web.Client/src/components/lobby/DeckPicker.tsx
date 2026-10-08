/**
 * Deck Picker Component
 * 
 * Reusable component for selecting a deck from saved decks or pasting/importing deck text.
 * Filters saved decks by format and resolves card data for decks without set codes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal } from '../common';
import { DeckCardLists, DeckCardInfo } from '../../types';
import { DeckSerializer } from '../../core/decks/DeckSerializer';
import { deckStorage, DeckSummary } from '../../core/decks/DeckStorageService';
import { cardResolverService } from '../../services';
import { cardImageService } from '../../services/CardImageService';
import './DeckPicker.css';


/** "Constructed - Pauper" and "Pauper" name the same format; tables and decks use both spellings. */
function normalizeFormatName(name: string): string {
    return name
        .replace(/^(Constructed|Variant Magic|Block Constructed)\s*-\s*/i, '')
        .trim()
        .toLowerCase();
}

function isDeckFormatCompatible(deckFormat: string | undefined, tableFormat: string | undefined): boolean {
    if (!tableFormat || !deckFormat) return true;
    const table = normalizeFormatName(tableFormat);
    // freeform tables accept any deck
    if (table.startsWith('freeform')) return true;
    return normalizeFormatName(deckFormat) === table;
}

interface DeckPickerProps {
    /** The currently selected deck (controlled) */
    selectedDeck: DeckCardLists | null;
    /** Callback when a deck is selected/changed */
    onDeckChange: (deck: DeckCardLists | null) => void;
    /** Format to filter saved decks (e.g., "Constructed - Pauper") */
    format?: string;
    /** Whether the component is in a loading state */
    isLoading?: boolean;
    /** Error message to display */
    error?: string | null;
    /** Callback when an error occurs */
    onError?: (error: string | null) => void;
    /** Optional label for the component */
    label?: string;
    /** Whether to show the deck text editor */
    showTextEditor?: boolean;
}

export const DeckPicker: React.FC<DeckPickerProps> = ({
    selectedDeck,
    onDeckChange,
    format,
    isLoading = false,
    error,
    onError,
    label = 'Select Deck',
    showTextEditor = true,
}) => {
    const [savedDecks, setSavedDecks] = useState<DeckSummary[]>([]);
    const [isLoadingDecks, setIsLoadingDecks] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [showDeckList, setShowDeckList] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);
    const [deckText, setDeckText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getUnresolvedCards = (deck: DeckCardLists): DeckCardInfo[] => {
        return [...deck.cards, ...deck.sideboard].filter(card => !card.setCode || !card.cardNumber);
    };

    const formatUnresolvedCardsError = (cards: DeckCardInfo[]): string => {
        const names = [...new Set(cards.map(card => card.cardName))].slice(0, 8);
        const suffix = cards.length > names.length ? ` and ${cards.length - names.length} more` : '';
        return `Unresolved cards: ${names.join(', ')}${suffix}. Check the deck text and remove any title/header rows.`;
    };

    const resolveAndValidateDeck = async (deck: DeckCardLists): Promise<DeckCardLists> => {
        const needsResolution = getUnresolvedCards(deck).length > 0;
        const resolved = needsResolution ? await cardResolverService.resolveDeck(deck) : deck;
        const unresolved = getUnresolvedCards(resolved);

        if (unresolved.length > 0) {
            throw new Error(formatUnresolvedCardsError(unresolved));
        }

        return resolved;
    };

    // Load saved decks on mount and when format changes
    useEffect(() => {
        loadSavedDecks();
    }, [format]);

    const loadSavedDecks = async () => {
        setIsLoadingDecks(true);
        try {
            // keep every deck: decks of other formats are listed in their own section
            setSavedDecks(await deckStorage.listDecks());
        } catch (err) {
            console.error('[DeckPicker] Failed to load decks:', err);
        } finally {
            setIsLoadingDecks(false);
        }
    };

    const handleSelectDeck = async (summary: DeckSummary) => {
        try {
            const deck = await deckStorage.loadDeck(summary.id);
            if (deck) {
                setIsResolving(true);
                const resolved = await resolveAndValidateDeck(deck);
                onDeckChange(resolved);
                setShowDeckList(false);
                onError?.(null);
            }
        } catch (err) {
            console.error('[DeckPicker] Failed to load deck:', err);
            onError?.(err instanceof Error ? err.message : 'Failed to load deck');
        } finally {
            setIsResolving(false);
        }
    };

    const handlePasteText = async () => {
        if (!deckText.trim()) {
            onError?.('Please enter deck text');
            return;
        }

        try {
            setIsResolving(true);
            let deck = DeckSerializer.importDeck(deckText);
            deck.name = 'Imported Deck';

            deck = await resolveAndValidateDeck(deck);

            onDeckChange(deck);
            setShowTextInput(false);
            setDeckText('');
            onError?.(null);
        } catch (err) {
            console.error('[DeckPicker] Failed to parse deck:', err);
            onError?.(err instanceof Error ? err.message : 'Failed to parse deck text');
        } finally {
            setIsResolving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    setIsResolving(true);
                    let deck = DeckSerializer.importDeck(content);
                    deck.name = file.name.replace(/\.(dck|txt)$/i, '');

                    deck = await resolveAndValidateDeck(deck);

                    onDeckChange(deck);
                    onError?.(null);
                } catch (err) {
                    console.error('[DeckPicker] Failed to import deck:', err);
                    onError?.(err instanceof Error ? err.message : 'Failed to import deck file');
                } finally {
                    setIsResolving(false);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setDeckText(text);
            onError?.(null);
        } catch {
            onError?.('Failed to read clipboard');
        }
    };

    const handleClearDeck = () => {
        onDeckChange(null);
    };

    // Calculate deck stats
    const mainDeckCount = selectedDeck?.cards.reduce((sum, c) => sum + c.amount, 0) || 0;
    const sideboardCount = selectedDeck?.sideboard.reduce((sum, c) => sum + c.amount, 0) || 0;

    // Get cover card image
    const getCoverImageUrl = () => {
        if (!selectedDeck?.coverCard) {
            // Use first card with set code as fallback
            const firstCard = selectedDeck?.cards.find(c => c.setCode && c.cardNumber);
            if (firstCard) {
                return cardImageService.getImageUrl(
                    { expansionSetCode: firstCard.setCode!, cardNumber: firstCard.cardNumber! } as any,
                    'art_crop'
                );
            }
            return '/back.webp';
        }
        return cardImageService.getImageUrl(
            { expansionSetCode: selectedDeck.coverCard.setCode, cardNumber: selectedDeck.coverCard.cardNumber } as any,
            'art_crop'
        );
    };

    const formatDecks = savedDecks.filter(d => isDeckFormatCompatible(d.format, format));
    const otherDecks = savedDecks.filter(d => !isDeckFormatCompatible(d.format, format));

    return (
        <div className="deck-picker">
            <div className="deck-picker-label">{label}</div>

            {error && (
                <div className="deck-picker-error">
                    {error}
                </div>
            )}

            {selectedDeck ? (
                <div className="deck-picker-selected">
                    <div className="deck-picker-preview">
                        <img
                            src={getCoverImageUrl()}
                            alt=""
                            className="deck-picker-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/back.webp'; }}
                        />
                        <div className="deck-picker-info">
                            <div className="deck-picker-name">{selectedDeck.name || 'Untitled Deck'}</div>
                            <div className="deck-picker-stats">
                                {mainDeckCount} cards | {sideboardCount} sideboard
                            </div>
                            {selectedDeck.format && (
                                <div className="deck-picker-format">{selectedDeck.format}</div>
                            )}
                        </div>
                    </div>
                    <div className="deck-picker-actions">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowDeckList(true)}
                            disabled={isLoading || isResolving}
                        >
                            Change
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearDeck}
                            disabled={isLoading || isResolving}
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="deck-picker-empty">
                    <div className="deck-picker-buttons">
                        <Button
                            variant="secondary"
                            onClick={() => setShowDeckList(true)}
                            disabled={isLoading || isResolving}
                        >
                            Select Saved Deck
                        </Button>
                        {showTextEditor && (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowTextInput(true)}
                                    disabled={isLoading || isResolving}
                                >
                                    Paste Deck
                                </Button>
                                <label className="btn btn-ghost upload-label">
                                    Import File
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".dck,.txt"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </>
                        )}
                    </div>
                    {isResolving && (
                        <div className="deck-picker-resolving">Resolving cards...</div>
                    )}
                </div>
            )}

            {/* Saved Decks Modal */}
            <Modal
                isOpen={showDeckList}
                onClose={() => setShowDeckList(false)}
                title="Select Deck"
                size="md"
            >
                <div className="deck-picker-list">
                    {isLoadingDecks ? (
                        <div className="deck-picker-loading">Loading decks...</div>
                    ) : savedDecks.length === 0 ? (
                        <div className="deck-picker-empty-state">
                            No saved decks found. Create a deck in the Deck Editor first.
                        </div>
                    ) : (
                        <>
                            {format && formatDecks.length > 0 && (
                                <div className="deck-picker-section">
                                    <div className="deck-picker-section-header">
                                        Compatible Decks ({format.replace('Constructed - ', '')})
                                    </div>
                                    <div className="deck-picker-deck-grid">
                                        {formatDecks.map(deck => (
                                            <div
                                                key={deck.id}
                                                className="deck-picker-deck-item"
                                                onClick={() => handleSelectDeck(deck)}
                                            >
                                                <div className="deck-item-cover">
                                                    {deck.coverCard ? (
                                                        <img
                                                            src={cardImageService.getImageUrl(
                                                                { expansionSetCode: deck.coverCard.setCode, cardNumber: deck.coverCard.cardNumber } as any,
                                                                'art_crop'
                                                            )}
                                                            alt=""
                                                            onError={(e) => { (e.target as HTMLImageElement).src = '/back.webp'; }}
                                                        />
                                                    ) : (
                                                        <img src="/back.webp" alt="" />
                                                    )}
                                                </div>
                                                <div className="deck-item-info">
                                                    <div className="deck-item-name">{deck.name}</div>
                                                    <div className="deck-item-stats">
                                                        {deck.cardCount || 0} cards
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!format && savedDecks.length > 0 && (
                                <div className="deck-picker-deck-grid">
                                    {savedDecks.map(deck => (
                                        <div
                                            key={deck.id}
                                            className="deck-picker-deck-item"
                                            onClick={() => handleSelectDeck(deck)}
                                        >
                                            <div className="deck-item-cover">
                                                {deck.coverCard ? (
                                                    <img
                                                        src={cardImageService.getImageUrl(
                                                            { expansionSetCode: deck.coverCard.setCode, cardNumber: deck.coverCard.cardNumber } as any,
                                                            'art_crop'
                                                        )}
                                                        alt=""
                                                        onError={(e) => { (e.target as HTMLImageElement).src = '/back.webp'; }}
                                                    />
                                                ) : (
                                                    <img src="/back.webp" alt="" />
                                                )}
                                            </div>
                                            <div className="deck-item-info">
                                                <div className="deck-item-name">{deck.name}</div>
                                                <div className="deck-item-stats">
                                                    {deck.cardCount || 0} cards
                                                    {deck.format && ` - ${deck.format.replace('Constructed - ', '')}`}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {format && otherDecks.length > 0 && (
                                <div className="deck-picker-section deck-picker-section-other">
                                    <div className="deck-picker-section-header">
                                        Other Decks (Different Format)
                                    </div>
                                    <div className="deck-picker-deck-grid">
                                        {otherDecks.map(deck => (
                                            <div
                                                key={deck.id}
                                                className="deck-picker-deck-item deck-picker-deck-item-other"
                                                onClick={() => handleSelectDeck(deck)}
                                            >
                                                <div className="deck-item-cover">
                                                    {deck.coverCard ? (
                                                        <img
                                                            src={cardImageService.getImageUrl(
                                                                { expansionSetCode: deck.coverCard.setCode, cardNumber: deck.coverCard.cardNumber } as any,
                                                                'art_crop'
                                                            )}
                                                            alt=""
                                                            onError={(e) => { (e.target as HTMLImageElement).src = '/back.webp'; }}
                                                        />
                                                    ) : (
                                                        <img src="/back.webp" alt="" />
                                                    )}
                                                </div>
                                                <div className="deck-item-info">
                                                    <div className="deck-item-name">{deck.name}</div>
                                                    <div className="deck-item-stats">
                                                        {deck.cardCount || 0} cards - {deck.format?.replace('Constructed - ', '') || 'No format'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Modal>

            {/* Paste Text Modal */}
            {showTextEditor && (
                <Modal
                    isOpen={showTextInput}
                    onClose={() => setShowTextInput(false)}
                    title="Paste Deck"
                    size="lg"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setShowTextInput(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handlePasteText}
                                isLoading={isResolving}
                            >
                                Import
                            </Button>
                        </>
                    }
                >
                    <div className="deck-picker-text-input">
                        <div className="deck-picker-text-actions">
                            <Button variant="ghost" size="sm" onClick={handlePasteFromClipboard}>
                                Paste from Clipboard
                            </Button>
                        </div>
                        <textarea
                            className="deck-picker-textarea"
                            value={deckText}
                            onChange={(e) => setDeckText(e.target.value)}
                            placeholder={`Paste your deck here in MTGO/Arena format:

4 Lightning Bolt
4 Monastery Swiftspear
20 Mountain

Sideboard
2 Smash to Smithereens`}
                            rows={15}
                        />
                        <div className="deck-picker-format-help">
                            <strong>Supported formats:</strong> MTGO, Arena, or simple list (card names only)
                        </div>
                    </div>
                </Modal>
            )}

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".dck,.txt"
                onChange={handleFileUpload}
            />
        </div>
    );
};

export default DeckPicker;
