import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    deckAnalyticsService,
    type DeckAnalyticsColorKey,
    type DeckAnalyticsLandSourceKey,
    type DeckAnalyticsManaSymbolKey,
    type DeckAnalyticsReport,
} from '../../services';
import type { DeckCardLists } from '../../types';
import './DeckAnalyticsPanel.css';

interface DeckAnalyticsPanelProps {
    deck: DeckCardLists | null;
    onSelectCardNames?: (cardNames: string[]) => void;
}

interface ActiveAnalyticsDetail {
    label: string;
    count: number;
    countUnit: string;
    cardNames: string[];
}

interface AnalyticsCardCount {
    main: number;
    sideboard: number;
    total: number;
}

const COLOR_SHORT_LABELS: Record<DeckAnalyticsColorKey, string> = {
    white: 'W',
    blue: 'U',
    black: 'B',
    red: 'R',
    green: 'G',
    colorless: 'C',
};

const LAND_SHORT_LABELS: Record<DeckAnalyticsLandSourceKey, string> = {
    plains: 'Pl',
    island: 'Is',
    swamp: 'Sw',
    mountain: 'Mt',
    forest: 'Fo',
    wastes: 'Wa',
};

const MANA_DETAIL_ROWS: Array<{
    key: 'manaPips' | 'landSources' | 'manaSources';
    label: string;
    desktopLabel: string;
    testId: string;
}> = [
    { key: 'manaPips', label: 'Casting Costs', desktopLabel: 'Casting Costs found', testId: 'deck-analytics-mana-pips' },
    { key: 'landSources', label: 'Basic Lands', desktopLabel: 'Basic Land types found', testId: 'deck-analytics-land-sources' },
    { key: 'manaSources', label: 'Mana Sources', desktopLabel: 'Mana sources found', testId: 'deck-analytics-mana-sources' },
];

const MANA_DISTRIBUTION_DESKTOP_LABEL = 'Mana distribution';

function metadataStatusLabel(report: DeckAnalyticsReport | null, isChecking: boolean): string {
    if (isChecking && !report) return 'Checking';
    switch (report?.metadataStatus) {
        case 'complete':
            return 'Ready';
        case 'partial':
            return 'Partial';
        case 'unavailable':
            return 'Counts only';
        case 'empty':
        default:
            return 'Empty';
    }
}

function formatAverageManaValue(value: number | null): string {
    return value === null ? '--' : value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatSideboardTarget(report: DeckAnalyticsReport | null): string {
    if (!report) return '15';
    return report.formatTarget.maxSideboard >= Number.MAX_SAFE_INTEGER ? 'any' : String(report.formatTarget.maxSideboard);
}

function formatMainRequirement(report: DeckAnalyticsReport | null): string {
    if (!report) return 'Needs 60';
    return report.formatTarget.remainingMain > 0
        ? `Needs ${report.formatTarget.remainingMain}`
        : 'Complete';
}

function formatSideboardRequirement(report: DeckAnalyticsReport | null): string {
    if (!report) return 'Within 15';
    if (report.formatTarget.maxSideboard >= Number.MAX_SAFE_INTEGER) return 'Unlimited';
    return report.formatTarget.sideboardOver > 0
        ? `Over ${report.formatTarget.sideboardOver}`
        : `Within ${report.formatTarget.maxSideboard}`;
}

function formatRequirementSummary(report: DeckAnalyticsReport | null): string {
    const formatName = report?.formatTarget.shortName ?? 'Standard';
    return `${formatName} requirements: ${formatMainRequirement(report)}, ${formatSideboardRequirement(report)}`;
}

function mainRequirementState(report: DeckAnalyticsReport | null): 'complete' | 'incomplete' {
    return report && report.formatTarget.remainingMain === 0 ? 'complete' : 'incomplete';
}

function sideboardRequirementState(report: DeckAnalyticsReport | null): 'within' | 'over' | 'unlimited' {
    if (report?.formatTarget.maxSideboard === Number.MAX_SAFE_INTEGER) return 'unlimited';
    return report && report.formatTarget.sideboardOver > 0 ? 'over' : 'within';
}

function manaBucketLabel(bucketKey: DeckAnalyticsManaSymbolKey | DeckAnalyticsLandSourceKey): string {
    return COLOR_SHORT_LABELS[bucketKey as DeckAnalyticsManaSymbolKey] ?? LAND_SHORT_LABELS[bucketKey as DeckAnalyticsLandSourceKey];
}

function distributionBucketTestId(bucketKey: string): string {
    return bucketKey.replace('+', 'plus');
}

function normalizeCardName(cardName: string | null | undefined): string {
    return (cardName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildDeckCardCounts(deck: DeckCardLists | null): Map<string, AnalyticsCardCount> {
    const counts = new Map<string, AnalyticsCardCount>();

    const addCards = (cards: DeckCardLists['cards'], zone: 'main' | 'sideboard') => {
        for (const card of cards) {
            const key = normalizeCardName(card.cardName);
            if (!key) continue;

            const current = counts.get(key) ?? { main: 0, sideboard: 0, total: 0 };
            current[zone] += card.amount;
            current.total += card.amount;
            counts.set(key, current);
        }
    };

    addCards(deck?.cards ?? [], 'main');
    addCards(deck?.sideboard ?? [], 'sideboard');
    return counts;
}

export const DeckAnalyticsPanel: React.FC<DeckAnalyticsPanelProps> = ({ deck, onSelectCardNames }) => {
    const [report, setReport] = useState<DeckAnalyticsReport | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [activeDetail, setActiveDetail] = useState<ActiveAnalyticsDetail | null>(null);
    const activeDetailTriggerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsChecking(Boolean(deck));
        setActiveDetail(null);

        deckAnalyticsService.analyzeDeck(deck).then((nextReport) => {
            if (cancelled) return;
            setReport(nextReport);
            setIsChecking(false);
        }).catch((error) => {
            if (cancelled) return;
            console.error('Failed to analyze deck:', error);
            setReport(null);
            setIsChecking(false);
        });

        return () => {
            cancelled = true;
        };
    }, [deck]);

    const visibleTypeCounts = useMemo(() => (
        report?.typeCounts.filter(bucket => bucket.count > 0) ?? []
    ), [report]);
    const visibleManaDistribution = useMemo(() => (
        report?.manaDistribution.filter(bucket => bucket.total > 0) ?? []
    ), [report]);
    const unresolvedCardNames = report?.unresolvedCardNames ?? [];
    const activeDetailPreview = activeDetail?.cardNames.slice(0, 8) ?? [];
    const activeDetailOverflow = Math.max(0, (activeDetail?.cardNames.length ?? 0) - activeDetailPreview.length);
    const deckCardCounts = useMemo(() => buildDeckCardCounts(deck), [deck]);
    const activeDetailZoneCounts = useMemo(() => {
        return (activeDetail?.cardNames ?? []).reduce((totals, cardName) => {
            const counts = deckCardCounts.get(normalizeCardName(cardName));
            if (!counts) return totals;

            totals.main += counts.main;
            totals.sideboard += counts.sideboard;
            totals.total += counts.total;
            return totals;
        }, { main: 0, sideboard: 0, total: 0 });
    }, [activeDetail?.cardNames, deckCardCounts]);

    const maxCurveCount = Math.max(1, ...(report?.manaCurve.map(bucket => bucket.count) ?? [0]));
    const maxDistributionPips = Math.max(1, ...(visibleManaDistribution.map(bucket => bucket.total)));
    const mainStatusClass = report && report.formatTarget.remainingMain === 0 ? 'deck-analytics-stat-ready' : 'deck-analytics-stat-warning';
    const sideStatusClass = report && report.formatTarget.sideboardOver === 0 ? 'deck-analytics-stat-ready' : 'deck-analytics-stat-warning';
    const isActiveDetailLabel = (label: string): boolean => activeDetail?.label === label;
    const restoreActiveDetailFocus = () => {
        const trigger = activeDetailTriggerRef.current;
        if (trigger?.isConnected && !trigger.matches(':disabled')) {
            trigger.focus();
        }
    };
    const handleSelectDetail = (detail: ActiveAnalyticsDetail, trigger?: HTMLElement | null) => {
        activeDetailTriggerRef.current = trigger ?? (
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        );
        setActiveDetail(detail);
        onSelectCardNames?.(detail.cardNames);
    };
    const handleToggleDetail = (detail: ActiveAnalyticsDetail, trigger?: HTMLElement | null) => {
        if (isActiveDetailLabel(detail.label)) {
            activeDetailTriggerRef.current = trigger ?? (
                document.activeElement instanceof HTMLElement ? document.activeElement : null
            );
            setActiveDetail(null);
            onSelectCardNames?.([]);
            return;
        }

        handleSelectDetail(detail, trigger);
    };
    const handleSelectMissingMetadata = (trigger?: HTMLElement | null) => {
        handleToggleDetail({
            label: 'Missing metadata',
            count: unresolvedCardNames.length,
            countUnit: 'cards',
            cardNames: unresolvedCardNames,
        }, trigger);
    };
    const handleSelectDetailCard = (cardName: string) => {
        onSelectCardNames?.([cardName]);
    };
    const handleMissingMetadataKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleSelectMissingMetadata(event.currentTarget);
    };
    const handleDetailCardKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, cardName: string) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleSelectDetailCard(cardName);
    };
    const handleClearDetail = () => {
        setActiveDetail(null);
        onSelectCardNames?.([]);
        restoreActiveDetailFocus();
    };
    const handleActiveDetailKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Escape') return;

        event.preventDefault();
        handleClearDetail();
    };

    return (
        <section className="deck-analytics-panel" aria-label="Deck analytics" data-testid="deck-analytics-panel">
            <div className="deck-analytics-header">
                <div>
                    <h3>Analytics</h3>
                    <span>{report?.formatTarget.shortName ?? 'Standard'}</span>
                </div>
                <strong
                    className={`deck-analytics-status deck-analytics-status-${report?.metadataStatus ?? 'empty'}`}
                    data-testid="deck-analytics-status"
                >
                    {metadataStatusLabel(report, isChecking)}
                </strong>
            </div>

            {unresolvedCardNames.length > 0 && (
                <button
                    type="button"
                    className="deck-analytics-metadata-detail"
                    title={unresolvedCardNames.join(', ')}
                    aria-label={`Missing metadata: ${unresolvedCardNames.length}`}
                    aria-pressed={isActiveDetailLabel('Missing metadata')}
                    onClick={(event) => handleSelectMissingMetadata(event.currentTarget)}
                    onKeyDown={handleMissingMetadataKeyDown}
                    disabled={!onSelectCardNames}
                    data-active={isActiveDetailLabel('Missing metadata') || undefined}
                    data-unresolved-count={unresolvedCardNames.length}
                    data-testid="deck-analytics-metadata-detail"
                >
                    <span>Missing metadata</span>
                    <strong data-testid="deck-analytics-unresolved-count">{unresolvedCardNames.length}</strong>
                    <em data-testid="deck-analytics-unresolved-names">{unresolvedCardNames.join(', ')}</em>
                </button>
            )}

            <div className="deck-analytics-summary">
                <div className={`deck-analytics-stat ${mainStatusClass}`} data-testid="deck-analytics-stat-main">
                    <span>Main</span>
                    <strong>{report?.totals.mainCount ?? 0}/{report?.formatTarget.minMain ?? 60}</strong>
                </div>
                <div className={`deck-analytics-stat ${sideStatusClass}`} data-testid="deck-analytics-stat-side">
                    <span>Side</span>
                    <strong>{report?.totals.sideboardCount ?? 0}/{formatSideboardTarget(report)}</strong>
                </div>
                <div className="deck-analytics-stat" data-testid="deck-analytics-stat-total">
                    <span>Total</span>
                    <strong>{report?.totals.totalCount ?? 0}</strong>
                </div>
                <div className="deck-analytics-stat" data-testid="deck-analytics-stat-unique">
                    <span>Unique</span>
                    <strong>{report?.totals.uniqueTotalCount ?? 0}</strong>
                </div>
                <div className="deck-analytics-stat" data-testid="deck-analytics-stat-nonland">
                    <span>Nonland</span>
                    <strong>{report?.nonLandCount ?? 0}</strong>
                </div>
                <div className="deck-analytics-stat" data-testid="deck-analytics-stat-average-mana">
                    <span>Avg MV</span>
                    <strong>{formatAverageManaValue(report?.averageManaValue ?? null)}</strong>
                </div>
            </div>

            <div
                className="deck-analytics-requirements"
                aria-label={formatRequirementSummary(report)}
                title={formatRequirementSummary(report)}
                data-testid="deck-analytics-format-requirements"
                data-format={report?.formatTarget.shortName ?? 'Standard'}
                data-main-state={mainRequirementState(report)}
                data-sideboard-state={sideboardRequirementState(report)}
                data-main-remaining={report?.formatTarget.remainingMain ?? 60}
                data-sideboard-over={report?.formatTarget.sideboardOver ?? 0}
                data-sideboard-target={formatSideboardTarget(report)}
            >
                <span data-testid="deck-analytics-format-requirement-format">
                    {report?.formatTarget.shortName ?? 'Standard'}
                </span>
                <strong
                    className={mainStatusClass}
                    data-testid="deck-analytics-format-requirement-main"
                >
                    {formatMainRequirement(report)}
                </strong>
                <strong
                    className={sideStatusClass}
                    data-testid="deck-analytics-format-requirement-side"
                >
                    {formatSideboardRequirement(report)}
                </strong>
            </div>

            <div className="deck-analytics-colors" aria-label="Color distribution">
                {(report?.colors ?? []).map(bucket => (
                    <button
                        key={bucket.key}
                        type="button"
                        className={`deck-analytics-color deck-analytics-color-${bucket.key}`}
                        title={`Select ${bucket.label.toLowerCase()} cards in deck`}
                        aria-label={`${bucket.label}: ${bucket.count}`}
                        aria-pressed={isActiveDetailLabel(`${bucket.label} cards`)}
                        onClick={(event) => handleToggleDetail({
                            label: `${bucket.label} cards`,
                            count: bucket.count,
                            countUnit: 'cards',
                            cardNames: bucket.cardNames,
                        }, event.currentTarget)}
                        disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                        data-active={isActiveDetailLabel(`${bucket.label} cards`) || undefined}
                        data-empty={bucket.count === 0 || undefined}
                        data-testid={`deck-analytics-color-${bucket.key}`}
                    >
                        <span>{COLOR_SHORT_LABELS[bucket.key]}</span>
                        <strong>{bucket.count}</strong>
                    </button>
                ))}
            </div>

            <div className="deck-analytics-curve" aria-label="Mana curve">
                {(report?.manaCurve ?? []).map(bucket => (
                    <button
                        key={bucket.key}
                        type="button"
                        className="deck-analytics-curve-bucket"
                        title={`Mana value ${bucket.label}: ${bucket.count}`}
                        aria-pressed={isActiveDetailLabel(`Mana value ${bucket.label}`)}
                        onClick={(event) => handleToggleDetail({
                            label: `Mana value ${bucket.label}`,
                            count: bucket.count,
                            countUnit: 'cards',
                            cardNames: bucket.cardNames,
                        }, event.currentTarget)}
                        disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                        data-active={isActiveDetailLabel(`Mana value ${bucket.label}`) || undefined}
                        data-testid={`deck-analytics-curve-${bucket.key.replace('+', 'plus')}`}
                    >
                        <div className="deck-analytics-curve-track">
                            <span
                                style={{ height: `${Math.max(5, Math.round((bucket.count / maxCurveCount) * 100))}%` }}
                                data-testid="deck-analytics-curve-bar"
                            />
                        </div>
                        <strong>{bucket.label}</strong>
                    </button>
                ))}
            </div>

            <div className="deck-analytics-mana-details" aria-label="Mana analyzer" data-testid="deck-analytics-mana-details">
                {MANA_DETAIL_ROWS.map(row => (
                    <div
                        key={row.key}
                        className="deck-analytics-mana-row"
                        aria-label={row.desktopLabel}
                        title={row.desktopLabel}
                        data-desktop-label={row.desktopLabel}
                        data-testid={row.testId}
                    >
                        <span className="deck-analytics-mana-row-label">{row.label}</span>
                        <div>
                            {((report?.[row.key] ?? []) as Array<{ key: DeckAnalyticsManaSymbolKey | DeckAnalyticsLandSourceKey; label: string; count: number; cardNames: string[] }>).map(bucket => (
                                <button
                                    key={bucket.key}
                                    type="button"
                                    className={`deck-analytics-mana-chip deck-analytics-mana-chip-${bucket.key}`}
                                    title={`Select ${row.label.toLowerCase()} ${bucket.label.toLowerCase()} cards in deck`}
                                    aria-label={`${row.label} ${bucket.label}: ${bucket.count}`}
                                    aria-pressed={isActiveDetailLabel(`${row.label} ${bucket.label}`)}
                                    onClick={(event) => handleToggleDetail({
                                        label: `${row.label} ${bucket.label}`,
                                        count: bucket.count,
                                        countUnit: row.key === 'manaPips' ? 'pips' : 'sources',
                                        cardNames: bucket.cardNames,
                                    }, event.currentTarget)}
                                    disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                                    data-active={isActiveDetailLabel(`${row.label} ${bucket.label}`) || undefined}
                                    data-empty={bucket.count === 0 || undefined}
                                    data-testid={`deck-analytics-${row.key === 'landSources' ? 'land-source' : row.key === 'manaSources' ? 'mana-source' : 'mana-pip'}-${bucket.key}`}
                                >
                                    {manaBucketLabel(bucket.key)}
                                    <strong>{bucket.count}</strong>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div
                className="deck-analytics-mana-distribution"
                aria-label={MANA_DISTRIBUTION_DESKTOP_LABEL}
                title={MANA_DISTRIBUTION_DESKTOP_LABEL}
                data-desktop-label={MANA_DISTRIBUTION_DESKTOP_LABEL}
                data-testid="deck-analytics-mana-distribution"
            >
                <span className="deck-analytics-mana-row-label">Distribution</span>
                <div>
                    {visibleManaDistribution.length > 0 ? visibleManaDistribution.map(bucket => (
                        <div
                            key={bucket.key}
                            className="deck-analytics-distribution-bucket"
                            title={`Select mana value ${bucket.label} cards in deck`}
                            data-testid={`deck-analytics-mana-distribution-${distributionBucketTestId(bucket.key)}`}
                        >
                            <button
                                type="button"
                                className="deck-analytics-distribution-summary"
                                aria-label={`Mana value ${bucket.label} pips: ${bucket.total}`}
                                aria-pressed={isActiveDetailLabel(`Mana value ${bucket.label} spread`)}
                                onClick={(event) => handleToggleDetail({
                                    label: `Mana value ${bucket.label} spread`,
                                    count: bucket.total,
                                    countUnit: 'pips',
                                    cardNames: bucket.cardNames,
                                }, event.currentTarget)}
                                disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                                data-active={isActiveDetailLabel(`Mana value ${bucket.label} spread`) || undefined}
                                data-testid={`deck-analytics-mana-distribution-${distributionBucketTestId(bucket.key)}-summary`}
                            >
                                {bucket.label}
                            </button>
                            <span
                                className="deck-analytics-distribution-bar"
                                style={{ width: `${Math.max(8, Math.round((bucket.total / maxDistributionPips) * 100))}%` }}
                            >
                                {bucket.pips.filter(pip => pip.count > 0).map(pip => (
                                    <button
                                        key={pip.key}
                                        type="button"
                                        className={`deck-analytics-distribution-segment deck-analytics-distribution-segment-${pip.key}`}
                                        style={{ flexGrow: pip.count }}
                                        title={`${bucket.label} ${pip.label}: ${pip.count}`}
                                        aria-label={`Mana value ${bucket.label} ${pip.label}: ${pip.count}`}
                                        aria-pressed={isActiveDetailLabel(`Mana value ${bucket.label} ${pip.label} spread`)}
                                        onClick={(event) => handleToggleDetail({
                                            label: `Mana value ${bucket.label} ${pip.label} spread`,
                                            count: pip.count,
                                            countUnit: 'pips',
                                            cardNames: pip.cardNames,
                                        }, event.currentTarget)}
                                        disabled={!onSelectCardNames || pip.cardNames.length === 0}
                                        data-active={isActiveDetailLabel(`Mana value ${bucket.label} ${pip.label} spread`) || undefined}
                                        data-testid={`deck-analytics-mana-distribution-${distributionBucketTestId(bucket.key)}-${pip.key}`}
                                    />
                                ))}
                            </span>
                            <button
                                type="button"
                                className="deck-analytics-distribution-total"
                                aria-label={`Select all mana value ${bucket.label} cards`}
                                aria-pressed={isActiveDetailLabel(`Mana value ${bucket.label} spread`)}
                                onClick={(event) => handleToggleDetail({
                                    label: `Mana value ${bucket.label} spread`,
                                    count: bucket.total,
                                    countUnit: 'pips',
                                    cardNames: bucket.cardNames,
                                }, event.currentTarget)}
                                disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                                data-active={isActiveDetailLabel(`Mana value ${bucket.label} spread`) || undefined}
                            >
                                {bucket.total}
                            </button>
                        </div>
                    )) : (
                        <span className="deck-analytics-muted">No mana pips</span>
                    )}
                </div>
            </div>

            {activeDetail && (
                <div
                    className="deck-analytics-active-detail"
                    tabIndex={0}
                    aria-label={`${activeDetail.label} analytics detail: ${activeDetail.count} ${activeDetail.countUnit}, Main ${activeDetailZoneCounts.main}, Side ${activeDetailZoneCounts.sideboard}, Total ${activeDetailZoneCounts.total}. Press Escape to clear.`}
                    onKeyDown={handleActiveDetailKeyDown}
                    data-testid="deck-analytics-active-detail"
                    data-main-count={activeDetailZoneCounts.main}
                    data-sideboard-count={activeDetailZoneCounts.sideboard}
                    data-total-count={activeDetailZoneCounts.total}
                    data-count-unit={activeDetail.countUnit}
                >
                    <div className="deck-analytics-active-detail-summary">
                        <strong data-testid="deck-analytics-active-detail-title">{activeDetail.label}</strong>
                        <span data-testid="deck-analytics-active-detail-count">{activeDetail.count}</span>
                        <span data-testid="deck-analytics-active-detail-count-unit">{activeDetail.countUnit}</span>
                        <span data-testid="deck-analytics-active-detail-main-count">Main {activeDetailZoneCounts.main}</span>
                        <span data-testid="deck-analytics-active-detail-sideboard-count">Side {activeDetailZoneCounts.sideboard}</span>
                        <span data-testid="deck-analytics-active-detail-total-count">Total {activeDetailZoneCounts.total}</span>
                    </div>
                    <div className="deck-analytics-active-detail-preview">
                        <p title={activeDetail.cardNames.join(', ')} data-testid="deck-analytics-active-detail-names">
                            {activeDetailPreview.join(', ')}
                            {activeDetailOverflow > 0 ? `, +${activeDetailOverflow} more` : ''}
                        </p>
                        <div
                            className="deck-analytics-active-detail-list"
                            aria-label={`${activeDetail.label} cards`}
                            data-testid="deck-analytics-active-detail-list"
                        >
                            {activeDetail.cardNames.map(cardName => (
                                (() => {
                                    const counts = deckCardCounts.get(normalizeCardName(cardName)) ?? { main: 0, sideboard: 0, total: 0 };
                                    return (
                                        <button
                                            key={cardName}
                                            type="button"
                                            onClick={() => handleSelectDetailCard(cardName)}
                                            onKeyDown={(event) => handleDetailCardKeyDown(event, cardName)}
                                            title={`Select ${cardName}: ${counts.main} main, ${counts.sideboard} sideboard`}
                                            data-card-name={cardName}
                                            data-main-count={counts.main}
                                            data-sideboard-count={counts.sideboard}
                                            data-total-count={counts.total}
                                            data-testid="deck-analytics-active-detail-card"
                                        >
                                            <span>{cardName}</span>
                                            <strong>{counts.total}</strong>
                                        </button>
                                    );
                                })()
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClearDetail}
                        aria-label="Clear analytics detail"
                        data-testid="deck-analytics-active-detail-clear"
                    >
                        Clear
                    </button>
                </div>
            )}

            <div className="deck-analytics-types" aria-label="Card type counts">
                {visibleTypeCounts.length > 0 ? visibleTypeCounts.map(bucket => (
                    <button
                        key={bucket.key}
                        type="button"
                        title={`Select ${bucket.label.toLowerCase()} in deck`}
                        aria-pressed={isActiveDetailLabel(bucket.label)}
                        onClick={(event) => handleToggleDetail({
                            label: bucket.label,
                            count: bucket.count,
                            countUnit: 'cards',
                            cardNames: bucket.cardNames,
                        }, event.currentTarget)}
                        disabled={!onSelectCardNames || bucket.cardNames.length === 0}
                        data-active={isActiveDetailLabel(bucket.label) || undefined}
                        data-testid={`deck-analytics-type-${bucket.key}`}
                    >
                        <strong>{bucket.count}</strong>
                        {bucket.label}
                    </button>
                )) : (
                    <span className="deck-analytics-muted">No card metadata</span>
                )}
            </div>
        </section>
    );
};

export default DeckAnalyticsPanel;
