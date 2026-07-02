import React, { useEffect, useRef, useState } from 'react';
import {
    candidateValue,
    describeImportZones,
    formatCandidate,
    parseAlternateSearch,
    type DeckImportReplacement,
} from '../../services';
import type { CardUnresolvedReportItem, DeckResolutionResult, ResolvedCard } from '../../services';
import './DeckImportReviewModal.css';

interface DeckImportReviewModalProps {
    review: DeckResolutionResult;
    error?: string | null;
    title?: string;
    summary?: string;
    applyLabel?: string;
    importAnywayLabel?: string;
    returnFocusElement?: HTMLElement | null;
    busy?: boolean;
    onCancel: () => void;
    onImportAnyway: () => void | Promise<void>;
    onApply: (replacements: DeckImportReplacement[], remember: boolean) => void | Promise<void>;
    onSearchAlternates: (item: CardUnresolvedReportItem, query: string) => Promise<ResolvedCard[]>;
}

interface AlternateSearchFeedback {
    count: number;
    searched: boolean;
}

export const DeckImportReviewModal: React.FC<DeckImportReviewModalProps> = ({
    review,
    error,
    title = 'Review Imported Cards',
    summary,
    applyLabel = 'Apply Fixes',
    importAnywayLabel = 'Import Anyway',
    returnFocusElement,
    busy = false,
    onCancel,
    onImportAnyway,
    onApply,
    onSearchAlternates,
}) => {
    const [unresolved, setUnresolved] = useState<CardUnresolvedReportItem[]>(review.unresolved);
    const [replacementSelections, setReplacementSelections] = useState<Record<string, string>>({});
    const [rememberImportFixes, setRememberImportFixes] = useState(true);
    const [alternateSearch, setAlternateSearch] = useState<Record<string, string>>({});
    const [alternateSearchFeedback, setAlternateSearchFeedback] = useState<Record<string, AlternateSearchFeedback>>({});
    const [searchingAlternateKey, setSearchingAlternateKey] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const firstReplacementSelectRef = useRef<HTMLSelectElement | null>(null);
    const restoreFocusElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        restoreFocusElementRef.current = returnFocusElement ?? (
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        );
        firstReplacementSelectRef.current?.focus();

        return () => {
            const restoreFocusElement = restoreFocusElementRef.current;
            if (restoreFocusElement?.isConnected) {
                restoreFocusElement.focus();
            }
        };
    }, [returnFocusElement]);

    useEffect(() => {
        setUnresolved(review.unresolved);
        setReplacementSelections({});
        setAlternateSearch({});
        setAlternateSearchFeedback({});
        setSearchError(null);
    }, [review]);

    useEffect(() => {
        if (busy) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        };

        document.addEventListener('keydown', handleEscape, { capture: true });
        return () => document.removeEventListener('keydown', handleEscape, { capture: true });
    }, [busy, onCancel]);

    const findSelectedReplacement = (item: CardUnresolvedReportItem): ResolvedCard | null => {
        const selected = replacementSelections[item.key];
        if (!selected) return null;
        return item.candidates.find(candidate => candidateValue(candidate) === selected) ?? null;
    };

    const selectedImportFixes = unresolved
        .map(item => {
            const replacement = findSelectedReplacement(item);
            return replacement ? { item, replacement } : null;
        })
        .filter((item): item is DeckImportReplacement => Boolean(item));

    const handleReplacementChange = (key: string, value: string) => {
        setReplacementSelections(current => ({ ...current, [key]: value }));
    };

    const handleAlternateSearch = async (item: CardUnresolvedReportItem) => {
        setSearchingAlternateKey(item.key);
        setSearchError(null);

        try {
            const candidates = await onSearchAlternates(item, alternateSearch[item.key] || '');
            setUnresolved(current => current.map(unresolvedItem => (
                unresolvedItem.key === item.key ? { ...unresolvedItem, candidates } : unresolvedItem
            )));
            setReplacementSelections(current => ({ ...current, [item.key]: '' }));
            setAlternateSearchFeedback(current => ({
                ...current,
                [item.key]: { count: candidates.length, searched: true },
            }));
        } catch (err) {
            console.error('Failed to search alternate cards:', err);
            setSearchError(err instanceof Error ? err.message : 'Failed to search alternate cards.');
        } finally {
            setSearchingAlternateKey(null);
        }
    };

    const getReplacementStatus = (item: CardUnresolvedReportItem): string | null => {
        const feedback = alternateSearchFeedback[item.key];
        if (feedback?.searched) {
            if (feedback.count === 0) return 'No replacement options found.';
            return `${feedback.count} replacement option${feedback.count === 1 ? '' : 's'} loaded.`;
        }

        if (item.candidates.length === 0) return null;
        return `${item.candidates.length} suggested replacement option${item.candidates.length === 1 ? '' : 's'}.`;
    };

    const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;

        const focusableElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        )).filter(element => !element.matches(':disabled') && element.getAttribute('aria-hidden') !== 'true');

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey) {
            if (activeElement === firstElement || !event.currentTarget.contains(activeElement)) {
                event.preventDefault();
                lastElement.focus();
            }
            return;
        }

        if (activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    return (
        <div className="modal-overlay deck-import-review-overlay">
            <div
                className="modal-content deck-import-review-modal"
                data-testid="deck-import-fixer-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="deck-import-review-title"
                onKeyDown={handleDialogKeyDown}
            >
                <div className="deck-import-review-header">
                    <h3 id="deck-import-review-title">{title}</h3>
                    <p>
                        {summary || `${unresolved.length} card ${unresolved.length === 1 ? 'entry needs' : 'entries need'} a replacement before the import is fully resolved.`}
                    </p>
                </div>

                {(error || searchError) && (
                    <div className="deck-import-review-error" role="alert">
                        {error || searchError}
                    </div>
                )}

                <div className="deck-import-review-list">
                    {unresolved.map((item, index) => (
                        <div
                            className="deck-import-review-row"
                            key={item.key}
                            data-testid="deck-import-unresolved-card"
                            data-replacement-option-count={item.candidates.length}
                        >
                            <div className="deck-import-review-card">
                                <strong>{item.cardName}</strong>
                                <span>{item.amount} total - {describeImportZones(item)}</span>
                                {(item.setCode || item.cardNumber) && (
                                    <span>{item.setCode || 'Unknown set'}:{item.cardNumber || 'Unknown number'}</span>
                                )}
                            </div>

                            <label className="deck-import-review-field">
                                <span>Replacement</span>
                                <select
                                    ref={index === 0 ? firstReplacementSelectRef : undefined}
                                    value={replacementSelections[item.key] || ''}
                                    onChange={(event) => handleReplacementChange(item.key, event.target.value)}
                                    data-testid="deck-import-replacement-select"
                                    aria-label={`Replacement for ${item.cardName}`}
                                >
                                    <option value="">Keep unresolved</option>
                                    {item.candidates.map(candidate => (
                                        <option key={candidateValue(candidate)} value={candidateValue(candidate)}>
                                            {formatCandidate(candidate)}
                                        </option>
                                    ))}
                                </select>
                                {getReplacementStatus(item) && (
                                    <small
                                        className="deck-import-review-result-status"
                                        data-testid="deck-import-search-status"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        {getReplacementStatus(item)}
                                    </small>
                                )}
                            </label>

                            <form
                                className="deck-import-review-search"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleAlternateSearch(item);
                                }}
                            >
                                <label className="deck-import-review-field">
                                    <span>Search</span>
                                    <input
                                        value={alternateSearch[item.key] || ''}
                                        onChange={(event) => setAlternateSearch(current => ({ ...current, [item.key]: event.target.value }))}
                                        placeholder="Name, [SET:NUM], or SET NUM"
                                        data-testid="deck-import-alternate-search-input"
                                        aria-label={`Search replacement for ${item.cardName}`}
                                    />
                                </label>
                                <button
                                    type="submit"
                                    className="btn btn-secondary"
                                    disabled={busy || searchingAlternateKey === item.key}
                                    data-testid="deck-import-alternate-search-button"
                                    aria-label={`Search alternate printings for ${item.cardName}`}
                                >
                                    {searchingAlternateKey === item.key ? 'Searching' : 'Search'}
                                </button>
                            </form>
                        </div>
                    ))}
                </div>

                <label className="deck-import-review-remember">
                    <input
                        type="checkbox"
                        checked={rememberImportFixes}
                        onChange={(event) => setRememberImportFixes(event.target.checked)}
                    />
                    Remember replacements
                </label>

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => void onImportAnyway()}
                        disabled={busy}
                        data-testid="deck-import-save-unresolved-button"
                    >
                        {importAnywayLabel}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => void onApply(selectedImportFixes, rememberImportFixes)}
                        disabled={busy || selectedImportFixes.length === 0}
                        data-testid="deck-import-apply-fixes-button"
                    >
                        {applyLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeckImportReviewModal;
