/**
 * Deck Manager Page
 * 
 * Main deck management view displaying all saved decks in a grid layout.
 * Styled to match Magic Arena's deck selection screen.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { DeckSerializer } from '../../services/DeckSerializer';
import {
    appConfigService,
    cardResolverService,
    DECK_TEXT_IMPORT_ACCEPT,
    getDeckNameFromFile,
    parseAlternateSearch,
    readFileAsText,
    reportItemToDeckCard,
    resolveImportedDeckText,
    type DeckImportReplacement,
    type DeckFileHistoryConfig,
    type DeckResolutionResult,
} from '../../services';
import type { DeckCardLists } from '../../types';
import { Modal, Navbar, NavPage } from '../common';
import { DeckCard, CreateDeckCard } from './DeckCard';
import { DeckImportReviewModal } from './DeckImportReviewModal';
import './DeckManagerPage.css';

interface DeckManagerPageProps {
    onExit: () => void;
    onNavigate?: (page: NavPage) => void;
    onEditDeck: (deckId: string) => void;
    onCreateDeck: () => void;
    supportMenu?: React.ReactNode;
}

export const DeckManagerPage: React.FC<DeckManagerPageProps> = ({
    onExit,
    onNavigate,
    onEditDeck,
    onCreateDeck,
    supportMenu,
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
    const [isImportChooserOpen, setIsImportChooserOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importReview, setImportReview] = useState<DeckResolutionResult | null>(null);
    const [pendingImportDeck, setPendingImportDeck] = useState<DeckCardLists | null>(null);
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isDragImportActive, setIsDragImportActive] = useState(false);
    const [deckFileHistory, setDeckFileHistory] = useState<DeckFileHistoryConfig>(() => appConfigService.loadDeckFileHistory());
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

    useEffect(() => {
        if (!selectedDeckId) return;
        if (filteredDecks.some(deck => deck.id === selectedDeckId)) return;
        selectDeck(null);
    }, [filteredDecks, selectedDeckId, selectDeck]);

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
        setIsImportChooserOpen(false);
        fileInputRef.current?.click();
    };

    const saveImportedDeck = async (deck: DeckCardLists) => {
        const { saveDeck: save } = useDeckStore.getState();
        useDeckStore.setState({ currentDeck: deck, isDirty: true });
        const id = await save();
        if (id) {
            selectDeck(id);
            await loadDecks();
            setImportStatus(`Imported ${deck.name || 'deck'}.`);
        }
        return id;
    };

    const importDeckText = async (content: string, deckName: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            setImportError('No deck text was found to import.');
            return;
        }

        const resolution = await resolveImportedDeckText(trimmedContent, deckName);
        const deck = resolution.deck;

        if (resolution.unresolved.length > 0) {
            setPendingImportDeck(deck);
            setImportReview(resolution);
            return;
        }

        await saveImportedDeck(deck);
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const deckName = getDeckNameFromFile(file);
            setDeckFileHistory(appConfigService.rememberDeckImportFile(file.name, deckName));
            await importDeckText(await readFileAsText(file), deckName);
        } catch (error) {
            console.error('Failed to import deck:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import deck.');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    const handleClipboardImport = async () => {
        setIsImportChooserOpen(false);
        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            if (!navigator.clipboard?.readText) {
                throw new Error('Clipboard reading is not available in this browser.');
            }

            await importDeckText(await navigator.clipboard.readText(), 'Clipboard Deck');
        } catch (error) {
            console.error('Failed to import deck from clipboard:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import deck from clipboard.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragImportActive(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragImportActive(false);
    };

    const handleDropImport = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragImportActive(false);
        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const file = event.dataTransfer.files?.[0];
            if (file) {
                const deckName = getDeckNameFromFile(file);
                setDeckFileHistory(appConfigService.rememberDeckImportFile(file.name, deckName));
                await importDeckText(await readFileAsText(file), deckName);
                return;
            }

            const text = event.dataTransfer.getData('text/plain');
            await importDeckText(text, 'Dropped Deck');
        } catch (error) {
            console.error('Failed to import dropped deck:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import dropped deck.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleAlternateSearch = async (item: Parameters<typeof parseAlternateSearch>[0], query: string) => {
        setImportError(null);
        return cardResolverService.searchAlternates(parseAlternateSearch(item, query), 20);
    };

    const closeImportReview = () => {
        setImportReview(null);
        setPendingImportDeck(null);
        setImportError(null);
    };

    const handleApplyImportFixes = async (replacements: DeckImportReplacement[], remember: boolean) => {
        if (!pendingImportDeck || !importReview) return;

        const replacementsByKey = new Map(replacements.map(({ item, replacement }) => [item.key, replacement]));
        for (const { item, replacement } of replacements) {
            if (remember) {
                cardResolverService.rememberFix(reportItemToDeckCard(item), replacement);
            }
        }

        const fixedDeck = cardResolverService.applyResolutionFixes(pendingImportDeck, replacementsByKey);
        setIsImporting(true);
        try {
            await saveImportedDeck(fixedDeck);
            closeImportReview();
        } finally {
            setIsImporting(false);
        }
    };

    const handleSaveUnresolvedImport = async () => {
        if (!pendingImportDeck) return;

        setIsImporting(true);
        try {
            await saveImportedDeck(pendingImportDeck);
            closeImportReview();
        } finally {
            setIsImporting(false);
        }
    };

    const handleExportClick = async () => {
        if (!selectedDeckId) return;

        // Load full deck data for export
        const { loadDeck } = useDeckStore.getState();
        await loadDeck(selectedDeckId);
        const { currentDeck } = useDeckStore.getState();

        if (currentDeck) {
            const fileName = (currentDeck.name || 'deck') + '.dck';
            const content = DeckSerializer.exportDeck(currentDeck);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDeckFileHistory(appConfigService.rememberDeckExportFile(fileName, currentDeck.name || 'deck'));
        }
    };

    const handleClipboardExportClick = async () => {
        if (!selectedDeckId) return;

        setIsExporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard writing is not available in this browser.');
            }

            const { loadDeck } = useDeckStore.getState();
            await loadDeck(selectedDeckId);
            const { currentDeck } = useDeckStore.getState();
            if (!currentDeck) {
                throw new Error('Selected deck could not be loaded for export.');
            }

            await navigator.clipboard.writeText(DeckSerializer.exportDeck(currentDeck));
            setImportStatus(`Copied ${currentDeck.name || 'deck'} to clipboard.`);
        } catch (error) {
            console.error('Failed to copy deck to clipboard:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to copy deck to clipboard.');
        } finally {
            setIsExporting(false);
        }
    };

    const selectedDeck = decks.find(d => d.id === selectedDeckId);

    return (
        <div className="deck-manager-page">
            <Navbar
                currentPage="decks"
                onNavigate={handleNavigation}
                onLogout={onExit}
                supportMenu={supportMenu}
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

            <div
                className={`deck-manager-content ${isDragImportActive ? 'deck-manager-content-drop-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropImport}
                data-testid="deck-manager-drop-zone"
            >
                {isDragImportActive && (
                    <div className="deck-manager-drop-overlay" role="status">
                        Drop deck text or file to import
                    </div>
                )}

                {(importStatus || importError) && (
                    <div
                        className={`deck-manager-import-banner ${importError ? 'deck-manager-import-banner-error' : ''}`}
                        role={importError ? 'alert' : 'status'}
                    >
                        {importError || importStatus}
                    </div>
                )}

                {isLoadingDecks || isImporting ? (
                    <div className="deck-manager-loading">
                        {isImporting ? 'Importing deck...' : 'Loading decks...'}
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
                                onDelete={() => setShowDeleteConfirm(deck.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="deck-manager-toolbar">
                <div className="toolbar-left">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsImportChooserOpen(true)}
                        data-testid="deck-manager-import-menu-button"
                    >
                        IMPORT
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleClipboardImport}
                        disabled={isImporting}
                        data-testid="deck-import-clipboard-button"
                    >
                        PASTE
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportClick}
                        disabled={!selectedDeckId}
                        data-testid="deck-manager-export-button"
                    >
                        EXPORT
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleClipboardExportClick}
                        disabled={!selectedDeckId || isExporting}
                        data-testid="deck-export-clipboard-button"
                    >
                        COPY
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
                accept={DECK_TEXT_IMPORT_ACCEPT}
                onChange={handleFileImport}
                data-testid="deck-manager-file-import-input"
            />

            <Modal
                isOpen={isImportChooserOpen}
                onClose={() => setIsImportChooserOpen(false)}
                title="Import Deck"
                size="sm"
            >
                <div className="deck-import-source-chooser" data-testid="deck-manager-import-source-dialog">
                    <button
                        type="button"
                        className="deck-import-source-option"
                        onClick={handleImportClick}
                        disabled={isImporting}
                        data-testid="deck-manager-import-file-option"
                    >
                        <strong>New deck from file</strong>
                        <span>Choose a deck file and save it as a local deck.</span>
                    </button>
                    <button
                        type="button"
                        className="deck-import-source-option"
                        onClick={() => void handleClipboardImport()}
                        disabled={isImporting}
                        data-testid="deck-manager-import-clipboard-option"
                    >
                        <strong>New deck from clipboard</strong>
                        <span>Read deck text from the clipboard and save it as a local deck.</span>
                    </button>
                    <p className="deck-import-source-note">Drop deck text or files onto the manager to import them directly.</p>
                    {deckFileHistory.lastImport && (
                        <p className="deck-import-source-note" data-testid="deck-manager-last-import-note">
                            Last file import: {deckFileHistory.lastImport.fileName}
                        </p>
                    )}
                    {deckFileHistory.lastExport && (
                        <p className="deck-import-source-note" data-testid="deck-manager-last-export-note">
                            Last file export: {deckFileHistory.lastExport.fileName}
                        </p>
                    )}
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={Boolean(showDeleteConfirm)}
                onClose={() => setShowDeleteConfirm(null)}
                title="Delete Deck"
                size="sm"
                footer={(
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowDeleteConfirm(null)}
                            data-testid="deck-manager-delete-cancel-button"
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={handleConfirmDelete}
                            data-testid="deck-manager-delete-confirm-button"
                        >
                            Delete
                        </button>
                    </>
                )}
            >
                <div className="delete-confirm-modal" data-testid="deck-manager-delete-confirm">
                    <p>Are you sure you want to delete "{selectedDeck?.name}"?</p>
                </div>
            </Modal>

            {importReview && pendingImportDeck && (
                <DeckImportReviewModal
                    review={importReview}
                    error={importError}
                    busy={isImporting}
                    onCancel={closeImportReview}
                    onImportAnyway={handleSaveUnresolvedImport}
                    onApply={handleApplyImportFixes}
                    onSearchAlternates={handleAlternateSearch}
                />
            )}
        </div>
    );
};

export default DeckManagerPage;
