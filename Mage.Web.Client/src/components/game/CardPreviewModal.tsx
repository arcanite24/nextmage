import React, { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CardView, PermanentView, StackAbilityView } from '../../types';
import { cardImageService } from '../../services/CardImageService';
import { getCardIconSummary } from '../../services/CardIconService';
import { hasCardType } from '../../services/BattlefieldLayoutService';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGameStore } from '../../stores';
import { ManaCost } from '../common/ManaSymbols';
import './CardPreviewModal.css';

interface CardPreviewModalProps {
    card: CardView | PermanentView;
    initialFace?: 'front' | 'back';
    onClose: () => void;
}

// Type guard to check if a card is an ability with sourceCard
const isStackAbility = (card: CardView): card is StackAbilityView => {
    return card.isAbility && 'sourceCard' in card && !!(card as StackAbilityView).sourceCard;
};

// Parse and render rich text with HTML tags (from server rules text)
const parseRulesText = (text: string, showReminderText = true): React.ReactNode => {
    if (!text) return null;

    // Replace common HTML entities and tags
    let processed = text
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&bull;/g, '•')
        .replace(/&middot;/g, '·')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    if (!showReminderText) {
        processed = stripReminderText(processed);
    }

    // Split by <br> tags for line breaks
    const lines = processed.split(/<br\s*\/?>/gi);

    return lines.map((line, i) => {
        // Process <i>italic</i> tags
        const parts: React.ReactNode[] = [];
        let key = 0;

        // Match <i>...</i> tags
        const italicRegex = /<i>(.*?)<\/i>/gi;
        let lastIndex = 0;
        let match;

        while ((match = italicRegex.exec(line)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
            }
            // Add italic text
            parts.push(<i key={key++}>{match[1]}</i>);
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < line.length) {
            parts.push(<span key={key++}>{line.slice(lastIndex)}</span>);
        }

        if (parts.length === 0) {
            return <p key={i} className="rules-line">{line}</p>;
        }

        return <p key={i} className="rules-line">{parts}</p>;
    });
};

const stripReminderText = (text: string): string => {
    return text
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const formatHintValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    if (typeof value === 'object') return Object.values(value as Record<string, unknown>).filter(Boolean).join(', ');
    return String(value);
};

const formatRarityLabel = (rarity: unknown): string => {
    return String(rarity || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getSetSymbolGlyph = (rarity: unknown): string => {
    switch (String(rarity || '').toUpperCase()) {
        case 'MYTHIC':
            return '◆';
        case 'RARE':
            return '◆';
        case 'UNCOMMON':
            return '◇';
        case 'SPECIAL':
        case 'BONUS':
            return '✦';
        case 'LAND':
            return '⬟';
        case 'COMMON':
        default:
            return '●';
    }
};

const getMutateCards = (card: PermanentView | null): CardView[] => {
    if (!card?.mutateView) return [];
    return Object.entries(card.mutateView)
        .filter(([key, value]) => key !== 'id' && key !== 'name' && typeof value === 'object' && value !== null)
        .map(([, value]) => value as CardView);
};

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({ card, initialFace, onClose }) => {
    const { showCardReminderText, showCardSetInfo, showCardHints, cardImageFallbackMode } = useSettingsStore(useShallow(state => ({
        showCardReminderText: state.settings.showCardReminderText,
        showCardSetInfo: state.settings.showCardSetInfo,
        showCardHints: state.settings.showCardHints,
        cardImageFallbackMode: state.settings.cardImageFallbackMode,
    })));
    const sendPlayerAction = useGameStore(state => state.sendPlayerAction);
    // Check if this is an ability
    const isAbility = isStackAbility(card);

    // Use source card as the main card to display for abilities
    const sourceDisplayCard = isAbility ? card.sourceCard : card;
    const [imageUrl, setImageUrl] = useState<string>(cardImageService.getCardBackUrl());
    const [imageFailed, setImageFailed] = useState(false);
    const [selectedFace, setSelectedFace] = useState<'front' | 'back'>(
        initialFace ?? (sourceDisplayCard.transformed ? 'back' : 'front')
    );
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();
    const hasBackFace = !!sourceDisplayCard.secondCardFace || sourceDisplayCard.isDoubleFacedCard;
    const displayCard = selectedFace === 'back' && sourceDisplayCard.secondCardFace
        ? sourceDisplayCard.secondCardFace
        : sourceDisplayCard;

    useEffect(() => {
        setSelectedFace(initialFace ?? (sourceDisplayCard.transformed ? 'back' : 'front'));
    }, [initialFace, sourceDisplayCard.id, sourceDisplayCard.transformed]);

    // Load image using cache-aware preload (always resolves, returns placeholder on error)
    useEffect(() => {
        setImageFailed(false);
        const face = selectedFace === 'back' ? 'back' : 'front';
        const imageTarget = sourceDisplayCard;
        const imagePromise = selectedFace === 'back'
            ? Promise.resolve(cardImageService.getImageUrl(imageTarget, 'large', face))
            : cardImageService.preload(imageTarget, 'large');
        imagePromise.then((url) => {
            if (url === cardImageService.getPlaceholderUrl()) {
                setImageFailed(true);
                setImageUrl(cardImageService.getFallbackImageUrl(displayCard, cardImageFallbackMode));
            } else {
                setImageUrl(url);
            }
        });
    }, [cardImageFallbackMode, displayCard, sourceDisplayCard, selectedFace]);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        return () => {
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus();
            }
        };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [onClose]);

    // Close on click outside (overlay click)
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handlePreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(overlayRef.current);
        if (focusableElements.length === 0) {
            event.preventDefault();
            closeButtonRef.current?.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    // Extract card info from the display card
    const isPermanent = 'tapped' in displayCard;
    const permanentCard = isPermanent ? (displayCard as PermanentView) : null;
    const originalCard = permanentCard?.original;
    const mutateCards = getMutateCards(permanentCard);
    const isMutated = Boolean(permanentCard?.mutated || mutateCards.length > 0);
    const hasSplitDetails = displayCard.isSplitCard && (
        displayCard.leftSplitName ||
        displayCard.leftSplitRules?.length ||
        displayCard.rightSplitName ||
        displayCard.rightSplitRules?.length
    );
    const cardIconSummary = getCardIconSummary(displayCard.cardIcons);
    const rarityClassName = String(displayCard.rarity || 'common').toLowerCase();
    const setSymbolLabel = [
        displayCard.expansionSetCode || 'Unknown set',
        displayCard.rarity ? `${formatRarityLabel(displayCard.rarity)} rarity` : 'Unknown rarity',
    ].join(', ');
    const rulesText = displayCard.rules ?? [];
    const visibleRulesText = showCardReminderText
        ? rulesText
        : rulesText.map(stripReminderText).filter(Boolean);

    // Get mana cost string
    const getManaCost = (): string[] | undefined => {
        if (displayCard.manaCostRightStr && displayCard.manaCostRightStr.length > 0) {
            return displayCard.manaCostRightStr;
        }
        if (displayCard.manaCostLeftStr && displayCard.manaCostLeftStr.length > 0) {
            return displayCard.manaCostLeftStr;
        }
        return undefined;
    };

    const manaCost = getManaCost();

    // Get display name
    const getDisplayName = (): string => {
        return displayCard.name;
    };

    // Get type line
    const getTypeLine = (): string => {
        return displayCard.cardTypes?.join(' ').toUpperCase() || 'UNKNOWN TYPE';
    };

    const featureBadges = [
        displayCard.isSplitCard ? 'Split' : null,
        displayCard.isDoubleFacedCard ? 'Double-faced' : null,
        displayCard.faceDown ? 'Face down' : null,
        permanentCard?.morphed ? 'Morph' : null,
        permanentCard?.manifested ? 'Manifest' : null,
        permanentCard?.disguised ? 'Disguise' : null,
        permanentCard?.cloaked ? 'Cloak' : null,
        displayCard.isToken ? 'Token' : null,
        displayCard.paid ? 'Paid' : null,
        displayCard.isChoosable ? 'Choosable' : null,
        displayCard.playableStats?.playableAmount > 0 ? 'Playable' : null,
        permanentCard?.copy ? 'Copy' : null,
        isMutated ? 'Mutated' : null,
        permanentCard?.tapped ? 'Tapped' : null,
        permanentCard?.canAttack ? 'Can attack' : null,
        permanentCard?.canBlock ? 'Can block' : null,
        permanentCard?.summoningSickness ? 'Summoning sickness' : null,
    ].filter((badge): badge is string => Boolean(badge));
    const helperHints = [
        { label: 'Zone', value: displayCard.zone },
        { label: 'Mana value', value: displayCard.manaValue },
        { label: 'Frame', value: displayCard.frameStyle || displayCard.frameColor },
        { label: 'Color', value: displayCard.color },
        { label: 'Target links', value: displayCard.targets?.length },
        { label: 'Paired card', value: displayCard.pairedCard },
        { label: 'Band members', value: displayCard.bandedCards?.length },
        { label: 'Card icons', value: cardIconSummary },
        { label: 'Image file', value: displayCard.imageFileName },
        { label: 'Art rect', value: displayCard.artRect },
        { label: 'Original power', value: displayCard.originalPower },
        { label: 'Original toughness', value: displayCard.originalToughness },
    ]
        .map((hint) => ({ ...hint, value: formatHintValue(hint.value) }))
        .filter((hint) => hint.value);
    const triggerObjectId = isAbility ? card.id : displayCard.id;
    const triggerRuleText = ((isAbility ? card.rules?.[0] : displayCard.rules?.[0]) || '')
        .replace(/\{this\}/g, displayCard.name)
        .trim();
    const sendTriggerOrder = React.useCallback(async (
        action: 'TRIGGER_AUTO_ORDER_ABILITY_FIRST' | 'TRIGGER_AUTO_ORDER_ABILITY_LAST' | 'TRIGGER_AUTO_ORDER_NAME_FIRST' | 'TRIGGER_AUTO_ORDER_NAME_LAST',
        payload: string,
    ) => {
        await sendPlayerAction(action, payload);
    }, [sendPlayerAction]);

    return (
        <div
            ref={overlayRef}
            className="card-preview-overlay"
            onClick={handleOverlayClick}
            onKeyDown={handlePreviewKeyDown}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="card-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="card-preview-container">
                <div className="card-preview-content">
                    <div className="card-preview-image-wrapper">
                        <img
                            src={imageUrl}
                            alt={getDisplayName()}
                            className="card-preview-image"
                            onError={(event) => {
                                setImageFailed(true);
                                event.currentTarget.src = cardImageService.getFallbackImageUrl(displayCard, cardImageFallbackMode);
                            }}
                        />
                        {imageFailed && (
                            <div className="card-image-fallback-badge">
                                Image fallback
                            </div>
                        )}
                        {hasBackFace && (
                            <div className="card-face-toggle" role="group" aria-label="Card face">
                                <button
                                    type="button"
                                    className={selectedFace === 'front' ? 'active' : ''}
                                    onClick={() => setSelectedFace('front')}
                                >
                                    Front
                                </button>
                                <button
                                    type="button"
                                    className={selectedFace === 'back' ? 'active' : ''}
                                    onClick={() => setSelectedFace('back')}
                                >
                                    Back
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="card-preview-close"
                        onClick={onClose}
                        aria-label="Close card preview"
                    >
                        x
                    </button>
                </div>

                <div className="card-info-panel">
                    <div className="card-info-header">
                        <h2 className="card-info-name" id={titleId}>{getDisplayName()}</h2>
                        {manaCost && (
                            <div className="card-info-mana">
                                <ManaCost cost={manaCost} size="md" />
                            </div>
                        )}
                    </div>

                    {featureBadges.length > 0 && (
                        <div className="card-info-badges" aria-label="Card state">
                            {featureBadges.map((badge) => (
                                <span key={badge} className="card-info-badge">{badge}</span>
                            ))}
                        </div>
                    )}

                    <div className="card-info-type">
                        {getTypeLine()}
                        {displayCard.subTypes && displayCard.subTypes.length > 0 && (
                            <span className="card-info-subtypes"> — {displayCard.subTypes.join(' ')}</span>
                        )}
                    </div>

                    {/* Indicator that we are viewing the source of a stack ability */}
                    {isAbility && (
                        <div className="card-info-ability-source">
                            <span className="ability-label">Source of ability</span>
                            <strong>{sourceDisplayCard.name}</strong>
                        </div>
                    )}

                    {(triggerObjectId || triggerRuleText) && (
                        <div className="card-info-trigger-actions" data-testid="card-preview-trigger-actions">
                            <div className="card-info-trigger-title">Trigger Auto-Order</div>
                            <div className="card-info-trigger-grid">
                                <button
                                    type="button"
                                    disabled={!triggerObjectId}
                                    onClick={() => sendTriggerOrder('TRIGGER_AUTO_ORDER_ABILITY_FIRST', triggerObjectId)}
                                    data-testid="card-trigger-ability-first"
                                >
                                    Ability first
                                </button>
                                <button
                                    type="button"
                                    disabled={!triggerObjectId}
                                    onClick={() => sendTriggerOrder('TRIGGER_AUTO_ORDER_ABILITY_LAST', triggerObjectId)}
                                    data-testid="card-trigger-ability-last"
                                >
                                    Ability last
                                </button>
                                <button
                                    type="button"
                                    disabled={!triggerRuleText}
                                    onClick={() => sendTriggerOrder('TRIGGER_AUTO_ORDER_NAME_FIRST', triggerRuleText)}
                                    data-testid="card-trigger-name-first"
                                >
                                    Name first
                                </button>
                                <button
                                    type="button"
                                    disabled={!triggerRuleText}
                                    onClick={() => sendTriggerOrder('TRIGGER_AUTO_ORDER_NAME_LAST', triggerRuleText)}
                                    data-testid="card-trigger-name-last"
                                >
                                    Name last
                                </button>
                            </div>
                        </div>
                    )}

                    {visibleRulesText.length > 0 && (
                        <div className="card-info-rules">
                            {visibleRulesText.map((rule, i) => (
                                <div key={i} className="rules-text">
                                    {parseRulesText(rule, showCardReminderText)}
                                </div>
                            ))}
                        </div>
                    )}

                    {hasSplitDetails && (
                        <div className="card-info-split" data-testid="card-preview-split-details">
                            <SplitFaceSummary
                                name={displayCard.leftSplitName || displayCard.name}
                                typeLine={displayCard.leftSplitTypeLine}
                                costs={displayCard.leftSplitCostsStr}
                                rules={displayCard.leftSplitRules}
                                showReminderText={showCardReminderText}
                            />
                            <SplitFaceSummary
                                name={displayCard.rightSplitName || displayCard.alternateName || 'Right face'}
                                typeLine={displayCard.rightSplitTypeLine}
                                costs={displayCard.rightSplitCostsStr}
                                rules={displayCard.rightSplitRules}
                                showReminderText={showCardReminderText}
                            />
                        </div>
                    )}

                    {/* P/T for creatures */}
                    {hasCardType(displayCard, 'Creature') && (
                        <div className="card-info-pt">
                            <span className="pt-value">
                                {displayCard.power}/{displayCard.toughness}
                            </span>
                            {permanentCard && permanentCard.damage > 0 && (
                                <span className="damage-value">({permanentCard.damage} damage)</span>
                            )}
                        </div>
                    )}

                    {/* Loyalty for planeswalkers */}
                    {hasCardType(displayCard, 'Planeswalker') && displayCard.loyalty && (
                        <div className="card-info-loyalty">
                            Loyalty: <span className="loyalty-value">
                                {displayCard.loyalty}
                            </span>
                        </div>
                    )}

                    {permanentCard && (
                        <div className="card-info-state-grid">
                            <CardStateItem label="Controller" value={permanentCard.nameController} />
                            <CardStateItem label="Owner" value={permanentCard.nameOwner} />
                            {(permanentCard.attachments?.length ?? 0) > 0 && (
                                <CardStateItem label="Attached cards" value={String(permanentCard.attachments?.length ?? 0)} />
                            )}
                            {permanentCard.attachedTo && (
                                <CardStateItem label="Attached to" value={permanentCard.attachedTo} />
                            )}
                            {originalCard && (
                                <CardStateItem label="Original" value={originalCard.name} />
                            )}
                            {cardIconSummary && (
                                <CardStateItem label="Card icons" value={cardIconSummary} />
                            )}
                        </div>
                    )}

                    {isMutated && (
                        <div className="card-info-mutate" data-testid="card-preview-mutate-stack">
                            <div className="card-info-mutate-title">Mutate Stack</div>
                            {mutateCards.length > 0 ? (
                                <div className="card-info-mutate-list">
                                    {mutateCards.map((mutateCard) => (
                                        <div className="card-info-mutate-card" key={mutateCard.id}>
                                            <span>{mutateCard.name}</span>
                                            {mutateCard.cardTypes?.length > 0 && (
                                                <small>{mutateCard.cardTypes.join(' ')}</small>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="card-info-mutate-empty">
                                    Mutate details are not included in this server payload.
                                </div>
                            )}
                        </div>
                    )}

                    {showCardHints && helperHints.length > 0 && (
                        <div className="card-info-hints" data-testid="card-preview-helper-hints">
                            <div className="card-info-hints-title">Helper Hints</div>
                            <div className="card-info-hint-grid">
                                {helperHints.map((hint) => (
                                    <CardStateItem key={hint.label} label={hint.label} value={hint.value} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Counters for permanents */}
                    {permanentCard && permanentCard.counters && permanentCard.counters.length > 0 && (
                        <div className="card-info-counters">
                            <div className="counters-label">Counters:</div>
                            <div className="counters-list">
                                {permanentCard.counters.map((counter, i) => (
                                    <span key={i} className="counter-item">
                                        {counter.count}x {counter.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Set info */}
                    {showCardSetInfo && <div className="card-info-set" data-testid="card-preview-set-info">
                        <span
                            className={`set-symbol rarity-${rarityClassName}`}
                            data-testid="card-preview-set-symbol"
                            aria-label={setSymbolLabel}
                            title={setSymbolLabel}
                        >
                            <span className="set-symbol-glyph" aria-hidden="true">{getSetSymbolGlyph(displayCard.rarity)}</span>
                            {displayCard.expansionSetCode && (
                                <span className="set-symbol-code">{displayCard.expansionSetCode}</span>
                            )}
                        </span>
                        {displayCard.expansionSetCode && (
                            <span className="set-code">{displayCard.expansionSetCode}</span>
                        )}
                        {displayCard.cardNumber && (
                            <span className="set-number">#{displayCard.cardNumber}</span>
                        )}
                        {displayCard.rarity && (
                            <span className={`set-rarity rarity-${rarityClassName}`}>
                                {formatRarityLabel(displayCard.rarity)}
                            </span>
                        )}
                    </div>}
                </div>
            </div>
        </div>
    );
};

interface SplitFaceSummaryProps {
    name: string;
    typeLine?: string;
    costs?: string;
    rules?: string[];
    showReminderText: boolean;
}

const splitManaCost = (costs?: string): string[] | undefined => {
    if (!costs) return undefined;
    const symbols = costs.match(/\{[^}]+\}/g);
    return symbols && symbols.length > 0 ? symbols : [costs];
};

const SplitFaceSummary: React.FC<SplitFaceSummaryProps> = ({ name, typeLine, costs, rules, showReminderText }) => {
    const manaCost = splitManaCost(costs);
    const visibleRules = showReminderText
        ? rules
        : rules?.map(stripReminderText).filter(Boolean);

    return (
        <section className="split-face-summary">
            <div className="split-face-header">
                <strong>{name}</strong>
                {manaCost && <ManaCost cost={manaCost} size="sm" />}
            </div>
            {typeLine && <div className="split-face-type">{typeLine}</div>}
            {visibleRules?.map((rule, index) => (
                <div key={index} className="split-face-rule">
                    {parseRulesText(rule, showReminderText)}
                </div>
            ))}
        </section>
    );
};

const CardStateItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="card-state-item">
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];

    const selector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(container.querySelectorAll<HTMLElement>(selector))
        .filter(element => !element.hasAttribute('hidden') && element.offsetParent !== null);
}
