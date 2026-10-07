import React, { useState, useEffect } from 'react';
import { ClipboardPaste, FolderOpen, Package, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '../common';
import { Modal } from '../common/Modal';
import { useSessionStore } from '../../stores';
import { DeckCardLists, DeckCardInfo } from '../../types';
import { DeckSerializer } from '../../services/DeckSerializer';
import { deckStorage, DeckSummary } from '../../services/DeckStorageService';
import './DeckSelector.css';

interface DeckSelectorProps {
    deckName: string;
    onDeckNameChange: (name: string) => void;
    deckText: string;
    onDeckTextChange: (text: string) => void;
    onError?: (error: string | null) => void;
}

// Sample starter deck
const SAMPLE_DECK: DeckCardLists = {
    name: 'Sample Deck',
    cards: [
        { cardName: 'Mountain', setCode: 'M21', cardNumber: '269', amount: 20 },
        { cardName: 'Lightning Bolt', setCode: 'M21', cardNumber: '152', amount: 4 },
        { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 4 },
        { cardName: 'Goblin Guide', setCode: 'ZNE', cardNumber: '4', amount: 4 },
        { cardName: 'Monastery Swiftspear', setCode: 'KTK', cardNumber: '118', amount: 4 },
        { cardName: 'Eidolon of the Great Revel', setCode: 'JOU', cardNumber: '94', amount: 4 },
    ],
    sideboard: [],
};

export const DeckSelector: React.FC<DeckSelectorProps> = ({
    deckName,
    onDeckNameChange,
    deckText,
    onDeckTextChange,
    onError,
}) => {
    const [savedDecks, setSavedDecks] = useState<DeckSummary[]>([]);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const showAlert = useSessionStore(state => state.showAlert);
    const showLocalUserRequest = useSessionStore(state => state.showLocalUserRequest);

    const parsedDeck = DeckSerializer.importDeck(deckText);
    const maindeckCount = parsedDeck.cards.reduce((sum: number, c: DeckCardInfo) => sum + c.amount, 0);
    const sideboardCount = parsedDeck.sideboard.reduce((sum: number, c: DeckCardInfo) => sum + c.amount, 0);

    useEffect(() => {
        if (isLoadModalOpen) {
            loadDeckList();
        }
    }, [isLoadModalOpen]);

    const loadDeckList = async () => {
        setIsLoading(true);
        try {
            const decks = await deckStorage.listDecks();
            setSavedDecks(decks);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadSample = () => {
        onDeckTextChange(DeckSerializer.exportDeck(SAMPLE_DECK));
        onDeckNameChange('Sample Red Deck');
        if (onError) onError(null);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            onDeckTextChange(text);
            if (onError) onError(null);
        } catch {
            if (onError) onError('Failed to read clipboard. Please paste manually.');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                onDeckTextChange(text);
                // Try to derive name from filename
                const name = file.name.replace(/\.(dck|txt)$/i, '');
                onDeckNameChange(name);
                if (onError) onError(null);
            }
        };
        reader.onerror = () => {
            if (onError) onError('Failed to read file.');
        };
        reader.readAsText(file);
        // Reset value so same file can be selected again
        e.target.value = '';
    };

    const handleSaveDeck = async () => {
        if (!deckName) {
            if (onError) onError("Please enter a deck name before saving.");
            return;
        }
        try {
            const parsed = DeckSerializer.importDeck(deckText);
            parsed.name = deckName;
            await deckStorage.saveDeck(parsed);
            if (onError) onError(null);
            showAlert('Deck saved', 'Deck saved successfully.');
        } catch (e) {
            console.error(e);
            if (onError) onError("Failed to save deck.");
        }
    };

    const handleLoadDeck = async (id: string) => {
        try {
            const deck = await deckStorage.loadDeck(id);
            if (deck) {
                const text = DeckSerializer.exportDeck(deck);
                onDeckTextChange(text);
                onDeckNameChange(deck.name || "Untitled");
                setIsLoadModalOpen(false);
                if (onError) onError(null);
            }
        } catch (e) {
            console.error(e);
            if (onError) onError("Failed to load deck.");
        }
    };

    const handleDeleteDeck = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const confirmed = await showLocalUserRequest({
            title: 'Delete deck?',
            message: 'This removes the saved deck from this browser.',
            button2Text: 'Cancel',
            button2Action: null,
            button1Text: 'Delete deck',
            button1Action: null,
        });

        if (confirmed === 1) {
            await deckStorage.deleteDeck(id);
            await loadDeckList();
        }
    };

    return (
        <div className="deck-selector">
            <div className="deck-header">
                <h4>Deck Details</h4>
                <div className="deck-actions">
                    <Button variant="secondary" size="sm" onClick={() => setIsLoadModalOpen(true)} leftIcon={<FolderOpen size={14} aria-hidden="true" />}>
                        Load Saved
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveDeck} leftIcon={<Save size={14} aria-hidden="true" />}>
                        Save
                    </Button>
                    <div className="divider-vertical"></div>
                    <label className="btn btn-ghost btn-sm upload-btn">
                        <Upload size={14} aria-hidden="true" />
                        Upload
                        <input
                            type="file"
                            accept=".dck,.txt"
                            onChange={handleFileUpload}
                        />
                    </label>
                    <Button variant="ghost" size="sm" onClick={handlePaste} leftIcon={<ClipboardPaste size={14} aria-hidden="true" />}>
                        Paste
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleLoadSample} leftIcon={<Package size={14} aria-hidden="true" />}>
                        Sample
                    </Button>
                </div>
            </div>

            <div className="input-group">
                <label htmlFor="deckName" className="input-label">
                    Deck Name
                </label>
                <input
                    id="deckName"
                    type="text"
                    className="input"
                    value={deckName}
                    onChange={(e) => onDeckNameChange(e.target.value)}
                    placeholder="My Deck"
                />
            </div>

            <div className="input-group">
                <label htmlFor="deckList" className="input-label">
                    Deck List
                    <span className="deck-count">
                        {maindeckCount} main / {sideboardCount} sideboard
                    </span>
                </label>
                <textarea
                    id="deckList"
                    className="input deck-textarea"
                    value={deckText}
                    onChange={(e) => {
                        onDeckTextChange(e.target.value);
                        if (onError) onError(null);
                    }}
                    placeholder={`Paste your deck here in MTGO/Arena format:

4 Lightning Bolt
4 Monastery Swiftspear
20 Mountain

Sideboard
2 Smash to Smithereens`}
                    rows={12}
                />
            </div>

            <div className="deck-format-help">
                <strong>Supported formats:</strong> MTGO, Arena, or simple list
            </div>

            <Modal
                isOpen={isLoadModalOpen}
                onClose={() => setIsLoadModalOpen(false)}
                title="Saved Decks"
                size="md"
            >
                <div className="saved-decks-list">
                    {isLoading ? (
                        <div className="loading">Loading...</div>
                    ) : savedDecks.length === 0 ? (
                        <div className="empty-state">No saved decks found.</div>
                    ) : (
                        <ul className="deck-list">
                            {savedDecks.map((deck) => (
                                <li key={deck.id} className="deck-list-item" onClick={() => handleLoadDeck(deck.id)}>
                                    <div className="deck-info">
                                        <div className="deck-name">{deck.name}</div>
                                        <div className="deck-date">{new Date(deck.updatedAt).toLocaleString()}</div>
                                    </div>
                                    <button
                                        className="deck-delete-btn"
                                        onClick={(e) => handleDeleteDeck(e, deck.id)}
                                        title="Delete Deck"
                                    >
                                        <Trash2 size={14} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Modal>
        </div>
    );
};
