/**
 * Deck Manager Page
 * 
 * Main deck management view displaying all saved decks in a grid layout.
 * Styled to match Magic Arena's deck selection screen.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { DeckSerializer } from '../../services/DeckSerializer';
import { cardResolverService } from '../../services';
import { Navbar, NavPage } from '../common';
import { DeckCard, CreateDeckCard } from './DeckCard';
import './DeckManagerPage.css';

interface DeckManagerPageProps {
    onExit: () => void;
    onNavigate?: (page: NavPage) => void;
    onEditDeck: (deckId: string) => void;
    onCreateDeck: () => void;
}

export const DeckManagerPage: React.FC<DeckManagerPageProps> = ({
    onExit,
    onNavigate,
    onEditDeck,
    onCreateDeck,
}) => {
    const {
        decks,
        isLoadingDecks,
        selectedDeckId,
        loadDecks,
        selectDeck,
        deleteDeck,
        cloneDeck,
    } = useDeckStore();

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

    const [searchQuery, setSearchQuery] = useState('');
    const [formatFilter, setFormatFilter] = useState<string>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load decks on mount
    useEffect(() => {
        loadDecks();
    }, [loadDecks]);

    // Filter decks by search query and format
    const filteredDecks = decks.filter(deck => {
        const matchesSearch = deck.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFormat = !formatFilter || deck.format === formatFilter;
        return matchesSearch && matchesFormat;
    });

    const handleNavigation = (page: NavPage) => {
        if (page === 'decks') return;
        if (onNavigate) {
            onNavigate(page);
        } else if (page === 'lobby') {
            onExit();
        }
    };

    const handleDeckClick = (deckId: string) => {
        selectDeck(deckId === selectedDeckId ? null : deckId);
    };

    const handleDeckDoubleClick = (deckId: string) => {
        onEditDeck(deckId);
    };

    const handleDeleteClick = () => {
        if (selectedDeckId) {
            setShowDeleteConfirm(selectedDeckId);
        }
    };

    const handleConfirmDelete = async () => {
        if (showDeleteConfirm) {
            await deleteDeck(showDeleteConfirm);
            setShowDeleteConfirm(null);
        }
    };

    const handleCloneClick = async () => {
        if (selectedDeckId) {
            await cloneDeck(selectedDeckId);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    let deck = DeckSerializer.importDeck(content);
                    deck.name = file.name.replace(/\.(dck|txt)$/i, '');

                    // Check if any cards need resolution (missing setCode or cardNumber)
                    const needsResolution = [...deck.cards, ...deck.sideboard].some(
                        card => !card.setCode || !card.cardNumber
                    );

                    if (needsResolution) {
                        console.log('[DeckManager] Resolving cards from server...');
                        deck = await cardResolverService.resolveDeck(deck);
                    }

                    // Save the imported deck
                    const { saveDeck: save } = useDeckStore.getState();
                    useDeckStore.setState({ currentDeck: deck, isDirty: true });
                    const id = await save();
                    if (id) {
                        await loadDecks();
                    }
                } catch (error) {
                    console.error('Failed to import deck:', error);
                } finally {
                    setIsImporting(false);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportClick = async () => {
        if (!selectedDeckId) return;

        const deck = decks.find(d => d.id === selectedDeckId);
        if (!deck) return;

        // Load full deck data for export
        const { loadDeck } = useDeckStore.getState();
        await loadDeck(selectedDeckId);
        const { currentDeck } = useDeckStore.getState();

        if (currentDeck) {
            const content = DeckSerializer.exportDeck(currentDeck);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (currentDeck.name || 'deck') + '.dck';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const selectedDeck = decks.find(d => d.id === selectedDeckId);

    return (
        <div className="deck-manager-page">
            <Navbar
                currentPage="decks"
                onNavigate={handleNavigation}
                onLogout={onExit}
            />

            <div className="deck-manager-header">
                <h1 className="deck-manager-title">DECKS</h1>
                <div className="deck-manager-search">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="deck-manager-format-filter">
                    <select
                        value={formatFilter}
                        onChange={(e) => setFormatFilter(e.target.value)}
                        className="format-select"
                    >
                        <option value="">All Formats</option>
                        {DECK_FORMATS.map(format => (
                            <option key={format} value={format}>
                                {format.replace('Constructed - ', '')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="deck-manager-count">
                    {filteredDecks.length}/{decks.length}
                </div>
            </div>

            <div className="deck-manager-content">
                {isLoadingDecks || isImporting ? (
                    <div className="deck-manager-loading">
                        {isImporting ? 'Resolving cards from server...' : 'Loading decks...'}
                    </div>
                ) : (
                    <div className="deck-grid">
                        <CreateDeckCard onClick={onCreateDeck} />
                        {filteredDecks.map(deck => (
                            <DeckCard
                                key={deck.id}
                                deck={deck}
                                isSelected={deck.id === selectedDeckId}
                                onClick={() => handleDeckClick(deck.id)}
                                onDoubleClick={() => handleDeckDoubleClick(deck.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="deck-manager-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-secondary" onClick={handleImportClick}>
                        IMPORT
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportClick}
                        disabled={!selectedDeckId}
                    >
                        EXPORT
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleCloneClick}
                        disabled={!selectedDeckId}
                    >
                        CLONE
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={handleDeleteClick}
                        disabled={!selectedDeckId}
                    >
                        DELETE
                    </button>
                </div>
                <div className="toolbar-right">
                    <button
                        className="btn btn-primary btn-edit-deck"
                        onClick={() => selectedDeckId && onEditDeck(selectedDeckId)}
                        disabled={!selectedDeckId}
                    >
                        Edit Deck
                    </button>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".dck,.txt"
                onChange={handleFileImport}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content delete-confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3>Delete Deck</h3>
                        <p>Are you sure you want to delete "{selectedDeck?.name}"?</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleConfirmDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeckManagerPage;
