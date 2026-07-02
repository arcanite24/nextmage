/**
 * Deck Editor Page
 * 
 * Full deck editing experience with MTGA-style two-panel layout:
 * - Left: Card collection browser with filters
 * - Right: Deck panel with main deck and sideboard
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { DeckSerializer } from '../../services/DeckSerializer';
import {
    cardResolverService,
    DECK_TEXT_IMPORT_ACCEPT,
    getDeckNameFromFile,
    appConfigService,
    createEmptyBasicLandCounts,
    defaultAddLandsDeckSize,
    deckGeneratorService,
    deckLandsService,
    parseAlternateSearch,
    readFileAsText,
    reportItemToDeckCard,
    resolveImportedDeckText,
    type AddBasicLandsOptions,
    type BasicLandCounts,
    type DeckCardZone,
    type DeckFileHistoryConfig,
    type DeckGeneratorSettings,
    type DeckImportReplacement,
    type DeckResolutionResult,
} from '../../services';
import { Modal, Navbar, NavPage } from '../common';
import { CardFilters } from './CardFilters';
import { CollectionBrowser } from './CollectionBrowser';
import { DeckPanel } from './DeckPanel';
import { DeckImportReviewModal } from './DeckImportReviewModal';
import { DeckLegalityPanel } from './DeckLegalityPanel';
import { DeckAnalyticsPanel } from './DeckAnalyticsPanel';
import { DeckAddLandsDialog } from './DeckAddLandsDialog';
import { AddLandsResultDetails, type AddLandsResultDetailsData } from './AddLandsResultDetails';
import { DeckGeneratorDialog } from './DeckGeneratorDialog';
import type { DeckCardLists } from '../../types';
import './DeckEditorPage.css';

interface DeckEditorPageProps {
    deckId?: string;
    onExit: () => void;
    onNavigate?: (page: NavPage) => void;
    onDone: () => void;
    supportMenu?: React.ReactNode;
    activitySubmitContext?: {
        tableId: string;
        kind: 'sideboard' | 'construction';
        title: string;
        limitedSideboard?: boolean;
    } | null;
    onSubmitActivityDeck?: (tableId: string, deck: DeckCardLists) => Promise<boolean>;
}

type EditorImportMode = 'replace' | 'append';
type DeckRowSelectionSource = 'legality' | 'analytics' | null;

const FREE_BUILD_ADD_LANDS_ZONES: DeckCardZone[] = ['main', 'side'];
const MAIN_DECK_ADD_LANDS_ZONES: DeckCardZone[] = ['main'];
const DECK_GENERATOR_TIMEOUT_MS = 15_000;

function normalizeSelectedDeckCardName(cardName: string): string {
    return cardName.trim().toLocaleLowerCase();
}

function collectDeckCardNameSet(deck: DeckCardLists | null): Set<string> {
    const names = new Set<string>();
    for (const card of deck?.cards ?? []) {
        if (card.amount > 0) names.add(normalizeSelectedDeckCardName(card.cardName));
    }
    for (const card of deck?.sideboard ?? []) {
        if (card.amount > 0) names.add(normalizeSelectedDeckCardName(card.cardName));
    }
    return names;
}

function pruneSelectedDeckCardNames(deck: DeckCardLists | null, cardNames: string[]): string[] {
    if (cardNames.length === 0) return cardNames;

    const availableCardNames = collectDeckCardNameSet(deck);
    return cardNames.filter(cardName => availableCardNames.has(normalizeSelectedDeckCardName(cardName)));
}

function hasExternalDeckImportData(dataTransfer: DataTransfer): boolean {
    const types = Array.from(dataTransfer.types);
    return !types.includes('application/json') && (types.includes('Files') || types.includes('text/plain'));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    promise.catch(() => undefined);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
}

export const DeckEditorPage: React.FC<DeckEditorPageProps> = ({
    deckId,
    onExit,
    onNavigate,
    onDone,
    supportMenu,
    activitySubmitContext = null,
    onSubmitActivityDeck,
}) => {
    const {
        decks,
        isLoadingDecks,
        currentDeck,
        editorMode,
        editorConfig,
        isEditing,
        isDirty,
        loadDecks,
        loadDeck,
        createNewDeck,
        saveDeck,
        saveDeckAs,
        closeDeck,
        replaceCurrentDeck,
        appendDeck,
        markCurrentDeckClean,
        addCard,
        addDeckCards,
        removeCard,
        setCardAmount,
        moveCard,
        searchCards,
        updateEditorModeConfig,
        resetEditorModeConfig,
    } = useDeckStore();
    const modeConfig = editorConfig.modes[editorMode];
    const isLimitedAddLandsMode = editorMode === 'limited' || activitySubmitContext?.limitedSideboard === true;
    const allowSnowBasics = editorMode === 'normal';
    const canAddLands = editorMode === 'normal' || isLimitedAddLandsMode;
    const addLandsAllowedZones = editorMode === 'normal' ? FREE_BUILD_ADD_LANDS_ZONES : MAIN_DECK_ADD_LANDS_ZONES;
    const addLandsInitialDeckSize = defaultAddLandsDeckSize(currentDeck, { limited: isLimitedAddLandsMode });
    const addLandsContextLabel = isLimitedAddLandsMode
        ? activitySubmitContext?.limitedSideboard === true ? 'limited sideboard main deck' : 'limited construction main deck'
        : 'current deck list';
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isSavingDeck, setIsSavingDeck] = useState(false);
    const [isSavingDeckAs, setIsSavingDeckAs] = useState(false);
    const [isSubmittingActivityDeck, setIsSubmittingActivityDeck] = useState(false);
    const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
    const [isImportChooserOpen, setIsImportChooserOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');
    const [isLoadDeckOpen, setIsLoadDeckOpen] = useState(false);
    const [isLoadingSavedDecks, setIsLoadingSavedDecks] = useState(false);
    const [isAddingLands, setIsAddingLands] = useState(false);
    const [isAddLandsOpen, setIsAddLandsOpen] = useState(false);
    const [addLandsError, setAddLandsError] = useState<string | null>(null);
    const [addLandsResultDetails, setAddLandsResultDetails] = useState<AddLandsResultDetailsData | null>(null);
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
    const [generatorError, setGeneratorError] = useState<string | null>(null);
    const [generatorSettings, setGeneratorSettings] = useState<DeckGeneratorSettings>(() => appConfigService.loadDeckGeneratorSettings());
    const [importReview, setImportReview] = useState<DeckResolutionResult | null>(null);
    const [pendingImportDeck, setPendingImportDeck] = useState<DeckCardLists | null>(null);
    const [pendingImportMode, setPendingImportMode] = useState<EditorImportMode>('replace');
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [isDragImportActive, setIsDragImportActive] = useState(false);
    const [selectedLegalityCardNames, setSelectedLegalityCardNames] = useState<string[]>([]);
    const [deckRowSelectionSource, setDeckRowSelectionSource] = useState<DeckRowSelectionSource>(null);
    const [activeLegalityProblemCardNames, setActiveLegalityProblemCardNames] = useState<string[]>([]);
    const [deckFileHistory, setDeckFileHistory] = useState<DeckFileHistoryConfig>(() => appConfigService.loadDeckFileHistory());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importReviewReturnFocusRef = useRef<HTMLElement | null>(null);
    const addLandsReturnFocusRef = useRef<HTMLElement | null>(null);
    const generatorReturnFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isDirty) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        const prunedCardNames = pruneSelectedDeckCardNames(currentDeck, selectedLegalityCardNames);
        if (prunedCardNames.length === selectedLegalityCardNames.length) return;

        setSelectedLegalityCardNames(prunedCardNames);
        if (prunedCardNames.length === 0) {
            setDeckRowSelectionSource(null);
        }
    }, [currentDeck, selectedLegalityCardNames]);

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
        const action = page === 'lobby'
            ? 'go to the lobby'
            : page === 'decks'
                ? 'return to Decks'
                : page === 'settings'
                    ? 'open settings'
                    : `open ${page}`;

        if (!confirmDiscardUnsavedChanges(action)) return;
        closeDeck();

        if (onNavigate) {
            onNavigate(page);
        } else if (page === 'lobby') {
            onExit();
        }
    };

    const handleNavbarLogout = (): boolean => {
        if (!confirmDiscardUnsavedChanges('log out')) return false;
        closeDeck();
        onExit();
        return true;
    };

    const handleDone = async () => {
        if (isDirty) {
            await saveDeck();
        }
        closeDeck();
        onDone();
    };

    const handleActivityDeckSubmit = async () => {
        if (!activitySubmitContext || !onSubmitActivityDeck || !currentDeck) return;

        setIsSubmittingActivityDeck(true);
        setAddLandsResultDetails(null);
        setImportStatus(null);
        setImportError(null);

        try {
            const submitted = await onSubmitActivityDeck(activitySubmitContext.tableId, currentDeck);
            const label = activitySubmitContext.kind === 'sideboard' ? 'Sideboard' : 'Limited deck';
            if (submitted) {
                markCurrentDeckClean();
            }
            setImportStatus(submitted ? `${label} submitted.` : `${label} submit was rejected.`);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Failed to submit activity deck.');
        } finally {
            setIsSubmittingActivityDeck(false);
        }
    };

    const handleSearch = () => {
        searchCards();
    };

    const confirmDiscardUnsavedChanges = (action: string): boolean => {
        if (!isDirty) return true;
        return window.confirm(`Discard unsaved changes and ${action}?`);
    };

    const handleSaveDeck = async () => {
        setIsSavingDeck(true);
        setAddLandsResultDetails(null);
        setImportStatus(null);
        setImportError(null);

        try {
            const id = await saveDeck();
            if (!id) {
                throw new Error('Deck could not be saved.');
            }
            setImportStatus(`Saved ${currentDeck?.name || 'deck'}.`);
        } catch (error) {
            console.error('Failed to save deck:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to save deck.');
        } finally {
            setIsSavingDeck(false);
        }
    };

    const handleNewDeck = () => {
        if (!confirmDiscardUnsavedChanges('start a new deck')) return;
        setSelectedLegalityCardNames([]);
        setDeckRowSelectionSource(null);
        setAddLandsResultDetails(null);
        setImportStatus('Started a new deck.');
        setImportError(null);
        createNewDeck();
    };

    const handleOpenLoadDeck = async () => {
        setAddLandsResultDetails(null);
        setImportStatus(null);
        setImportError(null);
        setIsLoadDeckOpen(true);
        setIsLoadingSavedDecks(true);

        try {
            await loadDecks();
        } catch (error) {
            console.error('Failed to refresh saved decks:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to refresh saved decks.');
        } finally {
            setIsLoadingSavedDecks(false);
        }
    };

    const handleLoadSavedDeck = async (id: string) => {
        const selectedDeck = decks.find(deck => deck.id === id);
        if (!confirmDiscardUnsavedChanges(`load ${selectedDeck?.name || 'the selected deck'}`)) return;

        setIsLoadingSavedDecks(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const loaded = await loadDeck(id);
            if (!loaded) {
                throw new Error('Selected deck could not be loaded.');
            }

            setSelectedLegalityCardNames([]);
            setDeckRowSelectionSource(null);
            setImportStatus(`Loaded ${selectedDeck?.name || 'deck'}.`);
            setIsLoadDeckOpen(false);
        } catch (error) {
            console.error('Failed to load saved deck:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to load saved deck.');
        } finally {
            setIsLoadingSavedDecks(false);
        }
    };

    const handleOpenSaveAs = () => {
        setSaveAsName(`${currentDeck?.name || 'Deck'} Copy`);
        setImportError(null);
        setImportStatus(null);
        setIsSaveAsOpen(true);
    };

    const saveDeckCopyWithName = async (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setImportError('Deck name is required for Save As.');
            return;
        }

        setIsSavingDeckAs(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const id = await saveDeckAs(trimmedName);
            if (!id) {
                throw new Error('Deck copy could not be saved.');
            }

            setImportStatus(`Saved copy as ${trimmedName}.`);
            setIsSaveAsOpen(false);
        } catch (error) {
            console.error('Failed to save deck copy:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to save deck copy.');
        } finally {
            setIsSavingDeckAs(false);
        }
    };

    const handleSaveAsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await saveDeckCopyWithName(saveAsName);
    };

    const handleSaveAsNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveDeckCopyWithName(event.currentTarget.value);
    };

    const applyImportedDeck = (deck: DeckCardLists, mode: EditorImportMode) => {
        setSelectedLegalityCardNames([]);
        setDeckRowSelectionSource(null);
        setAddLandsResultDetails(null);
        if (mode === 'append') {
            appendDeck(deck);
            setImportStatus(`Appended ${deck.name || 'deck'}.`);
        } else {
            replaceCurrentDeck(deck);
            setImportStatus(`Imported ${deck.name || 'deck'}.`);
        }
    };

    const importDeckText = async (content: string, deckName: string, mode: EditorImportMode) => {
        const resolution = await resolveImportedDeckText(content, deckName);
        const deck = resolution.deck;

        if (resolution.unresolved.length > 0) {
            setPendingImportDeck(deck);
            setPendingImportMode(mode);
            setImportReview(resolution);
            return;
        }

        applyImportedDeck(deck, mode);
    };

    const handleImportFileClick = () => {
        setIsImportChooserOpen(false);
        fileInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        importReviewReturnFocusRef.current = null;
        if (!confirmDiscardUnsavedChanges('replace the current deck with the imported file')) {
            event.target.value = '';
            return;
        }

        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const deckName = getDeckNameFromFile(file);
            setDeckFileHistory(appConfigService.rememberDeckImportFile(file.name, deckName));
            await importDeckText(await readFileAsText(file), deckName, 'replace');
        } catch (error) {
            console.error('Failed to import deck file:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import deck file.');
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    const handleClipboardImport = async (mode: EditorImportMode, returnFocusElement?: HTMLElement | null) => {
        importReviewReturnFocusRef.current = returnFocusElement ?? null;
        setIsImportChooserOpen(false);
        if (mode === 'replace' && !confirmDiscardUnsavedChanges('replace the current deck with clipboard contents')) {
            return;
        }

        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            if (!navigator.clipboard?.readText) {
                throw new Error('Clipboard reading is not available in this browser.');
            }

            await importDeckText(await navigator.clipboard.readText(), mode === 'append' ? 'Clipboard Append' : 'Clipboard Deck', mode);
        } catch (error) {
            console.error('Failed to import deck from clipboard:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import deck from clipboard.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeckExport = () => {
        if (!currentDeck) return;

        const content = DeckSerializer.exportDeck(currentDeck);
        const fileName = `${currentDeck.name || 'deck'}.dck`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setDeckFileHistory(appConfigService.rememberDeckExportFile(fileName, currentDeck.name || 'deck'));
    };

    const handleClipboardExport = async () => {
        if (!currentDeck) return;

        setIsExporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard writing is not available in this browser.');
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

    const restoreAddLandsFocus = () => {
        window.setTimeout(() => {
            const returnFocusElement = addLandsReturnFocusRef.current;
            if (returnFocusElement?.isConnected) {
                returnFocusElement.focus();
            }
            addLandsReturnFocusRef.current = null;
        }, 0);
    };

    const closeAddLandsDialog = () => {
        setIsAddLandsOpen(false);
        restoreAddLandsFocus();
    };

    const handleOpenAddLands = (event: React.MouseEvent<HTMLButtonElement>) => {
        addLandsReturnFocusRef.current = event.currentTarget;
        setAddLandsError(null);
        setAddLandsResultDetails(null);
        setIsAddLandsOpen(true);
    };

    const restoreGeneratorFocus = () => {
        window.setTimeout(() => {
            const returnFocusElement = generatorReturnFocusRef.current;
            if (returnFocusElement?.isConnected) {
                returnFocusElement.focus();
            }
            generatorReturnFocusRef.current = null;
        }, 0);
    };

    const closeGeneratorDialog = () => {
        setIsGeneratorOpen(false);
        restoreGeneratorFocus();
    };

    const handleOpenGenerator = (event: React.MouseEvent<HTMLButtonElement>) => {
        generatorReturnFocusRef.current = event.currentTarget;
        setGeneratorSettings(appConfigService.loadDeckGeneratorSettings());
        setGeneratorError(null);
        setIsGeneratorOpen(true);
    };

    const handleGenerateDeck = async (settings: DeckGeneratorSettings) => {
        if (!confirmDiscardUnsavedChanges('replace this deck with a generated deck')) return;

        setIsGeneratingDeck(true);
        setGeneratorError(null);
        setAddLandsResultDetails(null);
        setImportStatus(null);
        setImportError(null);

        try {
            const savedSettings = appConfigService.saveDeckGeneratorSettings(settings);
            setGeneratorSettings(savedSettings);
            const result = await withTimeout(
                deckGeneratorService.generateDeck(savedSettings),
                DECK_GENERATOR_TIMEOUT_MS,
                'Deck generation timed out while searching the local server. Try a narrower format or set.',
            );
            replaceCurrentDeck(result.deck);
            setSelectedLegalityCardNames([]);
            setDeckRowSelectionSource(null);
            closeGeneratorDialog();

            const warningText = result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : '';
            setImportStatus(`Generated ${result.deck.name || 'deck'} from ${result.selectedColors.join('/')}.${warningText}`);
        } catch (error) {
            console.error('Failed to generate deck:', error);
            setGeneratorError(error instanceof Error ? error.message : 'Failed to generate deck.');
        } finally {
            setIsGeneratingDeck(false);
        }
    };

    const handleSuggestBasicLands = async (deckSize: number): Promise<BasicLandCounts> => {
        setAddLandsError(null);
        if (!currentDeck) return createEmptyBasicLandCounts();

        try {
            return await deckLandsService.suggestBasicLands(currentDeck, deckSize);
        } catch (error) {
            console.error('Failed to suggest basic lands:', error);
            setAddLandsError(error instanceof Error ? error.message : 'Failed to suggest basic lands.');
            return createEmptyBasicLandCounts();
        }
    };

    const handleLoadBasicLandSetOptions = useCallback(async () => {
        if (!currentDeck) return [];
        return deckLandsService.listBasicLandSetOptions(currentDeck, { allowSnowBasics });
    }, [allowSnowBasics, currentDeck]);

    const handleAddBasicLands = async (counts: BasicLandCounts, zone: DeckCardZone, options: AddBasicLandsOptions) => {
        if (!currentDeck) return;

        setIsAddingLands(true);
        setAddLandsError(null);
        setAddLandsResultDetails(null);
        setImportStatus(null);
        setImportError(null);

        try {
            const result = await deckLandsService.addBasicLands(currentDeck, counts, zone, options);
            addDeckCards(result.addedCards, zone);
            setSelectedLegalityCardNames([]);
            setDeckRowSelectionSource(null);
            closeAddLandsDialog();

            const totalAdded = result.addedCards.reduce((sum, card) => sum + card.amount, 0);
            const landCountLabel = totalAdded === 1 ? 'basic land' : 'basic lands';
            const destination = zone === 'main' ? 'main deck' : 'sideboard';
            const printingDetails = [
                options.setCode?.trim() ? `from ${options.setCode.trim().toUpperCase()}` : null,
                options.fullArtOnly ? 'full-art only' : null,
            ].filter(Boolean).join(', ');
            const printingMessage = printingDetails ? ` (${printingDetails})` : '';
            const unresolvedMessage = result.unresolvedCardNames.length > 0
                ? ` ${result.unresolvedCardNames.join(', ')} used fallback printings.`
                : '';
            setAddLandsResultDetails({
                totalAdded,
                destination: zone,
                setCode: options.setCode?.trim().toUpperCase() || null,
                fullArtOnly: Boolean(options.fullArtOnly),
                addedCards: result.addedCards,
                unresolvedCardNames: result.unresolvedCardNames,
            });
            setImportStatus(`Added ${totalAdded} ${landCountLabel}${printingMessage} to ${destination}.${unresolvedMessage}`);
        } catch (error) {
            console.error('Failed to add basic lands:', error);
            setAddLandsResultDetails(null);
            setAddLandsError(error instanceof Error ? error.message : 'Failed to add basic lands.');
        } finally {
            setIsAddingLands(false);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (!hasExternalDeckImportData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragImportActive(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragImportActive(false);
    };

    const handleDropImport = async (event: React.DragEvent<HTMLDivElement>) => {
        if (!hasExternalDeckImportData(event.dataTransfer)) return;

        event.preventDefault();
        setIsDragImportActive(false);
        importReviewReturnFocusRef.current = null;
        setIsImporting(true);
        setImportStatus(null);
        setImportError(null);

        try {
            const file = event.dataTransfer.files?.[0];
            if (file) {
                const deckName = getDeckNameFromFile(file);
                setDeckFileHistory(appConfigService.rememberDeckImportFile(file.name, deckName));
                await importDeckText(await readFileAsText(file), deckName, 'append');
                return;
            }

            await importDeckText(event.dataTransfer.getData('text/plain'), 'Dropped Deck', 'append');
        } catch (error) {
            console.error('Failed to import dropped deck:', error);
            setImportError(error instanceof Error ? error.message : 'Failed to import dropped deck.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleSearchAlternates = async (item: Parameters<typeof parseAlternateSearch>[0], query: string) => {
        setImportError(null);
        return cardResolverService.searchAlternates(parseAlternateSearch(item, query), 20);
    };

    const handleSelectLegalityCards = (cardNames: string[]) => {
        setSelectedLegalityCardNames(cardNames);
        setDeckRowSelectionSource('legality');
    };

    const handleSelectAnalyticsCards = (cardNames: string[]) => {
        if (cardNames.length === 0) {
            setSelectedLegalityCardNames(current => deckRowSelectionSource === 'analytics' ? [] : current);
            setDeckRowSelectionSource(current => current === 'analytics' ? null : current);
            return;
        }

        setSelectedLegalityCardNames(cardNames);
        setDeckRowSelectionSource('analytics');
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

        setIsImporting(true);
        try {
            applyImportedDeck(cardResolverService.applyResolutionFixes(pendingImportDeck, replacementsByKey), pendingImportMode);
            closeImportReview();
        } finally {
            setIsImporting(false);
        }
    };

    const handleImportAnyway = async () => {
        if (!pendingImportDeck) return;

        setIsImporting(true);
        try {
            applyImportedDeck(pendingImportDeck, pendingImportMode);
            closeImportReview();
        } finally {
            setIsImporting(false);
        }
    };

    // Initial search on mount
    useEffect(() => {
        // Trigger initial search with default filters
        searchCards();
    }, []);

    const isSavedDeckListLoading = isLoadingSavedDecks || isLoadingDecks;

    return (
        <div className="deck-editor-page">
            <Navbar
                currentPage="decks"
                onNavigate={handleNavigation}
                onLogout={handleNavbarLogout}
                supportMenu={supportMenu}
            />

            <div
                className={`deck-editor-layout ${isDragImportActive ? 'deck-editor-layout-drop-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropImport}
                data-testid="deck-editor-drop-zone"
            >
                {isDragImportActive && (
                    <div className="deck-editor-drop-overlay" role="status">
                        Drop deck text or file to append
                    </div>
                )}

                {/* Left Panel: Card Browser */}
                <div className="deck-editor-left">
                    <CardFilters onSearch={handleSearch} />
                    <CollectionBrowser onAddCard={addCard} />
                </div>

                {/* Right Panel: Deck */}
                <div
                    className="deck-editor-right"
                    style={{ '--deck-panel-width': `${modeConfig.deckPanelWidth}px` } as React.CSSProperties}
                >
                    <DeckPanel
                        onRemoveCard={removeCard}
                        onAddCard={addCard}
                        onSetCardAmount={setCardAmount}
                        onMoveCard={moveCard}
                        selectedCardNames={selectedLegalityCardNames}
                        formatInvalidCardNames={activeLegalityProblemCardNames}
                    />
                    <DeckLegalityPanel
                        deck={currentDeck}
                        selectedFormat={currentDeck?.format}
                        onSelectCardNames={handleSelectLegalityCards}
                        onActiveProblemCardNames={setActiveLegalityProblemCardNames}
                    />
                    <DeckAnalyticsPanel deck={currentDeck} onSelectCardNames={handleSelectAnalyticsCards} />
                    <div className="deck-editor-actions">
                        {(importStatus || importError) && (
                            <div
                                className={`deck-editor-status ${importError ? 'deck-editor-status-error' : ''}`}
                                role={importError ? 'alert' : 'status'}
                            >
                                {importError || importStatus}
                            </div>
                        )}
                        {addLandsResultDetails && !importError && (
                            <AddLandsResultDetails details={addLandsResultDetails} />
                        )}
                        <div className="deck-editor-command-row">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setIsImportChooserOpen(true)}
                                disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                aria-label="Choose deck import source"
                                title="Choose deck import source"
                                data-testid="deck-editor-import-menu-button"
                            >
                                Import
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={(event) => void handleClipboardImport('replace', event.currentTarget)}
                                disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                aria-label="Replace current deck from clipboard"
                                title="Replace current deck from clipboard"
                                data-testid="deck-editor-paste-replace-button"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={(event) => void handleClipboardImport('append', event.currentTarget)}
                                disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                aria-label="Append clipboard deck to current deck"
                                title="Append clipboard deck to current deck"
                                data-testid="deck-editor-paste-append-button"
                            >
                                Append
                            </button>
                            {canAddLands && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleOpenAddLands}
                                    disabled={!currentDeck || isAddingLands || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                    title={isLimitedAddLandsMode ? 'Add basic lands to the limited main deck' : 'Add basic lands'}
                                    data-testid="deck-editor-add-lands-button"
                                >
                                    Lands
                                </button>
                            )}
                            {activitySubmitContext && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => void handleActivityDeckSubmit()}
                                    disabled={
                                        !currentDeck
                                        || !onSubmitActivityDeck
                                        || isSubmittingActivityDeck
                                        || isImporting
                                        || isSavingDeck
                                        || isSavingDeckAs
                                        || isGeneratingDeck
                                    }
                                    data-testid="deck-editor-activity-submit-button"
                                    data-activity-kind={activitySubmitContext.kind}
                                    data-table-id={activitySubmitContext.tableId}
                                >
                                    {isSubmittingActivityDeck
                                        ? 'Submitting'
                                        : activitySubmitContext.kind === 'sideboard'
                                            ? 'Submit Sideboard'
                                            : 'Submit Deck'}
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleOpenGenerator}
                                disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                data-testid="deck-editor-generate-button"
                            >
                                Generate
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void handleOpenLoadDeck()}
                                disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck || isLoadingSavedDecks}
                                data-testid="deck-editor-load-button"
                            >
                                Load
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleDeckExport}
                                disabled={!currentDeck || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                data-testid="deck-editor-export-button"
                            >
                                Export
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void handleClipboardExport()}
                                disabled={!currentDeck || isExporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                                data-testid="deck-editor-copy-button"
                            >
                                Copy
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void handleSaveDeck()}
                                disabled={!currentDeck || isSavingDeck || isSavingDeckAs || isImporting || isGeneratingDeck}
                                data-testid="deck-editor-save-button"
                            >
                                {isSavingDeck ? 'Saving' : 'Save'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleOpenSaveAs}
                                disabled={!currentDeck || isSavingDeck || isSavingDeckAs || isImporting || isGeneratingDeck}
                                data-testid="deck-editor-save-as-button"
                            >
                                Save As
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleNewDeck}
                                disabled={isSavingDeck || isSavingDeckAs || isImporting || isGeneratingDeck}
                                data-testid="deck-editor-new-button"
                            >
                                New
                            </button>
                        </div>
                        <div
                            className="deck-layout-controls"
                            data-testid="deck-editor-layout-controls"
                            data-editor-mode={editorMode}
                            data-deck-panel-width={modeConfig.deckPanelWidth}
                            data-collection-view={modeConfig.collectionView}
                            data-collection-sort={modeConfig.collectionSortBy}
                            data-collection-sort-direction={modeConfig.collectionSortDirection}
                            data-deck-sort={modeConfig.deckSortBy}
                            data-deck-sort-direction={modeConfig.deckSortDirection}
                            data-sideboard-visible={modeConfig.showSideboard}
                        >
                            <label className="deck-layout-control">
                                <span>Deck width</span>
                                <input
                                    type="range"
                                    min={280}
                                    max={520}
                                    step={20}
                                    value={modeConfig.deckPanelWidth}
                                    onChange={(e) => updateEditorModeConfig({ deckPanelWidth: Number(e.target.value) })}
                                    data-testid="deck-editor-panel-width-input"
                                />
                            </label>
                            <button
                                type="button"
                                className="btn btn-secondary deck-layout-reset-button"
                                onClick={() => resetEditorModeConfig()}
                                title={`Reset ${editorMode} editor layout and sort settings`}
                                data-testid="deck-editor-reset-layout-button"
                                data-editor-mode={editorMode}
                            >
                                Reset layout
                            </button>
                        </div>
                        <button
                            className="btn btn-primary btn-done"
                            onClick={handleDone}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept={DECK_TEXT_IMPORT_ACCEPT}
                onChange={handleFileImport}
                data-testid="deck-editor-file-import-input"
            />

            <Modal
                isOpen={isImportChooserOpen}
                onClose={() => setIsImportChooserOpen(false)}
                title="Import Deck"
                size="sm"
            >
                <div className="deck-import-source-chooser" data-testid="deck-editor-import-source-dialog">
                    <button
                        type="button"
                        className="deck-import-source-option"
                        onClick={handleImportFileClick}
                        disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                        data-testid="deck-editor-import-file-option"
                    >
                        <strong>Replace from file</strong>
                        <span>Choose a deck file and replace the current deck after confirmation.</span>
                    </button>
                    <button
                        type="button"
                        className="deck-import-source-option"
                        onClick={(event) => void handleClipboardImport('replace', event.currentTarget)}
                        disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                        data-testid="deck-editor-import-clipboard-replace-option"
                    >
                        <strong>Replace from clipboard</strong>
                        <span>Read deck text from the clipboard and replace the current deck.</span>
                    </button>
                    <button
                        type="button"
                        className="deck-import-source-option"
                        onClick={(event) => void handleClipboardImport('append', event.currentTarget)}
                        disabled={isImporting || isSavingDeck || isSavingDeckAs || isGeneratingDeck}
                        data-testid="deck-editor-import-clipboard-append-option"
                    >
                        <strong>Append from clipboard</strong>
                        <span>Add clipboard deck text to the current main deck and sideboard.</span>
                    </button>
                    <p className="deck-import-source-note">Drag deck text or files onto the editor to append without opening this chooser.</p>
                    {deckFileHistory.lastImport && (
                        <p className="deck-import-source-note" data-testid="deck-editor-last-import-note">
                            Last file import: {deckFileHistory.lastImport.fileName}
                        </p>
                    )}
                    {deckFileHistory.lastExport && (
                        <p className="deck-import-source-note" data-testid="deck-editor-last-export-note">
                            Last file export: {deckFileHistory.lastExport.fileName}
                        </p>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={isLoadDeckOpen}
                onClose={() => setIsLoadDeckOpen(false)}
                title="Load Deck"
                size="lg"
                footer={(
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsLoadDeckOpen(false)}
                    >
                        Cancel
                    </button>
                )}
            >
                <div className="deck-load-dialog" data-testid="deck-editor-load-dialog">
                    {isSavedDeckListLoading ? (
                        <div className="deck-load-empty" role="status">Loading decks...</div>
                    ) : decks.length === 0 ? (
                        <div className="deck-load-empty">No saved decks</div>
                    ) : (
                        <div className="deck-load-list">
                            {decks.map(deck => (
                                <button
                                    key={deck.id}
                                    type="button"
                                    className={`deck-load-row ${deck.id === currentDeck?.id ? 'deck-load-row-current' : ''}`}
                                    onClick={() => void handleLoadSavedDeck(deck.id)}
                                    data-testid="deck-editor-load-deck-row"
                                    data-current={deck.id === currentDeck?.id || undefined}
                                >
                                    <span className="deck-load-name">{deck.name || 'Untitled Deck'}</span>
                                    <span className="deck-load-meta">
                                        {deck.format?.replace('Constructed - ', '') || 'No format'}
                                        {' '}
                                        ·
                                        {' '}
                                        {deck.cardCount ?? 0}/{deck.sideboardCount ?? 0}
                                    </span>
                                    <span className="deck-load-updated">
                                        {Number.isFinite(deck.updatedAt) ? new Date(deck.updatedAt).toLocaleDateString() : ''}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={isSaveAsOpen}
                onClose={() => setIsSaveAsOpen(false)}
                title="Save Deck As"
                size="sm"
                footer={(
                    <>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsSaveAsOpen(false)}
                            disabled={isSavingDeckAs}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="deck-save-as-form"
                            className="btn btn-primary"
                            disabled={isSavingDeckAs || !saveAsName.trim()}
                            aria-label="Save deck copy"
                            data-testid="deck-editor-save-as-submit-button"
                        >
                            {isSavingDeckAs ? 'Saving' : 'Save Copy'}
                        </button>
                    </>
                )}
            >
                <form id="deck-save-as-form" className="deck-save-as-form" onSubmit={handleSaveAsSubmit}>
                    <label>
                        <span>Deck name</span>
                        <input
                            type="text"
                            value={saveAsName}
                            onChange={(event) => setSaveAsName(event.currentTarget.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={handleSaveAsNameKeyDown}
                            autoFocus
                            data-modal-autofocus="true"
                            data-testid="deck-editor-save-as-name-input"
                        />
                    </label>
                </form>
            </Modal>

            {importReview && pendingImportDeck && (
                <DeckImportReviewModal
                    review={importReview}
                    error={importError}
                    busy={isImporting}
                    title={pendingImportMode === 'append' ? 'Review Appended Cards' : 'Review Imported Cards'}
                    importAnywayLabel={pendingImportMode === 'append' ? 'Append Anyway' : 'Import Anyway'}
                    applyLabel={pendingImportMode === 'append' ? 'Apply and Append' : 'Apply Fixes'}
                    returnFocusElement={importReviewReturnFocusRef.current}
                    onCancel={closeImportReview}
                    onImportAnyway={handleImportAnyway}
                    onApply={handleApplyImportFixes}
                    onSearchAlternates={handleSearchAlternates}
                />
            )}

            {isAddLandsOpen && (
                <DeckAddLandsDialog
                    deck={currentDeck}
                    busy={isAddingLands}
                    error={addLandsError}
                    allowSnowBasics={allowSnowBasics}
                    allowedZones={addLandsAllowedZones}
                    initialDeckSize={addLandsInitialDeckSize}
                    contextLabel={addLandsContextLabel}
                    onCancel={closeAddLandsDialog}
                    onSuggest={handleSuggestBasicLands}
                    onLoadSetOptions={handleLoadBasicLandSetOptions}
                    onAdd={handleAddBasicLands}
                />
            )}

            {isGeneratorOpen && (
                <DeckGeneratorDialog
                    initialSettings={generatorSettings}
                    busy={isGeneratingDeck}
                    error={generatorError}
                    onCancel={closeGeneratorDialog}
                    onGenerate={handleGenerateDeck}
                />
            )}
        </div>
    );
};

export default DeckEditorPage;
