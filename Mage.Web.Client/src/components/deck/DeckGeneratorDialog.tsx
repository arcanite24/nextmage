import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    DEFAULT_DECK_GENERATOR_SETTINGS,
    type DeckGeneratorCmcProfile,
    type DeckGeneratorColorKey,
    type DeckGeneratorDeckSize,
    type DeckGeneratorSettings,
} from '../../services';
import { ManaSymbol } from '../common/ManaSymbols';
import './DeckGeneratorDialog.css';

interface DeckGeneratorDialogProps {
    initialSettings: DeckGeneratorSettings;
    busy?: boolean;
    error?: string | null;
    onCancel: () => void;
    onGenerate: (settings: DeckGeneratorSettings) => Promise<void> | void;
}

const COLOR_OPTIONS: Array<{ key: DeckGeneratorColorKey; symbol: string; label: string }> = [
    { key: 'white', symbol: 'W', label: 'White' },
    { key: 'blue', symbol: 'U', label: 'Blue' },
    { key: 'black', symbol: 'B', label: 'Black' },
    { key: 'red', symbol: 'R', label: 'Red' },
    { key: 'green', symbol: 'G', label: 'Green' },
];

const DECK_SIZES: DeckGeneratorDeckSize[] = [40, 60, 100];
const CMC_PROFILES: DeckGeneratorCmcProfile[] = ['Low', 'Default', 'High'];
const FORMAT_OPTIONS = [
    'Constructed - Standard',
    'Constructed - Pioneer',
    'Constructed - Modern',
    'Constructed - Pauper',
    'Constructed - Commander',
    'Legacy',
    'Vintage',
];

function normalizePercentage(value: number): number {
    return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

function totalDistribution(settings: DeckGeneratorSettings): number {
    return settings.creaturePercentage + settings.nonCreaturePercentage + settings.landPercentage;
}

export const DeckGeneratorDialog: React.FC<DeckGeneratorDialogProps> = ({
    initialSettings,
    busy = false,
    error,
    onCancel,
    onGenerate,
}) => {
    const [settings, setSettings] = useState<DeckGeneratorSettings>(() => ({
        ...initialSettings,
        colors: [...initialSettings.colors],
    }));
    const formatInputRef = useRef<HTMLInputElement | null>(null);
    const distributionTotal = useMemo(() => totalDistribution(settings), [settings]);

    const updateSettings = (patch: Partial<DeckGeneratorSettings>) => {
        setSettings(current => ({
            ...current,
            ...patch,
            colors: patch.colors ? [...patch.colors] : current.colors,
        }));
    };

    const toggleColor = (color: DeckGeneratorColorKey) => {
        setSettings(current => {
            const colors = current.colors.includes(color)
                ? current.colors.filter(item => item !== color)
                : [...current.colors, color];
            return {
                ...current,
                colors: colors.length > 0 ? colors : current.colors,
            };
        });
    };

    const handleCommanderChange = (commander: boolean) => {
        updateSettings({
            commander,
            singleton: commander ? true : settings.singleton,
        });
    };

    const handleReset = () => {
        setSettings({
            ...DEFAULT_DECK_GENERATOR_SETTINGS,
            colors: [...DEFAULT_DECK_GENERATOR_SETTINGS.colors],
        });
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

    useEffect(() => {
        formatInputRef.current?.focus();
        formatInputRef.current?.select();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || busy) return;
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [busy, onCancel]);

    return (
        <div className="deck-generator-overlay" role="presentation">
            <div
                className="deck-generator-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="deck-generator-title"
                onKeyDown={handleDialogKeyDown}
                data-testid="deck-generator-modal"
            >
                <div className="deck-generator-header">
                    <div>
                        <h3 id="deck-generator-title">Generate Deck</h3>
                    </div>
                    <strong>{settings.deckSize}</strong>
                </div>

                {error && (
                    <div className="deck-generator-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="deck-generator-section deck-generator-colors" aria-label="Deck colors">
                    {COLOR_OPTIONS.map(color => (
                        <button
                            key={color.key}
                            type="button"
                            className={`deck-generator-color ${settings.colors.includes(color.key) ? 'active' : ''}`}
                            onClick={() => toggleColor(color.key)}
                            aria-label={color.label}
                            title={color.label}
                        >
                            <ManaSymbol symbol={color.symbol} size="sm" />
                        </button>
                    ))}
                    <label className="deck-generator-check deck-generator-random-color">
                        <input
                            type="checkbox"
                            checked={settings.randomColor}
                            onChange={(event) => updateSettings({ randomColor: event.currentTarget.checked })}
                        />
                        <span>Random</span>
                    </label>
                </div>

                <div className="deck-generator-grid">
                    <label>
                        <span>Format or Set</span>
                        <input
                            ref={formatInputRef}
                            type="text"
                            value={settings.format}
                            onChange={(event) => updateSettings({ format: event.currentTarget.value })}
                            list="deck-generator-formats"
                            data-testid="deck-generator-format-input"
                        />
                        <datalist id="deck-generator-formats">
                            {FORMAT_OPTIONS.map(format => (
                                <option key={format} value={format} />
                            ))}
                        </datalist>
                    </label>
                    <div className="deck-generator-size-group">
                        <span>Deck Size</span>
                        <div className="deck-generator-segments">
                            {DECK_SIZES.map(size => (
                                <button
                                    key={size}
                                    type="button"
                                    className={settings.deckSize === size ? 'active' : ''}
                                    onClick={() => updateSettings({ deckSize: size })}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="deck-generator-toggles">
                    <label className="deck-generator-check">
                        <input
                            type="checkbox"
                            checked={settings.singleton}
                            onChange={(event) => updateSettings({ singleton: event.currentTarget.checked })}
                            disabled={settings.commander}
                        />
                        <span>Singleton</span>
                    </label>
                    <label className="deck-generator-check">
                        <input
                            type="checkbox"
                            checked={settings.commander}
                            onChange={(event) => handleCommanderChange(event.currentTarget.checked)}
                        />
                        <span>Commander</span>
                    </label>
                    <label className="deck-generator-check">
                        <input
                            type="checkbox"
                            checked={settings.includeArtifacts}
                            onChange={(event) => updateSettings({ includeArtifacts: event.currentTarget.checked })}
                        />
                        <span>Artifacts</span>
                    </label>
                    <label className="deck-generator-check">
                        <input
                            type="checkbox"
                            checked={settings.includeNonBasicLands}
                            onChange={(event) => updateSettings({ includeNonBasicLands: event.currentTarget.checked })}
                        />
                        <span>Non-basic Lands</span>
                    </label>
                    <label className="deck-generator-check">
                        <input
                            type="checkbox"
                            checked={settings.includeColorless}
                            onChange={(event) => updateSettings({ includeColorless: event.currentTarget.checked })}
                        />
                        <span>Colorless</span>
                    </label>
                </div>

                <label className="deck-generator-check deck-generator-advanced-toggle">
                    <input
                        type="checkbox"
                        checked={settings.advanced}
                        onChange={(event) => updateSettings({ advanced: event.currentTarget.checked })}
                    />
                    <span>Customize Distribution</span>
                </label>

                <fieldset className="deck-generator-advanced" disabled={!settings.advanced}>
                    <div className="deck-generator-grid">
                        <label>
                            <span>Average MV</span>
                            <select
                                value={settings.cmcProfile}
                                onChange={(event) => updateSettings({ cmcProfile: event.currentTarget.value as DeckGeneratorCmcProfile })}
                            >
                                {CMC_PROFILES.map(profile => (
                                    <option key={profile} value={profile}>{profile}</option>
                                ))}
                            </select>
                        </label>
                        <div className={`deck-generator-total ${distributionTotal === 100 ? 'balanced' : ''}`}>
                            <span>Total</span>
                            <strong>{distributionTotal}%</strong>
                        </div>
                    </div>
                    <label className="deck-generator-slider">
                        <span>Creatures {settings.creaturePercentage}%</span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={settings.creaturePercentage}
                            onChange={(event) => updateSettings({ creaturePercentage: normalizePercentage(Number(event.currentTarget.value)) })}
                        />
                    </label>
                    <label className="deck-generator-slider">
                        <span>Non-creatures {settings.nonCreaturePercentage}%</span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={settings.nonCreaturePercentage}
                            onChange={(event) => updateSettings({ nonCreaturePercentage: normalizePercentage(Number(event.currentTarget.value)) })}
                        />
                    </label>
                    <label className="deck-generator-slider">
                        <span>Lands {settings.landPercentage}%</span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={settings.landPercentage}
                            onChange={(event) => updateSettings({ landPercentage: normalizePercentage(Number(event.currentTarget.value)) })}
                        />
                    </label>
                </fieldset>

                <div className="deck-generator-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={busy}>
                        Reset
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void onGenerate(settings)}
                        disabled={busy}
                        data-testid="deck-generator-submit-button"
                    >
                        {busy ? 'Generating' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeckGeneratorDialog;
