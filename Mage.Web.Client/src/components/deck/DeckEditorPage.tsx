/**
 * Deck Editor Page
 * 
 * Full deck editing experience with MTGA-style two-panel layout:
 * - Left: Card collection browser with filters
 * - Right: Deck panel with main deck and sideboard
 */

import React, { useEffect } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { Navbar, NavPage } from '../common';
import { CardFilters } from './CardFilters';
import { CollectionBrowser } from './CollectionBrowser';
import { DeckPanel } from './DeckPanel';
import './DeckEditorPage.css';

interface DeckEditorPageProps {
    deckId?: string;
    onExit: () => void;
    onNavigate?: (page: NavPage) => void;
    onDone: () => void;
}

export const DeckEditorPage: React.FC<DeckEditorPageProps> = ({
    deckId,
    onExit,
    onNavigate,
    onDone,
}) => {
    const {
        currentDeck,
        isEditing,
        isDirty,
        loadDeck,
        createNewDeck,
        saveDeck,
        closeDeck,
        addCard,
        removeCard,
        searchCards,
    } = useDeckStore();

    // Load deck on mount
    useEffect(() => {
        if (deckId) {
            loadDeck(deckId);
        } else if (!isEditing) {
            createNewDeck();
        }

        return () => {
            // Cleanup when leaving editor
        };
    }, [deckId, loadDeck, createNewDeck, isEditing]);

    const handleNavigation = (page: NavPage) => {
        if (page === 'decks') {
            handleDone();
            return;
        }
        if (onNavigate) {
            onNavigate(page);
        } else if (page === 'lobby') {
            handleDone();
            onExit();
        }
    };

    const handleDone = async () => {
        if (isDirty) {
            await saveDeck();
        }
        closeDeck();
        onDone();
    };

    const handleSearch = () => {
        searchCards();
    };

    // Initial search on mount
    useEffect(() => {
        // Trigger initial search with default filters
        searchCards();
    }, []);

    return (
        <div className="deck-editor-page">
            <Navbar
                currentPage="decks"
                onNavigate={handleNavigation}
                onLogout={onExit}
            />

            <div className="deck-editor-layout">
                {/* Left Panel: Card Browser */}
                <div className="deck-editor-left">
                    <CardFilters onSearch={handleSearch} />
                    <CollectionBrowser onAddCard={addCard} />
                </div>

                {/* Right Panel: Deck */}
                <div className="deck-editor-right">
                    <DeckPanel onRemoveCard={removeCard} onAddCard={addCard} />
                    <div className="deck-editor-actions">
                        <button
                            className="btn btn-primary btn-done"
                            onClick={handleDone}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeckEditorPage;
