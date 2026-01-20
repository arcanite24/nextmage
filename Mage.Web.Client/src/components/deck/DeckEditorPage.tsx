import React, { useState, useRef } from 'react';
import { CardSearchCriteria, DeckCardLists, DeckCardInfo, SearchCardView } from '../../types';
import { wsService } from '../../services/WebSocketService';
import { DeckSerializer } from '../../services/DeckSerializer';
import { Navbar, NavPage } from '../common';
import { CardSearch } from './CardSearch';
import { DeckArea } from './DeckArea';
import { CardView as CardViewComponent } from './CardView';
import './DeckEditorPage.css';

interface DeckEditorPageProps {
    onExit: () => void;
    onNavigate?: (page: NavPage) => void;
}

export const DeckEditorPage: React.FC<DeckEditorPageProps> = ({ onExit, onNavigate }) => {
    const [searchResults, setSearchResults] = useState<SearchCardView[]>([]);
    const [deck, setDeck] = useState<DeckCardLists>({
        cards: [],
        sideboard: []
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSearch = async (criteria: CardSearchCriteria) => {
        try {
            const results = await wsService.searchCards(criteria);
            setSearchResults(results);
        } catch (error) {
            console.error("Search failed:", error);
            // TODO: Show error
        }
    };

    const handleAddCard = (cardView: SearchCardView, zone: 'main' | 'side' = 'main') => {
        const newCard: DeckCardInfo = {
            cardName: cardView.name,
            setCode: cardView.expansionSetCode,
            cardNumber: cardView.cardNumber,
            amount: 1
        };

        setDeck(prev => {
            const targetList = zone === 'main' ? [...prev.cards] : [...prev.sideboard];
            // Check for existing card with same set code and card number
            const existing = targetList.find(c => c.setCode === newCard.setCode && c.cardNumber === newCard.cardNumber);

            if (existing) {
                existing.amount++;
            } else {
                targetList.push(newCard);
            }

            return {
                ...prev,
                [zone === 'main' ? 'cards' : 'sideboard']: targetList
            };
        });
    };

    const handleRemoveCard = (cardInfo: DeckCardInfo, zone: 'main' | 'side') => {
        setDeck(prev => {
            // Clone the target list
            const targetList = zone === 'main'
                ? prev.cards.map(c => ({ ...c }))
                : prev.sideboard.map(c => ({ ...c }));

            const index = targetList.findIndex(c => c.setCode === cardInfo.setCode && c.cardNumber === cardInfo.cardNumber);

            if (index !== -1) {
                const item = targetList[index];
                if (item.amount > 1) {
                    item.amount--;
                } else {
                    targetList.splice(index, 1);
                }
            }

            return {
                ...prev,
                [zone === 'main' ? 'cards' : 'sideboard']: targetList
            };
        });
    };

    const handleSaveDeck = () => {
        const content = DeckSerializer.exportDeck(deck);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (deck.name || 'deck') + '.dck';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadDeck = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const loadedDeck = DeckSerializer.importDeck(content);
                setDeck(loadedDeck);
            }
        };
        reader.readAsText(file);
        // Reset check to allow same file selection again if needed
        e.target.value = '';
    };

    const handleNavigation = (page: NavPage) => {
        if (page === 'decks') return; // Already on decks
        if (onNavigate) {
            onNavigate(page);
        } else if (page === 'lobby') {
            onExit();
        }
    };

    return (
        <div className="deck-editor-page">
            <Navbar
                currentPage="decks"
                onNavigate={handleNavigation}
                onLogout={onExit}
            />

            <div className="deck-editor-toolbar">
                <h2>Deck Editor</h2>
                <div className="toolbar-actions">
                    <button className="btn btn-primary" onClick={handleSaveDeck}>Save</button>
                    <button className="btn btn-secondary" onClick={handleLoadDeck}>Load</button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".dck,.txt"
                    onChange={handleFileChange}
                />
            </div>

            <div className="deck-editor-content">
                <div className="search-pane">
                    <h3>Card Search</h3>
                    <CardSearch onSearch={handleSearch} />
                    <div className="search-results">
                        {searchResults.map((card, index) => (
                            <div key={`${card.id}-${index}`} className="search-result-wrapper">
                                <CardViewComponent
                                    card={card}
                                    size="small"
                                    onClick={() => handleAddCard(card)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        handleAddCard(card, 'side');
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="deck-pane">
                    <DeckArea deck={deck} onRemoveCard={handleRemoveCard} />
                </div>
            </div>
        </div>
    );
};

