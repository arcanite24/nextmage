import React from 'react';
import { Hand, Heart } from 'lucide-react';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { CardView, CommandObjectView, GameView, PlayerView, SimpleCardView } from '../../../types';
import { cardImageService, type CardImageFallbackMode } from '../../../services/CardImageService';
import { getPlayerCommandZoneGroups, getSharedPlanes } from '../../../services/CommandZoneService';
import { Modal, Button } from '../../common'; // Adjust paths as needed
import './CardSelectorDialog.css';

import { GameZoneView, PendingAction } from '../../../stores/gameStore';

interface CardSelectorDialogProps {
    isOpen?: boolean;
    pendingAction?: PendingAction;
    showingZone?: GameZoneView;
    showingPlayerId?: string;
    onClose?: () => void;
}

interface DisplayCard {
    id: string;
    name: string;
    imageUrl: string;
    isPlayable: boolean;
    isSelected: boolean;
    sourceCard: Partial<CardView & SimpleCardView & CommandObjectView>;
    typeLine: string;
    manaValue: number | null;
}

type CardSelectorFilter = 'all' | 'valid' | 'playable' | 'selected';
type CardSelectorSort = 'original' | 'name' | 'type' | 'mana';

function getCardName(card: Partial<CardView & SimpleCardView & CommandObjectView>, index: number): string {
    return card.name || card.displayName || card.displayFullName || `Card ${index + 1}`;
}

function getCardImageUrl(
    card: Partial<CardView & SimpleCardView & CommandObjectView>,
    fallbackMode: CardImageFallbackMode
): string {
    if (card.expansionSetCode && 'cardNumber' in card && typeof card.cardNumber === 'string' && card.cardNumber.length > 0) {
        return cardImageService.getImageUrl(card as CardView);
    }

    return cardImageService.getFallbackImageUrl(card, fallbackMode);
}

function toDisplayCards(
    cards: Array<Partial<CardView & SimpleCardView & CommandObjectView>>,
    gameView: GameView | null,
    selectedCardId: string | null,
    fallbackMode: CardImageFallbackMode,
): DisplayCard[] {
    return cards.map((card, index) => {
        const id = card.id || `${getCardName(card, index)}-${index}`;
        const playableAmount = gameView?.canPlayObjects?.objects?.[id]?.playableAmount ?? card.playableStats?.playableAmount ?? 0;
        return {
            id,
            name: getCardName(card, index),
            imageUrl: getCardImageUrl(card, fallbackMode),
            isPlayable: playableAmount > 0 || Boolean(card.isChoosable),
            isSelected: selectedCardId === id || Boolean(card.isSelected),
            sourceCard: card,
            typeLine: card.cardTypes?.join(' ') || '',
            manaValue: typeof card.manaValue === 'number' ? card.manaValue : null,
        };
    });
}

function numberedEntry<T>(items: T[] | undefined, key: string | null | undefined): T | null {
    if (!items || items.length === 0) {
        return null;
    }

    const index = Number(key ?? 0);
    return items[Number.isFinite(index) ? index : 0] ?? null;
}

function isOrderedPrompt(message: string, pendingAction: PendingAction): boolean {
    if ((pendingAction.type === 'target' || pendingAction.type === 'select') && pendingAction.orderSelection) {
        return true;
    }
    return /\b(order|ORDER)\b/.test(message) || /last one chosen/i.test(message);
}

function cardMatchesSearch(card: DisplayCard, searchText: string): boolean {
    const text = searchText.trim().toLowerCase();
    if (!text) return true;
    return [
        card.name,
        card.typeLine,
        card.sourceCard.expansionSetCode,
        card.sourceCard.cardNumber,
    ].some((value) => String(value ?? '').toLowerCase().includes(text));
}

function sortCards<T extends DisplayCard>(cards: T[], sortMode: CardSelectorSort): T[] {
    if (sortMode === 'original') return cards;
    const sorted = [...cards];
    sorted.sort((left, right) => {
        if (sortMode === 'mana') {
            const leftMana = left.manaValue ?? Number.MAX_SAFE_INTEGER;
            const rightMana = right.manaValue ?? Number.MAX_SAFE_INTEGER;
            if (leftMana !== rightMana) return leftMana - rightMana;
        }
        if (sortMode === 'type') {
            const typeCompare = left.typeLine.localeCompare(right.typeLine);
            if (typeCompare !== 0) return typeCompare;
        }
        return left.name.localeCompare(right.name);
    });
    return sorted;
}

export const CardSelectorDialog: React.FC<CardSelectorDialogProps> = (props) => {
    const storePendingAction = useGameStore(state => state.pendingAction);
    const storeShowingZone = useGameStore(state => state.showingZone);
    const storeShowingPlayerId = useGameStore(state => state.showingPlayerId);
    const gameView = useGameStore(state => state.gameView);
    const showZone = useGameStore(state => state.showZone);
    const sendUUID = useGameStore(state => state.sendUUID);
    const selectedCardId = useGameStore(state => state.selectedCardId);
    const selectCard = useGameStore(state => state.selectCard);
    const cardImageFallbackMode = useSettingsStore(state => state.settings.cardImageFallbackMode);
    const [searchText, setSearchText] = React.useState('');
    const [filterMode, setFilterMode] = React.useState<CardSelectorFilter>('all');
    const [sortMode, setSortMode] = React.useState<CardSelectorSort>('original');

    // Use props if provided, otherwise fall back to store
    const pendingAction = props.pendingAction || storePendingAction;
    const showingZone = props.showingZone || storeShowingZone;
    const showingPlayerId = props.showingPlayerId || storeShowingPlayerId;

    // Determine source of data: Pending Action OR Showing Zone
    const isTarget = pendingAction.type === 'target';
    const isSelect = pendingAction.type === 'select';
    const isViewing = !!showingZone;

    if (!isTarget && !isSelect && !isViewing) {
        return null;
    }

    let cardsView: Record<string, CardView> | undefined;
    let displayCards: DisplayCard[] = [];
    let message = '';
    let title = 'Select Target';
    let required = false;
    let minSelections = 0;
    let maxSelections = 1;
    let validTargets: string[] = [];
    let handleCardClick: (cardId: string) => void = () => undefined;
    let handlePlayerClick: (playerId: string) => void = () => undefined;
    let handleCancel = () => { };

    if (isTarget || isSelect) {
        const actionData = pendingAction as any;
        cardsView = actionData.cardsView as Record<string, CardView> | undefined;
        message = actionData.message || 'Select a card';
        title = isTarget ? 'Select Target' : 'Select Card';
        minSelections = typeof actionData.min === 'number' ? actionData.min : actionData.required ? 1 : 0;
        maxSelections = typeof actionData.max === 'number' ? actionData.max : 1;
        required = actionData.required ?? minSelections > 0;
        validTargets = actionData.validTargets || [];

        handleCardClick = (cardId: string) => {
            sendUUID(cardId);
        };

        handlePlayerClick = (playerId: string) => {
            sendUUID(playerId);
        };

        handleCancel = () => {
            if (!required) {
                sendUUID(null);
            }
        };
    } else if (isViewing && gameView) {
        // Find the player
        const player = gameView.players.find(p => p.playerId === showingPlayerId);
        let zoneCards: Array<Partial<CardView & SimpleCardView & CommandObjectView>> = [];
        let ownerLabel = 'Match';
        let zoneLabel: string = showingZone;

        if (player) {
            ownerLabel = player.name;
            if (showingZone === 'graveyard') zoneCards = Object.values(player.graveyard);
            else if (showingZone === 'exile') zoneCards = Object.values(player.exile);
            else if (showingZone === 'sideboard') zoneCards = Object.values(player.sideboard);
            else if (showingZone === 'library') zoneCards = [];
            else if (showingZone === 'topLibrary') zoneCards = player.topCard ? [player.topCard] : [];
            else if (showingZone === 'command') zoneCards = [...(player.commandList || []), ...(player.commandObjectList || [])];
            else if (showingZone === 'commanders') zoneCards = getPlayerCommandZoneGroups(player).commanders;
            else if (showingZone === 'commandEmblems') zoneCards = getPlayerCommandZoneGroups(player).emblems;
            else if (showingZone === 'dungeons') zoneCards = getPlayerCommandZoneGroups(player).dungeons;
            else if (showingZone === 'commandOther') zoneCards = getPlayerCommandZoneGroups(player).other;
            zoneLabel = showingZone === 'topLibrary' ? 'visible library card' : showingZone;
            if (showingZone === 'commanders') zoneLabel = 'commanders';
            else if (showingZone === 'commandEmblems') zoneLabel = 'emblems';
            else if (showingZone === 'dungeons') zoneLabel = 'dungeons';
            else if (showingZone === 'commandOther') zoneLabel = 'command objects';
        } else if (showingZone === 'exileGroup') {
            const exile = gameView.exiles.find((group) => group.id === showingPlayerId) || gameView.exiles[0];
            ownerLabel = exile?.name || 'Exile';
            zoneLabel = 'exile group';
            zoneCards = exile ? Object.values(exile.cards) : [];
        } else if (showingZone === 'planes') {
            ownerLabel = 'Shared command zone';
            zoneLabel = 'planes';
            zoneCards = getSharedPlanes(gameView.players);
        } else if (showingZone === 'revealed') {
            const revealed = numberedEntry(gameView.revealed, showingPlayerId);
            ownerLabel = revealed?.name || 'Revealed';
            zoneLabel = 'revealed cards';
            zoneCards = revealed ? Object.values(revealed.cards) : [];
        } else if (showingZone === 'lookedAt') {
            const lookedAt = numberedEntry(gameView.lookedAt, showingPlayerId);
            ownerLabel = lookedAt?.name || 'Looked At';
            zoneLabel = 'looked-at cards';
            zoneCards = lookedAt ? Object.values(lookedAt.cards) : [];
        } else if (showingZone === 'companion') {
            const companion = numberedEntry(gameView.companion, showingPlayerId);
            ownerLabel = companion?.name || 'Companion';
            zoneLabel = 'companion';
            zoneCards = companion ? Object.values(companion.cards) : [];
        } else if (showingZone === 'emblems') {
            ownerLabel = 'Your helper zone';
            zoneLabel = 'emblems and helper cards';
            zoneCards = Object.values(gameView.myHelperEmblems || {});
        } else if (showingZone === 'opponentHand') {
            ownerLabel = gameView.players.find(p => p.playerId === showingPlayerId)?.name || 'Opponent';
            zoneLabel = 'granted hand';
            zoneCards = Object.values(gameView.opponentHands?.[showingPlayerId || ''] || {});
        } else if (showingZone === 'watchedHand') {
            ownerLabel = gameView.players.find(p => p.playerId === showingPlayerId)?.name || 'Watched player';
            zoneLabel = 'watched hand';
            zoneCards = Object.values(gameView.watchedHands?.[showingPlayerId || ''] || {});
        }

        displayCards = toDisplayCards(zoneCards, gameView, selectedCardId, cardImageFallbackMode);
        message = `${ownerLabel}: ${zoneLabel}`;
        title = `${ownerLabel} - ${zoneLabel}`;
        required = false; // Viewing is never required
        minSelections = 0;
        maxSelections = 0;

        handleCardClick = (cardId: string) => {
            selectCard(cardId);
        };

        handleCancel = () => {
            showZone(null, null); // Close viewer
        };
    }

    const cards = cardsView ? Object.values(cardsView) : [];
    if ((isTarget || isSelect) && cards.length > 0) {
        displayCards = toDisplayCards(cards, gameView, selectedCardId, cardImageFallbackMode);
    }

    const orderedPrompt = isOrderedPrompt(message, pendingAction);
    const isInteractiveCardPrompt = isTarget || isSelect;
    const decoratedCards = displayCards.map((card) => ({
        ...card,
        isValidTarget: isViewing || validTargets.length === 0 || validTargets.includes(card.id),
    }));
    const selectedCount = decoratedCards.filter((card) => card.isSelected).length;
    const validCount = decoratedCards.filter((card) => card.isValidTarget).length;
    const filteredCards = sortCards(
        decoratedCards.filter((card) => {
            if (!cardMatchesSearch(card, searchText)) return false;
            if (filterMode === 'valid') return card.isValidTarget;
            if (filterMode === 'playable') return card.isPlayable;
            if (filterMode === 'selected') return card.isSelected;
            return true;
        }),
        sortMode
    );
    const selectionRangeText = maxSelections > 1
        ? `${minSelections}-${maxSelections}`
        : minSelections > 0 ? `${minSelections}` : 'optional';

    const resetListControls = () => {
        setSearchText('');
        setFilterMode('all');
        setSortMode('original');
        if (isViewing) {
            selectCard(null);
        }
    };

    const handleSelectorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, select, textarea')) {
            return;
        }

        const shortcut = Number.parseInt(event.key, 10);
        if (isInteractiveCardPrompt && shortcut >= 1 && shortcut <= 9 && shortcut <= filteredCards.length) {
            const card = filteredCards[shortcut - 1];
            if (card.isValidTarget) {
                event.preventDefault();
                handleCardClick(card.id);
            }
        } else if (event.key === 'Escape' && !required) {
            event.preventDefault();
            handleCancel();
        }
    };

    // Check if this is a player selection scenario
    // If message contains "player" and we have valid targets that match player IDs
    const isPlayerSelection = (isTarget || isSelect) &&
        validTargets.length > 0 &&
        gameView?.players?.some(p => validTargets.includes(p.playerId));

    // Get the players that are valid targets
    const targetablePlayers: PlayerView[] = isPlayerSelection && gameView?.players
        ? gameView.players.filter(p => validTargets.includes(p.playerId))
        : [];

    // If no cardsView and not player selection, don't show this dialog
    // (The main GamePage handles battlefield/hand targeting when no specific cardsView is provided)
    if (!cardsView && !isPlayerSelection && !isViewing) {
        return null;
    }

    // For interactive modes (target/select), if the provided list is empty and not player selection, 
    // it usually means we should be picking from the battlefield or hand.
    // If we are just viewing (e.g. graveyard), showing "No cards" is fine.
    if ((isTarget || isSelect) && cards.length === 0 && !isPlayerSelection) {
        return null;
    }

    return (
        <Modal
            isOpen={props.isOpen ?? true}
            onClose={props.onClose || (required ? () => { } : handleCancel)}
            title={title}
            size="lg"
            closeOnBackdrop={!required}
            closeOnEscape={!required}
            showCloseButton={!required}
        >
            <div
                className="card-selector-container"
                onKeyDown={handleSelectorKeyDown}
                data-required={String(required)}
                data-min-selections={minSelections}
                data-max-selections={maxSelections}
            >
                <div className="card-selector-message" dangerouslySetInnerHTML={{ __html: message }} />
                {orderedPrompt && (
                    <div className="card-selector-order-hint" data-testid="card-selector-order-hint">
                        Choose cards one at a time in the requested order. The server will reopen this prompt until the order is complete.
                    </div>
                )}

                <div className="card-selector-toolbar" data-testid="card-selector-toolbar">
                    <label className="card-selector-search">
                        <span>Search</span>
                        <input
                            type="search"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            placeholder="Name, type, set, number"
                            data-testid="card-selector-search"
                            autoFocus
                        />
                    </label>
                    <label>
                        <span>Filter</span>
                        <select
                            value={filterMode}
                            onChange={(event) => setFilterMode(event.target.value as CardSelectorFilter)}
                            data-testid="card-selector-filter"
                        >
                            <option value="all">All</option>
                            <option value="valid">Valid</option>
                            <option value="playable">Playable</option>
                            <option value="selected">Selected</option>
                        </select>
                    </label>
                    <label>
                        <span>Sort</span>
                        <select
                            value={sortMode}
                            onChange={(event) => setSortMode(event.target.value as CardSelectorSort)}
                            data-testid="card-selector-sort"
                        >
                            <option value="original">Original</option>
                            <option value="name">Name</option>
                            <option value="type">Type</option>
                            <option value="mana">Mana value</option>
                        </select>
                    </label>
                    <button type="button" onClick={resetListControls} data-testid="card-selector-clear">
                        Clear
                    </button>
                </div>

                <div className="card-selector-status" data-testid="card-selector-status">
                    <span>{filteredCards.length}/{displayCards.length} shown</span>
                    <span>{validCount} valid</span>
                    {isInteractiveCardPrompt && <span>Need {selectionRangeText}</span>}
                    {selectedCount > 0 && <span>{selectedCount} selected</span>}
                </div>

                {/* Player Selection UI */}
                {isPlayerSelection && targetablePlayers.length > 0 && (
                    <div className="player-selector-section">
                        <div className="player-selector-label">Select a Player:</div>
                        <div className="player-selector-list">
                            {targetablePlayers.map((player) => (
                                <button
                                    type="button"
                                    key={player.playerId}
                                    className="player-selector-item"
                                    onClick={() => handlePlayerClick(player.playerId)}
                                    data-testid="player-selector-target"
                                    data-player-id={player.playerId}
                                >
                                    <div className="player-selector-avatar">
                                        {player.userData?.avatarId ? (
                                            <img
                                                src={`/assets/avatars/${player.userData.avatarId}.jpg`}
                                                alt={player.name}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="player-selector-avatar-fallback">
                                                {player.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="player-selector-info">
                                        <div className="player-selector-name">{player.name}</div>
                                        <div className="player-selector-stats">
                                            <span><Heart size={14} aria-hidden="true" /> {player.life}</span>
                                            <span><Hand size={14} aria-hidden="true" /> {player.handCount}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Card Selection UI */}
                {displayCards.length > 0 && (
                    <div className="card-selector-cards">
                        {filteredCards.map((card, index) => {
                            const isValidTarget = card.isValidTarget;
                            return (
                                <button
                                    type="button"
                                    key={card.id}
                                    className={[
                                        'card-selector-item',
                                        isValidTarget ? 'valid-target' : 'invalid-target',
                                        card.isPlayable ? 'playable-card' : '',
                                        card.isSelected ? 'selected' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => isValidTarget && handleCardClick(card.id)}
                                    disabled={!isValidTarget}
                                    title={card.isPlayable ? `${card.name} is playable or targetable` : card.name}
                                    aria-label={`${index < 9 && isInteractiveCardPrompt ? `${index + 1}. ` : ''}${card.name}${isValidTarget ? '' : ' unavailable'}`}
                                    data-testid="card-selector-card"
                                    data-card-id={card.id}
                                    data-valid-target={String(isValidTarget)}
                                    data-selected={String(card.isSelected)}
                                >
                                    {index < 9 && isInteractiveCardPrompt && (
                                        <span className="card-selector-shortcut">{index + 1}</span>
                                    )}
                                    <img
                                        src={card.imageUrl}
                                        alt={card.name}
                                        loading="lazy"
                                        onError={(e) => {
                                            e.currentTarget.src = cardImageService.getFallbackImageUrl(card.sourceCard, cardImageFallbackMode);
                                        }}
                                    />
                                    <div className="card-selector-name">{card.name}</div>
                                    {card.typeLine && <div className="card-selector-type">{card.typeLine}</div>}
                                    {card.isPlayable && <div className="card-selector-playable-badge">Playable</div>}
                                    {card.isSelected && <div className="card-selector-selected-badge">Selected</div>}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Empty state for viewing zones */}
                {displayCards.length === 0 && !isPlayerSelection && (
                    <div className="card-selector-empty">No cards to display</div>
                )}
                {displayCards.length > 0 && filteredCards.length === 0 && (
                    <div className="card-selector-empty">No cards match the current filters</div>
                )}

                <div className="card-selector-footer">
                    {/* If optional or min=0, show Cancel/Done */}
                    {!required && (
                        <Button variant="secondary" onClick={handleCancel} data-testid="card-selector-done">
                            {isInteractiveCardPrompt ? 'Done' : 'Close'}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
