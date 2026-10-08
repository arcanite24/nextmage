import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BASIC_LANDS,
    createEmptyBasicLandCounts,
    defaultAddLandsDeckSize,
    type AddBasicLandsOptions,
    type BasicLandCounts,
    type BasicLandKey,
    type BasicLandSetOption,
    type DeckCardZone,
} from '../../services';
import type { DeckCardLists } from '../../types';
import './DeckAddLandsDialog.css';

interface DeckAddLandsDialogProps {
    deck: DeckCardLists | null;
    busy?: boolean;
    error?: string | null;
    allowSnowBasics?: boolean;
    allowedZones?: DeckCardZone[];
    initialDeckSize?: number;
    contextLabel?: string;
    onCancel: () => void;
    onSuggest: (deckSize: number) => Promise<BasicLandCounts>;
    onLoadSetOptions?: () => Promise<BasicLandSetOption[]>;
    onAdd: (counts: BasicLandCounts, zone: DeckCardZone, options: AddBasicLandsOptions) => Promise<void> | void;
}

const DEFAULT_ALLOWED_ZONES: DeckCardZone[] = ['main', 'side'];

function totalLands(counts: BasicLandCounts): number {
    return BASIC_LANDS.reduce((sum, land) => sum + counts[land.key], 0);
}

function normalizeCount(value: number): number {
    return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export const DeckAddLandsDialog: React.FC<DeckAddLandsDialogProps> = ({
    deck,
    busy = false,
    error,
    allowSnowBasics = true,
    allowedZones = DEFAULT_ALLOWED_ZONES,
    initialDeckSize,
    contextLabel = 'current deck list',
    onCancel,
    onSuggest,
    onLoadSetOptions,
    onAdd,
}) => {
    const [counts, setCounts] = useState<BasicLandCounts>(() => createEmptyBasicLandCounts());
    const [deckSize, setDeckSize] = useState(() => initialDeckSize ?? defaultAddLandsDeckSize(deck));
    const [zone, setZone] = useState<DeckCardZone>(() => allowedZones[0] ?? 'main');
    const [setCode, setSetCode] = useState('');
    const [setSearch, setSetSearch] = useState('');
    const [setOptions, setSetOptions] = useState<BasicLandSetOption[]>([]);
    const [isLoadingSetOptions, setIsLoadingSetOptions] = useState(false);
    const [setOptionsError, setSetOptionsError] = useState<string | null>(null);
    const [fullArtOnly, setFullArtOnly] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [countSource, setCountSource] = useState<'manual' | 'suggested'>('manual');
    const targetInputRef = useRef<HTMLInputElement | null>(null);
    const total = useMemo(() => totalLands(counts), [counts]);
    const normalizedSetCode = setCode.trim().toUpperCase();
    const selectedSetOption = useMemo(() => {
        if (!normalizedSetCode) return null;
        return setOptions.find(option => option.setCode === normalizedSetCode) ?? null;
    }, [normalizedSetCode, setOptions]);
    const destinationLabel = zone === 'main' ? 'Main deck' : 'Sideboard';
    const zonePolicyLabel = allowedZones.length === 1 ? `${destinationLabel} only` : 'Main or sideboard';
    const printingLabel = normalizedSetCode
        ? selectedSetOption?.label ?? normalizedSetCode
        : 'Any set';
    const submitState = total > 0 ? 'ready' : 'blocked';
    const rulesSummary = [
        `Add Lands rules: target ${deckSize}`,
        `${total} selected`,
        zonePolicyLabel,
        printingLabel,
        fullArtOnly ? 'full-art only' : 'any art',
        allowSnowBasics ? 'snow basics allowed' : 'no snow basics',
        countSource === 'suggested' ? 'suggested counts' : 'manual counts',
        submitState === 'ready' ? 'ready to add' : 'choose at least one land',
    ].join(', ');
    const filteredSetOptions = useMemo(() => {
        const query = setSearch.trim().toLowerCase();
        const matchingOptions = query
            ? setOptions.filter(option => (
                option.setCode.toLowerCase().includes(query)
                || option.label.toLowerCase().includes(query)
                || option.landNames.some(name => name.toLowerCase().includes(query))
            ))
            : setOptions;
        return matchingOptions.slice(0, 10);
    }, [setOptions, setSearch]);

    useEffect(() => {
        setDeckSize(initialDeckSize ?? defaultAddLandsDeckSize(deck));
        setCounts(createEmptyBasicLandCounts());
        setZone(allowedZones[0] ?? 'main');
        setSetCode('');
        setSetSearch('');
        setFullArtOnly(false);
        setCountSource('manual');
    }, [allowedZones, deck, initialDeckSize]);

    useEffect(() => {
        if (!allowedZones.includes(zone)) {
            setZone(allowedZones[0] ?? 'main');
        }
    }, [allowedZones, zone]);

    useEffect(() => {
        targetInputRef.current?.focus();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || busy) return;
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        };

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [busy, onCancel]);

    useEffect(() => {
        let isActive = true;
        if (!onLoadSetOptions) return undefined;

        setIsLoadingSetOptions(true);
        setSetOptionsError(null);
        onLoadSetOptions()
            .then(options => {
                if (!isActive) return;
                setSetOptions(options);
            })
            .catch(error => {
                if (!isActive) return;
                console.error('Failed to load basic land set options:', error);
                setSetOptions([]);
                setSetOptionsError(error instanceof Error ? error.message : 'Unable to load set options.');
            })
            .finally(() => {
                if (isActive) setIsLoadingSetOptions(false);
            });

        return () => {
            isActive = false;
        };
    }, [deck, onLoadSetOptions]);

    const updateCount = (key: BasicLandKey, amount: number) => {
        setCountSource('manual');
        setCounts(current => ({
            ...current,
            [key]: normalizeCount(amount),
        }));
    };

    const handleSuggest = async () => {
        setIsSuggesting(true);
        try {
            setCounts(await onSuggest(deckSize));
            setCountSource('suggested');
        } finally {
            setIsSuggesting(false);
        }
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
        <div className="deck-add-lands-overlay" role="presentation">
            <div
                className="deck-add-lands-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="deck-add-lands-title"
                onKeyDown={handleDialogKeyDown}
                data-testid="deck-add-lands-modal"
            >
                <div className="deck-add-lands-header">
                    <div>
                        <h3 id="deck-add-lands-title">Add Lands</h3>
                        <p>Add basic lands to the {contextLabel}.</p>
                    </div>
                    <strong>{total}</strong>
                </div>

                {error && (
                    <div className="deck-add-lands-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="deck-add-lands-controls">
                    <label>
                        <span>Target</span>
                        <input
                            ref={targetInputRef}
                            type="number"
                            min={0}
                            max={999}
                            value={deckSize}
                            onChange={(event) => setDeckSize(normalizeCount(Number(event.currentTarget.value)))}
                            data-testid="deck-add-lands-target-input"
                        />
                    </label>
                    <label>
                        <span>Destination</span>
                        <select
                            value={zone}
                            onChange={(event) => setZone(event.currentTarget.value as DeckCardZone)}
                            disabled={allowedZones.length <= 1}
                            data-testid="deck-add-lands-zone-select"
                        >
                            {allowedZones.includes('main') && <option value="main">Main deck</option>}
                            {allowedZones.includes('side') && <option value="side">Sideboard</option>}
                        </select>
                    </label>
                    <button
                        type="button"
                        className="btn btn-secondary deck-add-lands-suggest"
                        onClick={() => void handleSuggest()}
                        disabled={busy || isSuggesting}
                        data-testid="deck-add-lands-suggest-button"
                    >
                        {isSuggesting ? 'Suggesting' : 'Suggest'}
                    </button>
                </div>

                <div className="deck-add-lands-printing-controls">
                    <label>
                        <span>Set</span>
                        <input
                            type="text"
                            value={setCode}
                            onChange={(event) => setSetCode(event.currentTarget.value.toUpperCase())}
                            placeholder="Any"
                            maxLength={8}
                            list="deck-add-lands-set-options"
                            data-testid="deck-add-lands-set-input"
                        />
                        <datalist id="deck-add-lands-set-options">
                            {setOptions.map(option => (
                                <option key={option.setCode} value={option.setCode}>
                                    {option.label}
                                </option>
                            ))}
                        </datalist>
                    </label>
                    <label className="deck-add-lands-checkbox">
                        <input
                            type="checkbox"
                            checked={fullArtOnly}
                            onChange={(event) => setFullArtOnly(event.currentTarget.checked)}
                            data-testid="deck-add-lands-full-art-checkbox"
                        />
                        <span>Full-art only</span>
                    </label>
                </div>

                <div
                    className="deck-add-lands-rules"
                    aria-label={rulesSummary}
                    title={rulesSummary}
                    data-testid="deck-add-lands-rules"
                    data-target-size={deckSize}
                    data-total-added={total}
                    data-submit-state={submitState}
                    data-destination={zone}
                    data-zone-policy={allowedZones.length === 1 ? 'single-zone' : 'multi-zone'}
                    data-set-code={normalizedSetCode}
                    data-set-label={printingLabel}
                    data-full-art-only={fullArtOnly ? 'true' : 'false'}
                    data-snow-allowed={allowSnowBasics ? 'true' : 'false'}
                    data-count-source={countSource}
                >
                    <span data-testid="deck-add-lands-rule-target">Target {deckSize}</span>
                    <span data-testid="deck-add-lands-rule-destination">{zonePolicyLabel}</span>
                    <span data-testid="deck-add-lands-rule-printing">{printingLabel}</span>
                    <span data-testid="deck-add-lands-rule-art">{fullArtOnly ? 'Full-art only' : 'Any art'}</span>
                    <span data-testid="deck-add-lands-rule-snow">{allowSnowBasics ? 'Snow allowed' : 'No snow basics'}</span>
                    <span data-testid="deck-add-lands-rule-source">{countSource === 'suggested' ? 'Suggested' : 'Manual'}</span>
                    <strong data-testid="deck-add-lands-rule-total">{total} selected</strong>
                </div>

                <div className="deck-add-lands-set-picker" data-testid="deck-add-lands-set-picker">
                    <label>
                        <span>Find Set</span>
                        <input
                            type="search"
                            value={setSearch}
                            onChange={(event) => setSetSearch(event.currentTarget.value)}
                            placeholder={isLoadingSetOptions ? 'Loading' : 'Search'}
                            data-testid="deck-add-lands-set-search-input"
                        />
                    </label>
                    <div className="deck-add-lands-set-options" aria-label="Basic land set options">
                        <button
                            type="button"
                            className={!setCode.trim() ? 'active' : ''}
                            onClick={() => setSetCode('')}
                            data-testid="deck-add-lands-set-option-any"
                            data-selected={!setCode.trim() ? 'true' : 'false'}
                        >
                            Any
                        </button>
                        {filteredSetOptions.map(option => (
                            <button
                                type="button"
                                key={option.setCode}
                                className={setCode.trim().toUpperCase() === option.setCode ? 'active' : ''}
                                onClick={() => setSetCode(option.setCode)}
                                data-testid="deck-add-lands-set-option"
                                data-set-code={option.setCode}
                                data-selected={setCode.trim().toUpperCase() === option.setCode ? 'true' : 'false'}
                                data-land-count={option.landNames.length}
                                data-is-deck-set={option.isDeckSet ? 'true' : 'false'}
                                data-has-full-art={option.hasFullArtPrintings ? 'true' : 'false'}
                                data-has-snow-basics={option.hasSnowBasics ? 'true' : 'false'}
                            >
                                <strong>{option.setCode}</strong>
                                <span>{option.landNames.length}/5</span>
                                {option.isDeckSet && <em>Deck</em>}
                                {option.hasFullArtPrintings && <em>Full</em>}
                                {option.hasSnowBasics && <em>Snow</em>}
                            </button>
                        ))}
                        {!isLoadingSetOptions && filteredSetOptions.length === 0 && (
                            <span className="deck-add-lands-set-empty" role="status">
                                {setOptionsError ?? 'No sets'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="deck-add-lands-list">
                    {BASIC_LANDS.map(land => (
                        <div
                            className="deck-add-lands-row"
                            key={land.key}
                            data-testid="deck-add-lands-row"
                            data-land-key={land.key}
                            data-land-count={counts[land.key]}
                            data-land-selected={counts[land.key] > 0 ? 'true' : 'false'}
                        >
                            <span className={`deck-add-lands-pip deck-add-lands-pip-${land.pipClass}`}>
                                {land.symbol}
                            </span>
                            <label>
                                <span>{land.label}</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={999}
                                    value={counts[land.key]}
                                    onChange={(event) => updateCount(land.key, Number(event.currentTarget.value))}
                                    onFocus={(event) => event.currentTarget.select()}
                                    data-testid="deck-add-lands-count-input"
                                    aria-label={`${land.label} count`}
                                />
                            </label>
                            <div className="deck-add-lands-steppers">
                                <button
                                    type="button"
                                    onClick={() => updateCount(land.key, counts[land.key] - 1)}
                                    disabled={busy || counts[land.key] <= 0}
                                    aria-label={`Remove one ${land.label}`}
                                    data-testid="deck-add-lands-decrement-button"
                                    data-land-key={land.key}
                                >
                                    -
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateCount(land.key, counts[land.key] + 1)}
                                    disabled={busy}
                                    aria-label={`Add one ${land.label}`}
                                    data-testid="deck-add-lands-increment-button"
                                    data-land-key={land.key}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="deck-add-lands-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={busy}
                        data-testid="deck-add-lands-cancel-button"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void onAdd(counts, zone, { setCode, fullArtOnly, allowSnowBasics })}
                        disabled={busy || total === 0}
                        data-testid="deck-add-lands-submit-button"
                    >
                        Add Lands
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeckAddLandsDialog;
