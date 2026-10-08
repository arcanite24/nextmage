import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    deckLegalityService,
    DECK_LEGALITY_FORMATS,
    type DeckLegalityFormatResult,
    type DeckLegalityReport,
} from '../../services';
import type { CommanderBracketView, DeckCardLists } from '../../types';
import './DeckLegalityPanel.css';

interface DeckLegalityPanelProps {
    deck: DeckCardLists | null;
    selectedFormat?: string;
    onSelectCardNames: (cardNames: string[]) => void;
    onActiveProblemCardNames?: (cardNames: string[]) => void;
}

function statusLabel(status: DeckLegalityFormatResult['status']): string {
    switch (status) {
        case 'legal':
            return 'Legal';
        case 'partly-legal':
            return 'Partial';
        case 'not-legal':
            return 'Invalid';
        case 'unknown':
        default:
            return 'Unknown';
    }
}

function normalizeFormat(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function matchesFormat(result: DeckLegalityFormatResult, deckType: string | null | undefined): boolean {
    const normalized = normalizeFormat(deckType);
    if (!normalized) return false;
    return normalizeFormat(result.format.deckType) === normalized
        || normalizeFormat(result.format.shortName) === normalized
        || (result.format.aliases ?? []).some(alias => normalizeFormat(alias) === normalized);
}

function matchesFormatDefinition(format: typeof DECK_LEGALITY_FORMATS[number], deckType: string | null | undefined): boolean {
    const normalized = normalizeFormat(deckType);
    if (!normalized) return false;
    return normalizeFormat(format.deckType) === normalized
        || normalizeFormat(format.shortName) === normalized
        || (format.aliases ?? []).some(alias => normalizeFormat(alias) === normalized);
}

function orderFormatsForInitialValidation(selectedFormat: string | undefined): typeof DECK_LEGALITY_FORMATS {
    const selected = DECK_LEGALITY_FORMATS.find(format => matchesFormatDefinition(format, selectedFormat));
    const priority = selected ?? DECK_LEGALITY_FORMATS[0];
    return [
        priority,
        ...DECK_LEGALITY_FORMATS.filter(format => format.deckType !== priority.deckType),
    ];
}

function buildPendingReport(priorityResults: DeckLegalityFormatResult[]): DeckLegalityReport {
    const resultsByDeckType = new Map(priorityResults.map(result => [result.format.deckType, result]));

    return {
        results: DECK_LEGALITY_FORMATS.map(format => {
            const result = resultsByDeckType.get(format.deckType)
                ?? priorityResults.find(candidate => matchesFormat(candidate, format.deckType));
            return result ?? {
                format,
                status: 'unknown' as const,
                validationSource: 'none' as const,
                issues: [],
                selectableCardNames: [],
            };
        }),
    };
}

function formatIssueSummary(result: DeckLegalityFormatResult): string {
    const source = validationSourceLabel(result.validationSource);
    const rules = formatRulesLabel(result.format);
    const selectHint = result.selectableCardNames.length > 0
        ? `\nClick to select ${result.selectableCardNames.length} problem ${result.selectableCardNames.length === 1 ? 'card' : 'cards'}.`
        : '';
    if (result.issues.length === 0) return `${result.format.shortName}: ${statusLabel(result.status)}\n${rules}\nSource: ${source}${selectHint}`;
    const issueText = result.issues
        .slice(0, 20)
        .map(issue => `${issue.group}: ${issue.message}`)
        .join('\n');
    const overflow = result.issues.length > 20 ? `\n...and ${result.issues.length - 20} more` : '';
    return `${result.format.shortName}: ${statusLabel(result.status)}\n${rules}\nSource: ${source}${selectHint}\n${issueText}${overflow}`;
}

function validationSourceLabel(source: DeckLegalityFormatResult['validationSource']): string {
    switch (source) {
        case 'server':
            return 'Server validator';
        case 'browser':
            return 'Browser fallback';
        case 'none':
        default:
            return 'Not checked';
    }
}

function formatRulesLabel(format: DeckLegalityFormatResult['format']): string {
    const sideboard = format.maxSideboard === 0 ? 'no sideboard' : `sideboard max ${format.maxSideboard}`;
    const copies = format.maxCopies === 1 ? 'singleton' : `${format.maxCopies} copies`;
    return `Main min ${format.minMain}, ${sideboard}, ${copies}`;
}

function formatEdhPowerTitle(result: DeckLegalityFormatResult): string {
    const level = result.edhPowerLevel ?? 0;
    const details = result.edhPowerDetails ?? [];
    const cardCount = (result.edhPowerCards ?? []).length;
    const selectHint = cardCount > 0
        ? `Click to select ${cardCount} contributing ${cardCount === 1 ? 'card' : 'cards'}.`
        : 'No contributing cards to select.';
    if (details.length === 0) return `EDH Power Level: ${level}\n${selectHint}`;
    return [
        `EDH Power Level: ${level}`,
        `Found ${cardCount} cards with power levels`,
        selectHint,
        ...details.slice(0, 25),
        ...(details.length > 25 ? [`...and ${details.length - 25} more`] : []),
    ].join('\n');
}

function formatBracketTitle(bracket: CommanderBracketView): string {
    const header = `${bracket.name}: ${bracket.valid ? 'Good' : 'Bad'}`;
    const selectHint = bracket.badCards.length > 0
        ? `Click to select ${bracket.badCards.length} bad ${bracket.badCards.length === 1 ? 'card' : 'cards'}.`
        : '';
    const groups = bracket.groups.map(group => {
        const max = group.max >= 99 ? 'any' : String(group.max);
        const cards = group.cards.length > 0 ? ` - ${group.cards.join(', ')}` : '';
        return `${group.name}: ${group.count} of ${max}${cards}`;
    });
    return [header, selectHint, ...groups].filter(Boolean).join('\n');
}

function bracketStatusClass(bracket: CommanderBracketView): string {
    return bracket.valid ? 'deck-legality-label-legal' : 'deck-legality-label-not-legal';
}

type SupplementalLegalityDetail =
    | { kind: 'edh-power' }
    | { kind: 'commander-bracket'; level: number };

const DETAIL_PREVIEW_LIMIT = 4;
const DESKTOP_TOOLTIP_MAX_ERRORS = 20;

function cardSpecificIssues(issues: DeckLegalityFormatResult['issues']): DeckLegalityFormatResult['issues'] {
    return issues.filter(issue => Boolean(issue.cardName));
}

function deckLevelIssues(issues: DeckLegalityFormatResult['issues']): DeckLegalityFormatResult['issues'] {
    return issues.filter(issue => !issue.cardName);
}

function desktopTooltipStatus(result: DeckLegalityFormatResult): string {
    switch (result.status) {
        case 'legal':
            return 'VALID';
        case 'partly-legal':
            return 'PARTLY VALID';
        case 'not-legal':
            return 'INVALID';
        case 'unknown':
        default:
            return 'UNKNOWN';
    }
}

export const DeckLegalityPanel: React.FC<DeckLegalityPanelProps> = ({
    deck,
    selectedFormat,
    onSelectCardNames,
    onActiveProblemCardNames,
}) => {
    const [report, setReport] = useState<DeckLegalityReport | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [activeDeckType, setActiveDeckType] = useState(selectedFormat || DECK_LEGALITY_FORMATS[0].deckType);
    const [activeSupplementalDetail, setActiveSupplementalDetail] = useState<SupplementalLegalityDetail | null>(null);
    const [isHidden, setIsHidden] = useState(false);
    const [isDetailExpanded, setIsDetailExpanded] = useState(false);
    const [activeSelectionKey, setActiveSelectionKey] = useState<string | null>(null);
    const activeDetailTriggerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (selectedFormat) {
            setActiveDeckType(selectedFormat);
        }
    }, [selectedFormat]);

    useEffect(() => {
        setActiveSelectionKey(null);
    }, [deck, selectedFormat]);

    useEffect(() => {
        let cancelled = false;
        setIsChecking(true);

        const orderedFormats = orderFormatsForInitialValidation(selectedFormat);
        const commanderFormat = DECK_LEGALITY_FORMATS.find(format => matchesFormatDefinition(format, 'Commander'));
        const initialFormats = [
            orderedFormats[0],
            ...(commanderFormat && commanderFormat.deckType !== orderedFormats[0].deckType ? [commanderFormat] : []),
        ];

        deckLegalityService.validateDeck(deck, initialFormats).then((priorityReport) => {
            if (cancelled) return;
            if (priorityReport.results.length > 0) {
                setReport(buildPendingReport(priorityReport.results));
                setIsChecking(false);
            }
            return deckLegalityService.validateDeck(deck, orderedFormats);
        }).then((nextReport) => {
            if (!nextReport) return;
            if (cancelled) return;
            setReport(nextReport);
            setIsChecking(false);
        }).catch((error) => {
            if (cancelled) return;
            console.error('Failed to validate deck legality:', error);
            setReport(null);
            setIsChecking(false);
        });

        return () => {
            cancelled = true;
        };
    }, [deck, selectedFormat]);

    const activeResult = useMemo(() => {
        return report?.results.find(result => matchesFormat(result, activeDeckType))
            ?? report?.results.find(result => matchesFormat(result, selectedFormat))
            ?? report?.results[0]
            ?? null;
    }, [activeDeckType, report, selectedFormat]);

    const edhPowerResult = useMemo(() => {
        return report?.results.find(result => (
            typeof result.edhPowerLevel === 'number'
            && (matchesFormat(result, 'Commander') || result.edhPowerLevel > 0 || (result.edhPowerCards?.length ?? 0) > 0)
        )) ?? null;
    }, [report]);

    const commanderBrackets = useMemo(() => {
        return edhPowerResult?.commanderBrackets ?? [];
    }, [edhPowerResult]);

    const rememberActiveDetailTrigger = (trigger?: HTMLElement | null) => {
        activeDetailTriggerRef.current = trigger ?? (
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        );
    };

    const restoreActiveDetailFocus = () => {
        const trigger = activeDetailTriggerRef.current;
        if (trigger?.isConnected && !trigger.matches(':disabled')) {
            trigger.focus();
        }
    };

    const handleSelectResult = (result: DeckLegalityFormatResult, trigger?: HTMLElement | null) => {
        rememberActiveDetailTrigger(trigger);
        const selectionKey = `format:${result.format.deckType}`;
        if (activeSelectionKey === selectionKey) {
            setActiveSelectionKey(null);
            onSelectCardNames([]);
            return;
        }

        setActiveSupplementalDetail(null);
        setActiveDeckType(result.format.deckType);
        setActiveSelectionKey(selectionKey);
        onSelectCardNames(result.selectableCardNames);
    };

    const handleSelectEdhPower = (trigger?: HTMLElement | null) => {
        rememberActiveDetailTrigger(trigger);
        const selectionKey = 'edh-power';
        if (activeSelectionKey === selectionKey) {
            setActiveSelectionKey(null);
            setActiveSupplementalDetail(null);
            onSelectCardNames([]);
            return;
        }

        setActiveSupplementalDetail({ kind: 'edh-power' });
        setActiveSelectionKey(selectionKey);
        onSelectCardNames(edhPowerResult?.edhPowerCards ?? []);
    };

    const handleSelectCommanderBracket = (bracket: CommanderBracketView, trigger?: HTMLElement | null) => {
        rememberActiveDetailTrigger(trigger);
        const selectionKey = `commander-bracket:${bracket.level}`;
        if (activeSelectionKey === selectionKey) {
            setActiveSelectionKey(null);
            setActiveSupplementalDetail(null);
            onSelectCardNames([]);
            return;
        }

        setActiveSupplementalDetail({ kind: 'commander-bracket', level: bracket.level });
        setActiveSelectionKey(selectionKey);
        onSelectCardNames(bracket.badCards);
    };

    const handleSelectCardSubset = (cardNames: string[]) => {
        setActiveSelectionKey(null);
        onSelectCardNames(cardNames);
    };

    const handleSelectFormatCards = (result: DeckLegalityFormatResult) => {
        setActiveSelectionKey(`format:${result.format.deckType}`);
        onSelectCardNames(result.selectableCardNames);
    };

    const handleSelectableCardKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, cardName: string) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleSelectCardSubset([cardName]);
    };

    const activeCommanderBracket = activeSupplementalDetail?.kind === 'commander-bracket'
        ? commanderBrackets.find(bracket => bracket.level === activeSupplementalDetail.level) ?? null
        : null;

    const activeCardIssues = useMemo(() => cardSpecificIssues(activeResult?.issues ?? []), [activeResult]);
    const activeDeckIssues = useMemo(() => deckLevelIssues(activeResult?.issues ?? []), [activeResult]);
    const activeDetailKind = activeSupplementalDetail?.kind ?? 'format';
    const activeDetailStatus = activeCommanderBracket
        ? activeCommanderBracket.valid ? 'valid' : 'invalid'
        : activeResult?.status ?? 'unknown';
    const activeDetailValidationSource = activeSupplementalDetail
        ? edhPowerResult?.validationSource ?? 'none'
        : activeResult?.validationSource ?? 'none';
    const activeDetailIssueCount = activeSupplementalDetail?.kind === 'edh-power'
        ? edhPowerResult?.edhPowerDetails?.length ?? 0
        : activeCommanderBracket
            ? activeCommanderBracket.groups.length
            : activeResult?.issues.length ?? 0;
    const activeDetailSelectableCount = activeSupplementalDetail?.kind === 'edh-power'
        ? edhPowerResult?.edhPowerCards?.length ?? 0
        : activeCommanderBracket
            ? activeCommanderBracket.badCards.length
            : activeResult?.selectableCardNames.length ?? 0;
    const activeDetailsLabel = activeSupplementalDetail?.kind === 'edh-power' && edhPowerResult
        ? `EDH Power legality details: level ${edhPowerResult.edhPowerLevel ?? 0}, ${activeDetailSelectableCount} contributing ${activeDetailSelectableCount === 1 ? 'card' : 'cards'}, ${activeDetailIssueCount} ${activeDetailIssueCount === 1 ? 'detail' : 'details'}, Source ${validationSourceLabel(activeDetailValidationSource)}. Press Escape to clear the current drilldown.`
        : activeCommanderBracket
            ? `${activeCommanderBracket.shortName} legality details: ${activeCommanderBracket.valid ? 'Good' : 'Bad'}, ${activeDetailSelectableCount} bad ${activeDetailSelectableCount === 1 ? 'card' : 'cards'}, ${activeDetailIssueCount} ${activeDetailIssueCount === 1 ? 'group' : 'groups'}, Source ${validationSourceLabel(activeDetailValidationSource)}. Press Escape to clear the current drilldown.`
            : activeResult
                ? `${activeResult.format.shortName} legality details: ${statusLabel(activeResult.status)}, ${activeDetailIssueCount} ${activeDetailIssueCount === 1 ? 'issue' : 'issues'}, ${activeDetailSelectableCount} selectable ${activeDetailSelectableCount === 1 ? 'card' : 'cards'}, ${activeDeckIssues.length} deck ${activeDeckIssues.length === 1 ? 'error' : 'errors'}, Source ${validationSourceLabel(activeDetailValidationSource)}. Press Escape to clear the current drilldown.`
                : 'Active legality details. Press Escape to clear the current drilldown.';

    useEffect(() => {
        onActiveProblemCardNames?.(activeResult?.selectableCardNames ?? []);
    }, [activeResult, onActiveProblemCardNames]);

    const renderSelectableCardList = (label: string, cardNames: string[]) => {
        if (cardNames.length === 0) return null;

        return (
            <div className="deck-legality-card-list" aria-label={label} data-testid="deck-legality-card-list">
                <span>{label}</span>
                <div>
                    {cardNames.map(cardName => (
                        <button
                            key={`${label}-${cardName}`}
                            type="button"
                            onClick={() => handleSelectCardSubset([cardName])}
                            onKeyDown={(event) => handleSelectableCardKeyDown(event, cardName)}
                            title={`Select ${cardName}`}
                            data-card-name={cardName}
                            data-testid="deck-legality-card"
                        >
                            {cardName}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderDeckIssueList = (issues: DeckLegalityFormatResult['issues']) => {
        const deckIssues = deckLevelIssues(issues);
        if (deckIssues.length === 0) return null;

        return (
            <div
                className="deck-legality-deck-issues"
                aria-label="Deck-level errors"
                data-testid="deck-legality-deck-issue-list"
                data-deck-issue-count={deckIssues.length}
            >
                <span>Deck errors</span>
                <div>
                    {deckIssues.map((issue, index) => (
                        <div
                            key={`deck-issue-${issue.type}-${issue.group}-${issue.message}-${index}`}
                            className="deck-legality-deck-issue"
                            data-testid="deck-legality-deck-issue"
                            data-issue-type={issue.type}
                            data-issue-group={issue.group}
                            data-issue-message={issue.message}
                        >
                            <strong>{issue.group}</strong>
                            <span>{issue.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderDesktopTooltipMirror = (result: DeckLegalityFormatResult) => {
        const previewIssues = result.issues.slice(0, DESKTOP_TOOLTIP_MAX_ERRORS);
        const overflowCount = Math.max(0, result.issues.length - DESKTOP_TOOLTIP_MAX_ERRORS);

        return (
            <div
                className="deck-legality-desktop-tooltip"
                aria-label={`${result.format.shortName} desktop legality details`}
                data-testid="deck-legality-desktop-tooltip"
                data-status={result.status}
                data-tooltip-max-errors={DESKTOP_TOOLTIP_MAX_ERRORS}
                data-preview-issue-count={previewIssues.length}
                data-overflow-count={overflowCount}
                data-selectable-card-count={result.selectableCardNames.length}
            >
                <div className="deck-legality-desktop-tooltip-header">
                    <strong>Deck is {desktopTooltipStatus(result)}</strong>
                    {result.selectableCardNames.length > 0 && (
                        <button
                            type="button"
                            onClick={() => handleSelectFormatCards(result)}
                            data-testid="deck-legality-tooltip-select-all"
                        >
                            Select {result.selectableCardNames.length} problem {result.selectableCardNames.length === 1 ? 'card' : 'cards'}
                        </button>
                    )}
                </div>
                {previewIssues.length > 0 ? (
                    <div className="deck-legality-desktop-tooltip-table" role="table" aria-label="Desktop legality tooltip errors">
                        {previewIssues.map((issue, index) => (
                            <button
                                key={`tooltip-${issue.type}-${issue.group}-${issue.message}-${index}`}
                                type="button"
                                className="deck-legality-desktop-tooltip-row"
                                role="row"
                                onClick={() => issue.cardName && handleSelectCardSubset([issue.cardName])}
                                disabled={!issue.cardName}
                                data-testid="deck-legality-tooltip-issue"
                                data-issue-kind={issue.cardName ? 'card' : 'deck'}
                                data-issue-type={issue.type}
                                data-issue-group={issue.group}
                                data-card-name={issue.cardName ?? ''}
                            >
                                <strong role="cell">{issue.group}</strong>
                                <span role="cell">{issue.message}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className="deck-legality-muted">No validation problems reported.</span>
                )}
                {overflowCount > 0 && (
                    <span className="deck-legality-tooltip-overflow" data-testid="deck-legality-tooltip-overflow">
                        {overflowCount} more hidden by the desktop tooltip limit.
                    </span>
                )}
            </div>
        );
    };

    useEffect(() => {
        setIsDetailExpanded(false);
    }, [activeResult?.format.deckType, activeSupplementalDetail?.kind, activeCommanderBracket?.level]);

    const handleClearActiveDetail = () => {
        setActiveSupplementalDetail(null);
        setActiveSelectionKey(null);
        onSelectCardNames([]);
        restoreActiveDetailFocus();
    };

    const handleDetailsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;

        event.preventDefault();
        handleClearActiveDetail();
    };

    if (isHidden) {
        return (
            <section className="deck-legality-panel deck-legality-panel-collapsed" aria-label="Deck legality" data-testid="deck-legality-panel">
                <button
                    type="button"
                    className="deck-legality-toggle"
                    onClick={() => setIsHidden(false)}
                    data-testid="deck-legality-show-button"
                >
                    Show legality
                </button>
            </section>
        );
    }

    return (
        <section className="deck-legality-panel" aria-label="Deck legality" data-testid="deck-legality-panel">
            <div className="deck-legality-header">
                <span>Legality</span>
                <button
                    type="button"
                    className="deck-legality-toggle"
                    onClick={() => setIsHidden(true)}
                    data-testid="deck-legality-hide-button"
                >
                    Hide
                </button>
            </div>
            <div className="deck-legality-labels" role="list" aria-label="Format legality">
                {(report?.results ?? DECK_LEGALITY_FORMATS.map(format => ({
                    format,
                    status: 'unknown' as const,
                    validationSource: 'none' as const,
                    issues: [],
                    selectableCardNames: [],
                }))).map(result => (
                    <button
                        key={result.format.deckType}
                        type="button"
                        className={`deck-legality-label deck-legality-label-${result.status} ${!activeSupplementalDetail && activeResult?.format.deckType === result.format.deckType ? 'deck-legality-label-active' : ''}`}
                        onClick={(event) => handleSelectResult(result, event.currentTarget)}
                        aria-pressed={!activeSupplementalDetail && activeResult?.format.deckType === result.format.deckType}
                        title={formatIssueSummary(result)}
                        data-testid="deck-legality-label"
                        data-legality-status={result.status}
                        data-validation-source={result.validationSource}
                        data-format={result.format.shortName}
                        data-deck-type={result.format.deckType}
                        data-issue-count={result.issues.length}
                        data-selectable-card-count={result.selectableCardNames.length}
                    >
                        <span>{result.format.shortName}</span>
                        <strong>{statusLabel(result.status)}</strong>
                    </button>
                ))}
                {edhPowerResult && (
                    <button
                        type="button"
                        className={`deck-legality-label deck-legality-label-info deck-legality-label-wide ${activeSupplementalDetail?.kind === 'edh-power' ? 'deck-legality-label-active' : ''}`}
                        onClick={(event) => handleSelectEdhPower(event.currentTarget)}
                        aria-pressed={activeSupplementalDetail?.kind === 'edh-power'}
                        aria-label={`EDH Power Level ${edhPowerResult.edhPowerLevel ?? 0}. ${(edhPowerResult.edhPowerCards ?? []).length > 0 ? `Click to select ${(edhPowerResult.edhPowerCards ?? []).length} contributing ${(edhPowerResult.edhPowerCards ?? []).length === 1 ? 'card' : 'cards'}.` : 'No contributing cards to select.'}`}
                        title={formatEdhPowerTitle(edhPowerResult)}
                        data-testid="deck-legality-edh-power-label"
                        data-edh-power-level={edhPowerResult.edhPowerLevel}
                        data-validation-source={edhPowerResult?.validationSource ?? 'none'}
                        data-edh-power-card-count={edhPowerResult.edhPowerCards?.length ?? 0}
                        data-edh-power-detail-count={edhPowerResult.edhPowerDetails?.length ?? 0}
                    >
                        <span>EDH Power</span>
                        <strong>{edhPowerResult.edhPowerLevel ?? 0}</strong>
                    </button>
                )}
                {commanderBrackets.map(bracket => (
                    <button
                        key={`commander-bracket-${bracket.level}`}
                        type="button"
                        className={`deck-legality-label deck-legality-label-bracket ${bracketStatusClass(bracket)} ${activeSupplementalDetail?.kind === 'commander-bracket' && activeSupplementalDetail.level === bracket.level ? 'deck-legality-label-active' : ''}`}
                        onClick={(event) => handleSelectCommanderBracket(bracket, event.currentTarget)}
                        aria-pressed={activeSupplementalDetail?.kind === 'commander-bracket' && activeSupplementalDetail.level === bracket.level}
                        aria-label={`${bracket.name} ${bracket.valid ? 'Good' : 'Bad'}. ${bracket.badCards.length > 0 ? `Click to select ${bracket.badCards.length} bad ${bracket.badCards.length === 1 ? 'card' : 'cards'}.` : 'No bad cards to select.'}`}
                        title={formatBracketTitle(bracket)}
                        data-testid="deck-legality-bracket-label"
                        data-bracket-level={bracket.level}
                        data-bracket-status={bracket.valid ? 'valid' : 'invalid'}
                        data-validation-source={edhPowerResult?.validationSource ?? 'none'}
                        data-bracket-bad-card-count={bracket.badCards.length}
                        data-bracket-group-count={bracket.groups.length}
                    >
                        <span>{bracket.shortName}</span>
                        <strong>{bracket.valid ? 'Good' : 'Bad'}</strong>
                    </button>
                ))}
            </div>

            <div
                className="deck-legality-details"
                aria-label={activeDetailsLabel}
                aria-live="polite"
                tabIndex={0}
                onKeyDown={handleDetailsKeyDown}
                data-testid="deck-legality-details"
                data-detail-kind={activeDetailKind}
                data-detail-status={activeDetailStatus}
                data-validation-source={activeDetailValidationSource}
                data-issue-count={activeDetailIssueCount}
                data-selectable-card-count={activeDetailSelectableCount}
                data-deck-issue-count={activeDeckIssues.length}
            >
                {isChecking && !activeResult ? (
                    <span className="deck-legality-muted">Checking legality...</span>
                ) : activeSupplementalDetail?.kind === 'edh-power' && edhPowerResult ? (
                    <div className="deck-legality-issues">
                        <div className="deck-legality-summary" data-testid="deck-legality-detail-summary">
                            <span>
                                <strong>EDH Power</strong>
                                {edhPowerResult.edhPowerLevel ?? 0}
                            </span>
                            <span data-testid="deck-legality-detail-source">
                                {validationSourceLabel(edhPowerResult.validationSource)}
                            </span>
                            <span>
                                {(edhPowerResult.edhPowerCards ?? []).length} cards
                            </span>
                            <span>
                                {(edhPowerResult.edhPowerDetails ?? []).length} details
                            </span>
                            <span>
                                {edhPowerResult.format.shortName}
                            </span>
                        </div>
                        {(edhPowerResult.edhPowerDetails ?? []).length > 0 ? (
                            <>
                                {renderSelectableCardList('Contributors', edhPowerResult.edhPowerCards ?? [])}
                                {edhPowerResult.edhPowerDetails!
                                    .slice(0, isDetailExpanded ? edhPowerResult.edhPowerDetails!.length : DETAIL_PREVIEW_LIMIT)
                                    .map((detail, index) => (
                                    <button
                                        key={`${detail}-${index}`}
                                        type="button"
                                        className="deck-legality-issue deck-legality-issue-clickable"
                                        onClick={() => {
                                            setActiveSelectionKey('edh-power');
                                            onSelectCardNames(edhPowerResult.edhPowerCards ?? []);
                                        }}
                                        data-testid="deck-legality-issue"
                                    >
                                        <strong>EDH Power</strong>
                                        <span>{detail}</span>
                                    </button>
                                ))}
                                {edhPowerResult.edhPowerDetails!.length > DETAIL_PREVIEW_LIMIT && (
                                    <button
                                        type="button"
                                        className="deck-legality-expand-button"
                                        onClick={() => setIsDetailExpanded(expanded => !expanded)}
                                        aria-expanded={isDetailExpanded}
                                        data-testid="deck-legality-expand-issues-button"
                                        data-hidden-count={edhPowerResult.edhPowerDetails!.length - DETAIL_PREVIEW_LIMIT}
                                    >
                                        {isDetailExpanded
                                            ? 'Show fewer EDH details'
                                            : `Show ${edhPowerResult.edhPowerDetails!.length - DETAIL_PREVIEW_LIMIT} more EDH details`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <span className="deck-legality-muted">
                                EDH Power has no contributing cards.
                            </span>
                        )}
                    </div>
                ) : activeCommanderBracket ? (
                    <div className="deck-legality-issues">
                        <div className="deck-legality-summary" data-testid="deck-legality-detail-summary">
                            <span>
                                <strong>{activeCommanderBracket.shortName}</strong>
                                {activeCommanderBracket.valid ? 'Good' : 'Bad'}
                            </span>
                            <span>
                                {activeCommanderBracket.name}
                            </span>
                            <span data-testid="deck-legality-detail-source">
                                {validationSourceLabel(edhPowerResult?.validationSource ?? 'none')}
                            </span>
                            <span>
                                {activeCommanderBracket.badCards.length} bad cards
                            </span>
                            <span>
                                {activeCommanderBracket.groups.length} groups
                            </span>
                        </div>
                        {renderSelectableCardList('Bad cards', activeCommanderBracket.badCards)}
                        {activeCommanderBracket.groups.map(group => (
                            <button
                                key={`${activeCommanderBracket.level}-${group.name}`}
                                type="button"
                                className={`deck-legality-issue ${group.cards.length > 0 ? 'deck-legality-issue-clickable' : ''}`}
                                onClick={() => group.cards.length > 0 && handleSelectCardSubset(group.cards)}
                                disabled={group.cards.length === 0}
                                data-testid="deck-legality-issue"
                            >
                                <strong>{group.name}</strong>
                                <span>
                                    {group.count}/{group.max >= 99 ? 'any' : group.max}
                                    {group.cards.length > 0 ? ` - ${group.cards.join(', ')}` : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : activeResult ? (
                    <div className="deck-legality-issues">
                        <div className="deck-legality-summary" data-testid="deck-legality-detail-summary">
                            <span
                                className="deck-legality-detail-status"
                                data-testid="deck-legality-detail-status"
                                data-status={activeResult.status}
                                data-format={activeResult.format.shortName}
                                data-validation-source={activeResult.validationSource}
                            >
                                <strong>{activeResult.format.shortName}</strong>
                                <em>{statusLabel(activeResult.status)}</em>
                            </span>
                            <span title={formatRulesLabel(activeResult.format)}>
                                {formatRulesLabel(activeResult.format)}
                            </span>
                            <span data-testid="deck-legality-detail-source">
                                {validationSourceLabel(activeResult.validationSource)}
                            </span>
                            <span>
                                {activeResult.issues.length} {activeResult.issues.length === 1 ? 'issue' : 'issues'}
                            </span>
                            <span
                                data-testid="deck-legality-detail-card-issue-count"
                                data-card-issue-count={activeCardIssues.length}
                            >
                                {activeResult.selectableCardNames.length} selectable
                            </span>
                            <span
                                data-testid="deck-legality-detail-deck-issue-count"
                                data-deck-issue-count={activeDeckIssues.length}
                            >
                                {activeDeckIssues.length} deck
                            </span>
                        </div>
                        {edhPowerResult && activeResult === edhPowerResult && (edhPowerResult.edhPowerDetails?.length ?? 0) > 0 ? (
                            <>
                                {renderSelectableCardList('Contributors', edhPowerResult.edhPowerCards ?? [])}
                                {edhPowerResult.edhPowerDetails!
                                    .slice(0, isDetailExpanded ? edhPowerResult.edhPowerDetails!.length : DETAIL_PREVIEW_LIMIT)
                                    .map((detail, index) => (
                                    <button
                                        key={`${detail}-${index}`}
                                        type="button"
                                        className="deck-legality-issue deck-legality-issue-clickable"
                                        onClick={() => {
                                            setActiveSelectionKey('edh-power');
                                            onSelectCardNames(edhPowerResult.edhPowerCards ?? []);
                                        }}
                                        data-testid="deck-legality-issue"
                                    >
                                        <strong>EDH Power</strong>
                                        <span>{detail}</span>
                                    </button>
                                ))}
                                {edhPowerResult.edhPowerDetails!.length > DETAIL_PREVIEW_LIMIT && (
                                    <button
                                        type="button"
                                        className="deck-legality-expand-button"
                                        onClick={() => setIsDetailExpanded(expanded => !expanded)}
                                        aria-expanded={isDetailExpanded}
                                        data-testid="deck-legality-expand-issues-button"
                                        data-hidden-count={edhPowerResult.edhPowerDetails!.length - DETAIL_PREVIEW_LIMIT}
                                    >
                                        {isDetailExpanded
                                            ? 'Show fewer EDH details'
                                            : `Show ${edhPowerResult.edhPowerDetails!.length - DETAIL_PREVIEW_LIMIT} more EDH details`}
                                    </button>
                                )}
                            </>
                        ) : activeResult.issues.length > 0 ? (
                            <>
                                {renderDesktopTooltipMirror(activeResult)}
                                {renderDeckIssueList(activeResult.issues)}
                                {renderSelectableCardList('Problem cards', activeResult.selectableCardNames)}
                                {activeCardIssues
                                    .slice(0, isDetailExpanded ? activeCardIssues.length : DETAIL_PREVIEW_LIMIT)
                                    .map((issue, index) => (
                                    <button
                                        key={`${issue.type}-${issue.group}-${issue.message}-${index}`}
                                        type="button"
                                        className="deck-legality-issue deck-legality-issue-clickable"
                                        onClick={() => issue.cardName && handleSelectCardSubset([issue.cardName])}
                                        data-testid="deck-legality-issue"
                                        data-card-name={issue.cardName ?? undefined}
                                    >
                                        <strong>{issue.group}</strong>
                                        <span>{issue.message}</span>
                                    </button>
                                ))}
                                {activeCardIssues.length === 0 && activeDeckIssues.length > 0 && (
                                    <span
                                        className="deck-legality-muted"
                                        data-testid="deck-legality-no-card-issues"
                                    >
                                        Deck-level errors do not map to individual card rows.
                                    </span>
                                )}
                                {activeCardIssues.length > DETAIL_PREVIEW_LIMIT && (
                                    <button
                                        type="button"
                                        className="deck-legality-expand-button"
                                        onClick={() => setIsDetailExpanded(expanded => !expanded)}
                                        aria-expanded={isDetailExpanded}
                                        data-testid="deck-legality-expand-issues-button"
                                        data-hidden-count={activeCardIssues.length - DETAIL_PREVIEW_LIMIT}
                                    >
                                        {isDetailExpanded
                                            ? 'Show fewer issues'
                                            : `Show ${activeCardIssues.length - DETAIL_PREVIEW_LIMIT} more card issues`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <span className="deck-legality-muted">
                                {activeResult.format.shortName} has no current issues.
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="deck-legality-muted">
                        No legality result yet.
                    </span>
                )}
            </div>
        </section>
    );
};

export default DeckLegalityPanel;
