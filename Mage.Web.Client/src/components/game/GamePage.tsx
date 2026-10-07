import React, { useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, useDebugStore, useAnimationStore } from '../../stores';
import { Button } from '../common';
import { Battlefield, type BattlefieldCardClickOptions, type BattlefieldInspectMode } from './Battlefield';
import { Hand } from './Hand';
import { ArenaPlayerHUD } from './ArenaPlayerHUD';
import { ArenaOpponentHUD } from './ArenaOpponentHUD';
import { ArenaStack } from './ArenaStack';
import { PhaseIndicator } from './PhaseIndicator';
import { FeedbackPanel } from './FeedbackPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { CombatOverlay } from './CombatOverlay';
import { AttackAnimation } from './AttackAnimation';
import { DamageEffects } from './DamageEffects';
import { CardPreviewModal } from './CardPreviewModal';
import { ResultModal } from './ResultModal';
import { AbilityPickerDialog } from './dialogs/AbilityPickerDialog';
import { ManaPaymentDialog } from './ManaPaymentDialog';
import { ChoiceDialog } from './ChoiceDialog';
import { AmountDialog } from './AmountDialog';
import { MultiAmountDialog } from './MultiAmountDialog';
import { PileDialog } from './PileDialog';
import { CardSelectorDialog } from "./dialogs/CardSelectorDialog";
import { SideboardDialog } from './dialogs/SideboardDialog';
import { SkipIndicator } from './SkipIndicator';
import { ArenaPriorityControls } from './ArenaPriorityControls';
import { MatchActionPanel } from './MatchActionPanel';
import { MatchZonePanel } from './MatchZonePanel';
import { MatchLogPanel } from './MatchLogPanel';
import { audioFeedbackService } from '../../services/AudioFeedbackService';
import { appConfigService } from '../../services/AppConfigService';
import { cardImageService } from '../../services/CardImageService';
import { applyClientKeybind, keybindService, type KeybindDefinition } from '../../services/KeybindService';
import {
    createPlayerFeedbackSnapshot,
    diffPlayerFeedbackSnapshots,
    type PlayerFeedbackSnapshot,
} from '../../services/PlayerFeedbackService';
import { DebugMode } from '../debug/DebugMode';
import { CardView, ManaType, PermanentView, PlayerView, StackAbilityView, UUID } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import type { MatchSeatOrientation } from '../../services/AppConfigService';
import './GamePage.css';
import './ArenaLayout.css';

interface GamePageProps {
    gameId: string;
    onLeave: () => void;
    isReplay?: boolean;
}

const isStackAbilityCard = (card: CardView | PermanentView): card is StackAbilityView => {
    return card.isAbility && 'sourceCard' in card && Boolean((card as StackAbilityView).sourceCard);
};

function orientOpponents(
    opponents: PlayerView[],
    activePlayerId: string | undefined,
    orientation: MatchSeatOrientation,
): PlayerView[] {
    if (opponents.length < 2) {
        return opponents;
    }

    if (orientation === 'reverse') {
        return [...opponents].reverse();
    }

    if (orientation === 'active-first' && activePlayerId) {
        const activeIndex = opponents.findIndex((player) => player.playerId === activePlayerId);
        if (activeIndex > 0) {
            return [...opponents.slice(activeIndex), ...opponents.slice(0, activeIndex)];
        }
    }

    return opponents;
}

export const GamePage: React.FC<GamePageProps> = ({ gameId, onLeave, isReplay = false }) => {
    const gameStore = useGameStore(useShallow(state => ({
        gameView: state.gameView,
        isLoading: state.isLoading,
        gameEnded: state.gameEnded,
        gameEndView: state.gameEndView,
        endGameInfo: state.endGameInfo,
        isWatching: state.isWatching,
        pendingAction: state.pendingAction,
        activeSkip: state.activeSkip,
        showingZone: state.showingZone,
        showingPlayerId: state.showingPlayerId,
        arenaSkipEnabled: state.arenaSkipEnabled,
        lastMessage: state.lastMessage,
        lastError: state.lastError,
    })));

    const actions = useGameStore(useShallow(state => ({
        leaveGame: state.leaveGame,
        sendUUID: state.sendUUID,
        sendBoolean: state.sendBoolean,
        sendManaType: state.sendManaType,
        passPriority: state.passPriority,
        passPriorityUntilEndOfTurn: state.passPriorityUntilEndOfTurn,
        passPriorityUntilNextTurnSkipStack: state.passPriorityUntilNextTurnSkipStack,
        passPriorityUntilNextMain: state.passPriorityUntilNextMain,
        passPriorityUntilStackResolved: state.passPriorityUntilStackResolved,
        passPriorityUntilNextTurn: state.passPriorityUntilNextTurn,
        passPriorityUntilMyNextTurn: state.passPriorityUntilMyNextTurn,
        passPriorityUntilEndStepBeforeMyTurn: state.passPriorityUntilEndStepBeforeMyTurn,
        cancelPassActions: state.cancelPassActions,
        concede: state.concede,
        showZone: state.showZone,
        submitDeck: state.submitDeck,
        sendPlayerAction: state.sendPlayerAction,
        toggleArenaSkip: state.toggleArenaSkip
    })));

    const config = useDebugStore(state => state.config);
    const toggleDebugMode = useDebugStore(state => state.toggleDebugMode);
    const { settings, syncRuntimeSettings } = useSettingsStore(useShallow(state => ({
        settings: state.settings,
        syncRuntimeSettings: state.syncRuntimeSettings,
    })));
    const [previewCard, setPreviewCard] = React.useState<CardView | PermanentView | null>(null);
    const [previewInitialFace, setPreviewInitialFace] = React.useState<'front' | 'back' | null>(null);
    const [hoverPreviewCard, setHoverPreviewCard] = React.useState<CardView | PermanentView | null>(null);
    const [resultModalClosed, setResultModalClosed] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(() => appConfigService.loadPanelLayoutConfig().game.sidebarOpen);
    const [debugModeOpen, setDebugModeOpen] = useState(false);
    const hoverPreviewTimerRef = useRef<number | null>(null);
    const isPlayerControlLocked = React.useCallback(() => (
        isReplay || useGameStore.getState().isWatching
    ), [isReplay]);

    // Animation store for life change detection and attack animations
    const updateLifeTotals = useAnimationStore(state => state.updateLifeTotals);
    const triggerPlayerCounterEffect = useAnimationStore(state => state.triggerPlayerCounterEffect);
    const queueMultipleAttacks = useAnimationStore(state => state.queueMultipleAttacks);
    const clearAnimationQueue = useAnimationStore(state => state.clearAnimationQueue);
    const previousPlayerFeedbackSnapshotRef = useRef<PlayerFeedbackSnapshot | null>(null);
    const previousStepRef = useRef<string | null>(null);
    const hasQueuedAttacksRef = useRef(false);

    // Track player life and counter changes to trigger damage and HUD feedback.
    useEffect(() => {
        const players = gameStore.gameView?.players;
        if (!players) {
            previousPlayerFeedbackSnapshotRef.current = null;
            return;
        }

        const currentLifeTotals: Record<UUID, number> = {};
        players.forEach((p) => {
            currentLifeTotals[p.playerId] = p.life;
        });
        const currentStep = gameStore.gameView?.step;
        const isCombatDamageStep = currentStep === 'COMBAT_DAMAGE' || currentStep === 'FIRST_COMBAT_DAMAGE';
        updateLifeTotals(currentLifeTotals, isCombatDamageStep);

        const currentSnapshot = createPlayerFeedbackSnapshot(players);
        const previousSnapshot = previousPlayerFeedbackSnapshotRef.current;
        previousPlayerFeedbackSnapshotRef.current = currentSnapshot;

        if (!settings.animationsEnabled || !previousSnapshot) {
            return;
        }

        for (const event of diffPlayerFeedbackSnapshots(previousSnapshot, currentSnapshot)) {
            if (event.kind !== 'counterGained' && event.kind !== 'counterLost') {
                continue;
            }
            triggerPlayerCounterEffect(
                event.playerId,
                event.counterName ?? 'counter',
                event.amount,
                event.kind === 'counterGained' ? 'counterGain' : 'counterLoss',
                event.previousValue ?? 0,
                event.currentValue ?? 0
            );
        }
    }, [gameStore.gameView?.players, gameStore.gameView?.step, settings.animationsEnabled, triggerPlayerCounterEffect, updateLifeTotals]);

    // Track combat phase changes to trigger attack animations
    useEffect(() => {
        const currentStep = gameStore.gameView?.step;
        const combat = gameStore.gameView?.combat;

        // Detect transition into combat damage phases
        const isCombatDamageStep = currentStep === 'COMBAT_DAMAGE' || currentStep === 'FIRST_COMBAT_DAMAGE';

        // Reset queue flag if we leave the damage step
        if (!isCombatDamageStep && hasQueuedAttacksRef.current) {
            hasQueuedAttacksRef.current = false;
        }

        // Logic to trigger animations:
        // 1. Must be in a combat damage step
        // 2. Must not have already queued animations for this specific step instance
        // 3. Must have valid combat data
        if (isCombatDamageStep && !hasQueuedAttacksRef.current && combat && combat.length > 0) {
            const attacks: Array<{ attackerId: UUID; targetId: UUID }> = [];

            combat.forEach((group) => {
                const defenderId = group.defenderId;
                if (group.attackers) {
                    Object.values(group.attackers).forEach((attacker) => {
                        attacks.push({
                            attackerId: attacker.id,
                            targetId: defenderId,
                        });
                    });
                }
            });

            if (attacks.length > 0) {
                queueMultipleAttacks(attacks);
                hasQueuedAttacksRef.current = true;
            }
        }

        // Clear animations when we leave combat entirely (cleanup)
        if (previousStepRef.current && !isCombatDamageStep &&
            (previousStepRef.current === 'COMBAT_DAMAGE' || previousStepRef.current === 'FIRST_COMBAT_DAMAGE')) {
            clearAnimationQueue();
        }

        previousStepRef.current = currentStep || null;
    }, [gameStore.gameView?.step, gameStore.gameView?.combat, queueMultipleAttacks, clearAnimationQueue]);

    useEffect(() => {
        if (gameStore.gameView && settings.preloadMatchImages) {
            void cardImageService.preloadGameViewImages(gameStore.gameView);
        }
    }, [gameStore.gameView, settings.preloadMatchImages]);

    useEffect(() => {
        syncRuntimeSettings();
    }, [gameId, syncRuntimeSettings]);

    useEffect(() => {
        if (!gameStore.gameView || !settings.browserAudioUnlocked) {
            audioFeedbackService.stopMatchMusic();
            return;
        }

        audioFeedbackService.startMatchMusic(settings);
        return () => {
            audioFeedbackService.stopMatchMusic();
        };
    }, [
        gameStore.gameView,
        settings.browserAudioUnlocked,
        settings.matchMusicEnabled,
        settings.masterVolume,
        settings.musicVolume,
        settings.reducedAudioMode,
    ]);

    const handleConfirmCurrentRequest = React.useCallback(async () => {
        if (isPlayerControlLocked()) {
            return;
        }

        const pendingType = useGameStore.getState().pendingAction.type;
        if (pendingType !== 'none') {
            if (pendingType === 'priority') {
                await actions.sendBoolean(false);
                return;
            }
            await actions.sendBoolean(true);
            return;
        }

        await actions.passPriority();
    }, [actions.passPriority, actions.sendBoolean, isPlayerControlLocked]);

    const handleUseFirstManaAbilityStart = React.useCallback(async () => {
        if (isPlayerControlLocked()) {
            return;
        }

        await actions.sendPlayerAction('USE_FIRST_MANA_ABILITY_ON');
    }, [actions.sendPlayerAction, isPlayerControlLocked]);

    const handleUseFirstManaAbilityEnd = React.useCallback(async () => {
        if (isPlayerControlLocked()) {
            return;
        }

        await actions.sendPlayerAction('USE_FIRST_MANA_ABILITY_OFF');
    }, [actions.sendPlayerAction, isPlayerControlLocked]);

    const handleSwitchChat = React.useCallback(() => {
        const input = document.querySelector<HTMLInputElement>('.chat-panel.expanded .chat-input:not(:disabled), .chat-input:not(:disabled)');
        input?.focus();
    }, []);

    const handleToggleMacro = React.useCallback(async () => {
        if (isPlayerControlLocked()) {
            return;
        }

        await actions.sendPlayerAction('TOGGLE_RECORD_MACRO');
    }, [actions.sendPlayerAction, isPlayerControlLocked]);

    const handleSidebarToggle = React.useCallback(() => {
        setSidebarOpen((open) => {
            const nextOpen = !open;
            if (settings.persistPanelLayout) {
                const currentLayout = appConfigService.loadPanelLayoutConfig();
                appConfigService.savePanelLayoutConfig({
                    ...currentLayout,
                    game: {
                        ...currentLayout.game,
                        sidebarOpen: nextOpen,
                    },
                });
            }
            return nextOpen;
        });
    }, [settings.persistPanelLayout]);

    const guardPlayerControl = React.useCallback((handler: () => Promise<void>) => {
        if (isPlayerControlLocked()) {
            return;
        }

        void handler();
    }, [isPlayerControlLocked]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keybindService.handleKeyDown(e);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keybindService.handleKeyUp(e);
        };

        const keybinds = settings.keybinds;
        const bind = (definition: KeybindDefinition) => (
            definition.actionId ? applyClientKeybind(definition, keybinds[definition.actionId]) : definition
        );
        const definitions = [
            bind({ id: 'confirm-request', actionId: 'confirm', label: 'Confirm current request', key: 'F2', handler: handleConfirmCurrentRequest }),
            bind({ id: 'cancel-skip', actionId: 'cancelSkip', label: 'Cancel active skip action', key: 'F3', handler: () => guardPlayerControl(actions.cancelPassActions) }),
            bind({ id: 'pass-next-turn', actionId: 'nextTurn', label: 'Until Next Turn', key: 'F4', handler: () => guardPlayerControl(actions.passPriorityUntilNextTurn) }),
            bind({ id: 'pass-end-step', actionId: 'endStep', label: 'Until End Step', key: 'F5', handler: () => guardPlayerControl(actions.passPriorityUntilEndOfTurn) }),
            bind({ id: 'pass-next-turn-skip-stack', actionId: 'skipStep', label: 'Until Next Turn, Skip Stack', key: 'F6', handler: () => guardPlayerControl(actions.passPriorityUntilNextTurnSkipStack) }),
            bind({ id: 'pass-next-main', actionId: 'mainStep', label: 'Until Next Main', key: 'F7', handler: () => guardPlayerControl(actions.passPriorityUntilNextMain) }),
            bind({ id: 'pass-my-turn', actionId: 'yourTurn', label: 'Until My Turn', key: 'F9', handler: () => guardPlayerControl(actions.passPriorityUntilMyNextTurn) }),
            bind({ id: 'pass-stack', actionId: 'skipStack', label: 'Until Stack Resolved', key: 'F10', handler: () => guardPlayerControl(actions.passPriorityUntilStackResolved) }),
            bind({ id: 'pass-prior-end-step', actionId: 'priorEndStep', label: 'Until End Step Before My Turn', key: 'F11', handler: () => guardPlayerControl(actions.passPriorityUntilEndStepBeforeMyTurn) }),
            bind({ id: 'switch-chat', actionId: 'switchChat', label: 'Focus chat input', key: 'Enter', ctrlOrMeta: true, handler: handleSwitchChat }),
            bind({ id: 'toggle-macro', actionId: 'toggleMacro', label: 'Toggle macro recording', key: 'm', ctrlOrMeta: true, handler: () => guardPlayerControl(handleToggleMacro) }),
            bind({
                id: 'use-first-mana-ability-hold',
                actionId: 'holdFirstMana',
                label: 'Hold first mana ability',
                key: '1',
                altKey: true,
                ignoreRepeat: true,
                handler: handleUseFirstManaAbilityStart,
            }),
            bind({
                id: 'use-first-mana-ability-release',
                actionId: 'holdFirstMana',
                label: 'Release first mana ability',
                key: '1',
                eventType: 'keyup',
                altKey: true,
                handler: handleUseFirstManaAbilityEnd,
            }),
            {
                id: 'cancel',
                label: 'Cancel',
                key: 'Escape',
                handler: () => {
                    if (debugModeOpen) {
                        setDebugModeOpen(false);
                    } else if (!isPlayerControlLocked()) {
                        void actions.cancelPassActions();
                    }
                },
            },
            bind({
                id: 'debug-mode',
                actionId: 'debugMode',
                label: 'Debug Mode',
                key: 'd',
                ctrlOrMeta: true,
                handler: () => {
                    toggleDebugMode();
                    setDebugModeOpen((open) => !open);
                },
            }),
        ].map(definition => definition?.id === 'use-first-mana-ability-release' && definition.actionId
            ? { ...definition, eventType: 'keyup' as const }
            : definition
        ).filter((definition): definition is KeybindDefinition => definition !== null);

        const unregister = keybindService.registerMany(definitions);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            unregister();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [
        actions.passPriority,
        actions.sendBoolean,
        actions.sendPlayerAction,
        actions.passPriorityUntilEndOfTurn,
        actions.passPriorityUntilNextTurnSkipStack,
        actions.passPriorityUntilNextMain,
        actions.passPriorityUntilStackResolved,
        actions.passPriorityUntilNextTurn,
        actions.passPriorityUntilMyNextTurn,
        actions.passPriorityUntilEndStepBeforeMyTurn,
        actions.cancelPassActions,
        debugModeOpen,
        guardPlayerControl,
        handleConfirmCurrentRequest,
        handleSwitchChat,
        handleToggleMacro,
        handleUseFirstManaAbilityEnd,
        handleUseFirstManaAbilityStart,
        isPlayerControlLocked,
        settings.keybinds,
        toggleDebugMode,
    ]);

    const handleLeave = React.useCallback(async () => {
        await actions.leaveGame();
        onLeave();
    }, [actions.leaveGame, onLeave]);

    const handleConcedeGame = React.useCallback(async () => {
        await actions.concede();
    }, [actions.concede]);

    const handleManaClick = React.useCallback(async (manaType: ManaType) => {
        if (isPlayerControlLocked()) {
            return;
        }

        await actions.sendManaType(manaType);
    }, [actions.sendManaType, isPlayerControlLocked]);

    const handleCardClick = React.useCallback((cardId: string, options: BattlefieldCardClickOptions = {}) => {
        if (isPlayerControlLocked()) {
            return;
        }

        console.log('Card clicked:', cardId);
        // By default, just sending UUID to server handles most interactions 
        // (casting, activating, targeting) if the server state expects it.
        void (async () => {
            if (options.holdPriority) {
                await actions.sendPlayerAction('HOLD_PRIORITY');
            }
            await actions.sendUUID(cardId);
        })();
    }, [actions.sendPlayerAction, actions.sendUUID, isPlayerControlLocked]);

    React.useEffect(() => {
        const findHandCardAtPoint = (clientX: number, clientY: number): HTMLElement | null => {
            const pointElements = document.elementsFromPoint(clientX, clientY);
            for (const element of pointElements) {
                const handCard = element.closest<HTMLElement>('[data-testid="hand-card"][data-card-id]');
                if (handCard) {
                    return handCard;
                }
            }

            const handCards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="hand-card"][data-card-id]'));
            return handCards
                .filter((element) => {
                    const rect = element.getBoundingClientRect();
                    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
                })
                .sort((left, right) => {
                    const leftZ = Number.parseInt(window.getComputedStyle(left).zIndex || '0', 10);
                    const rightZ = Number.parseInt(window.getComputedStyle(right).zIndex || '0', 10);
                    return (Number.isFinite(rightZ) ? rightZ : 0) - (Number.isFinite(leftZ) ? leftZ : 0);
                })[0] ?? null;
        };

        const handleDocumentClick = (event: MouseEvent) => {
            if (event.button !== 0 || isPlayerControlLocked()) {
                return;
            }

            const pendingType = useGameStore.getState().pendingAction.type;
            if (pendingType !== 'target' && pendingType !== 'select' && pendingType !== 'priority') {
                return;
            }

            const targetElement = event.target instanceof Element ? event.target : null;
            const clickedHandCard = targetElement?.closest<HTMLElement>('[data-testid="hand-card"][data-card-id]') ?? null;
            if (targetElement?.closest('[data-testid="game-feedback-panel"], [data-testid="priority-next-button"], [data-testid="priority-skip-toggle"], button, input, select, textarea, a')) {
                return;
            }

            const handCard = clickedHandCard ?? findHandCardAtPoint(event.clientX, event.clientY);
            const cardId = handCard?.dataset.cardId;
            if (!cardId) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            handleCardClick(cardId);
        };

        document.addEventListener('click', handleDocumentClick, true);
        return () => document.removeEventListener('click', handleDocumentClick, true);
    }, [handleCardClick, isPlayerControlLocked]);

    const findCardById = React.useCallback((cardId: string): CardView | PermanentView | null => {
        const { gameView, getMyPlayer, getOpponents } = useGameStore.getState();

        if (!gameView) return null;

        // Find card in hand
        let card = gameView.myHand ? gameView.myHand[cardId] : undefined;

        // Find in stack
        if (!card && gameView.stack) {
            card = gameView.stack[cardId];
        }

        // Find in battlefield
        if (!card) {
            // Check my battlefield
            const me = getMyPlayer();
            if (me && me.battlefield) {
                card = me.battlefield[cardId];
            }

            // Check opponents battlefield
            if (!card) {
                const opponents = getOpponents();
                for (const opp of opponents) {
                    if (opp.battlefield && opp.battlefield[cardId]) {
                        card = opp.battlefield[cardId];
                        break;
                    }
                }
            }
        }

        return card ?? null;
    }, []);

    const handleCardInspect = React.useCallback((cardId: string, mode: BattlefieldInspectMode = 'normal') => {
        const card = findCardById(cardId);
        if (card) {
            setHoverPreviewCard(null);
            if (mode === 'copy' && 'original' in card && card.original) {
                setPreviewInitialFace('front');
                setPreviewCard(card.original);
                return;
            }
            setPreviewInitialFace(mode === 'alternate' ? 'back' : 'front');
            setPreviewCard(card);
        }
    }, [findCardById, setPreviewCard]);

    const handleCardHover = React.useCallback((cardId: string | null) => {
        if (hoverPreviewTimerRef.current !== null) {
            window.clearTimeout(hoverPreviewTimerRef.current);
            hoverPreviewTimerRef.current = null;
        }

        if (!cardId || previewCard) {
            setHoverPreviewCard(null);
            return;
        }

        hoverPreviewTimerRef.current = window.setTimeout(() => {
            setHoverPreviewCard(findCardById(cardId));
            hoverPreviewTimerRef.current = null;
        }, settings.tooltipDelayMs);
    }, [findCardById, previewCard, settings.tooltipDelayMs]);

    const getHoverPreviewImageCard = React.useCallback((card: CardView | PermanentView): CardView | PermanentView => {
        if (isStackAbilityCard(card)) {
            return card.sourceCard;
        }

        return card;
    }, []);

    const getHoverPreviewImageUrl = React.useCallback((card: CardView | PermanentView): string => {
        return cardImageService.getImageUrl(getHoverPreviewImageCard(card));
    }, [getHoverPreviewImageCard]);

    useEffect(() => {
        return () => {
            if (hoverPreviewTimerRef.current !== null) {
                window.clearTimeout(hoverPreviewTimerRef.current);
            }
        };
    }, []);

    if (!gameStore.gameView) {
        return (
            <div className="game-loading" data-testid="game-loading">
                <div className="loading-spinner"></div>
                <p>Waiting for game data...</p>
                <Button onClick={handleLeave} variant="ghost">Cancel</Button>
            </div>
        );
    }

    const myPlayer = useGameStore.getState().getMyPlayer();
    const opponents = useGameStore.getState().getOpponents();
    const orientedOpponents = orientOpponents(opponents, gameStore.gameView?.activePlayerId, settings.matchSeatOrientation);
    const opponentLayoutClass = [
        'arena-opponents-grid',
        `arena-opponents-${Math.min(Math.max(orientedOpponents.length, 1), 4)}`,
        orientedOpponents.length > 1 ? 'arena-opponents-with-phase-offset' : '',
    ].filter(Boolean).join(' ');

    // Determine Turn label - if it's my turn
    const isMyTurn = gameStore.gameView.activePlayerId === myPlayer?.playerId;

    // Determine if we should show result modal
    const hasLeft = myPlayer?.hasLeft;
    // We show the modal if:
    // 1. Game officially ended (gameEnded is true)
    // 2. OR we have left/lost the game (hasLeft is true)
    // AND the user hasn't explicitly closed it to spectate.
    const showResultModal = (gameStore.gameEnded || hasLeft) && !resultModalClosed;

    return (
        <div className="game-page arena-layout" data-testid="game-page">
            <CombatOverlay />
            <AttackAnimation />
            <DamageEffects />
            <SkipIndicator activeSkip={gameStore.activeSkip} onCancel={actions.cancelPassActions} />
            {previewCard && (
                <CardPreviewModal
                    card={previewCard}
                    initialFace={previewInitialFace ?? undefined}
                    onClose={() => {
                        setPreviewCard(null);
                        setPreviewInitialFace(null);
                    }}
                />
            )}
            {hoverPreviewCard && !previewCard && (
                <div className="match-hover-preview" data-testid="match-hover-preview" aria-hidden="true">
                    <img
                        src={getHoverPreviewImageUrl(hoverPreviewCard)}
                        alt=""
                        draggable={false}
                        onError={(event) => {
                            event.currentTarget.src = cardImageService.getFallbackImageUrl(
                                getHoverPreviewImageCard(hoverPreviewCard),
                                settings.cardImageFallbackMode
                            );
                        }}
                    />
                </div>
            )}

            {/* Dialogs */}
            {gameStore.pendingAction.type === 'chooseAbility' && (
                <AbilityPickerDialog
                    data={gameStore.pendingAction.abilities}
                />
            )}

            {(gameStore.pendingAction.type === 'mana' || gameStore.pendingAction.type === 'xmana') && (
                <ManaPaymentDialog
                    isOpen={true}
                    message={gameStore.pendingAction.message}
                />
            )}



            {gameStore.pendingAction.type === 'chooseChoice' && (
                <ChoiceDialog
                    isOpen={true}
                    message={gameStore.pendingAction.message}
                    choices={gameStore.pendingAction.choices}
                    keyChoices={gameStore.pendingAction.keyChoices}
                    hintData={gameStore.pendingAction.hintData}
                    hintType={gameStore.pendingAction.hintType}
                    required={gameStore.pendingAction.required}
                    specialEnabled={gameStore.pendingAction.specialEnabled}
                    specialCanBeEmpty={gameStore.pendingAction.specialCanBeEmpty}
                    specialText={gameStore.pendingAction.specialText}
                    specialHint={gameStore.pendingAction.specialHint}
                    searchEnabled={gameStore.pendingAction.searchEnabled}
                    manaColorChoice={gameStore.pendingAction.manaColorChoice}
                />
            )}

            {gameStore.pendingAction.type === 'amount' && (
                <AmountDialog
                    isOpen={true}
                    message={gameStore.pendingAction.message}
                    min={gameStore.pendingAction.min}
                    max={gameStore.pendingAction.max}
                />
            )}

            {gameStore.pendingAction.type === 'multiAmount' && (
                <MultiAmountDialog
                    isOpen={true}
                    messages={gameStore.pendingAction.messages}
                    min={gameStore.pendingAction.min}
                    max={gameStore.pendingAction.max}
                />
            )}

            {gameStore.pendingAction.type === 'choosePile' && (
                <PileDialog
                    isOpen={true}
                    message={gameStore.pendingAction.message}
                    pile1={gameStore.pendingAction.pile1}
                    pile2={gameStore.pendingAction.pile2}
                />
            )}

            {/* Show Cards / Zone View Dialog */}
            {gameStore.showingZone && (
                <CardSelectorDialog
                    isOpen={true}
                    pendingAction={gameStore.pendingAction.type === 'target' || gameStore.pendingAction.type === 'select' ? gameStore.pendingAction : undefined}
                    showingZone={gameStore.showingZone || undefined}
                    showingPlayerId={gameStore.showingPlayerId || undefined}
                    onClose={() => {
                        actions.showZone(null);
                    }}
                />
            )}

            {/* Show CardSelectorDialog for target/select with cardsView (e.g., discard from hand) */}
            {!gameStore.showingZone &&
                (gameStore.pendingAction.type === 'target' || gameStore.pendingAction.type === 'select') &&
                (
                    ((gameStore.pendingAction as any).cardsView && Object.keys((gameStore.pendingAction as any).cardsView).length > 0) ||
                    (gameStore.pendingAction.type === 'target' && gameStore.gameView?.players?.some((player) => (
                        gameStore.pendingAction.type === 'target' && gameStore.pendingAction.validTargets.includes(player.playerId)
                    )))
                ) && (
                    <CardSelectorDialog
                        isOpen={true}
                        pendingAction={gameStore.pendingAction}
                        onClose={() => {
                            if (!(gameStore.pendingAction as any).required) {
                                void actions.sendUUID(null);
                            }
                        }}
                    />
                )}

            {/* Sideboard Dialog (unchanged) */}
            {gameStore.pendingAction.type === 'sideboarding' && (
                <SideboardDialog
                    isOpen={true}
                    deck={gameStore.pendingAction.deck}
                    onClose={() => {
                        console.log('Closing sideboard dialog not fully supported yet');
                    }}
                    onSubmit={(deck) => {
                        if (gameStore.pendingAction.type === 'sideboarding') {
                            actions.submitDeck(gameStore.pendingAction.tableId, deck);
                        }
                    }}
                />
            )}

            <div className="game-feedback-overlay">
                <FeedbackPanel />
            </div>

            {/* ===== ARENA LAYOUT ===== */}
            <div className="arena-battlefield-area" data-testid="arena-battlefield">
                {/* Opponent Area (Top) */}
                <div
                    className={opponentLayoutClass}
                    data-testid="arena-opponents-grid"
                    data-seat-orientation={settings.matchSeatOrientation}
                >
                    {orientedOpponents.map((p, index) => (
                        <div key={p.playerId} className="arena-opponent-area" data-seat-index={index} data-player-id={p.playerId}>
                            <ArenaOpponentHUD
                                player={p}
                                isActivePlayer={gameStore.gameView?.activePlayerId === p.playerId}
                                onShowZone={actions.showZone}
                                onInteract={handleCardClick}
                                showPlayerName={settings.alwaysShowPlayerNames}
                                displayLifeOnAvatar={settings.displayLifeOnAvatar}
                            />
                            <Battlefield
                                player={p}
                                onCardClick={handleCardClick}
                                onCardInspect={handleCardInspect}
                                onCardHover={handleCardHover}
                                isMe={false}
                            />
                        </div>
                    ))}
                </div>

                {/* Player Area (Bottom) */}
                {myPlayer && (
                    <div className="arena-player-area">
                        <Battlefield
                            player={myPlayer}
                            isMe
                            onCardClick={handleCardClick}
                            onCardInspect={handleCardInspect}
                            onCardHover={handleCardHover}
                        />
                    </div>
                )}
            </div>

            {/* Player HUD Overlay (fixed position) */}
            {myPlayer && (
                <ArenaPlayerHUD
                    player={myPlayer}
                    isMe
                    isActivePlayer={isMyTurn}
                    onShowZone={actions.showZone}
                    onInteract={handleCardClick}
                    onManaClick={handleManaClick}
                    showPlayerName={settings.alwaysShowPlayerNames}
                    displayLifeOnAvatar={settings.displayLifeOnAvatar}
                />
            )}

            {/* Hand (fixed position at bottom) */}
            {myPlayer && (
                <div className="arena-hand-area" data-testid="arena-hand">
                    <Hand
                        hand={gameStore.gameView.myHand}
                        onCardClick={handleCardClick}
                        onCardInspect={handleCardInspect}
                    />
                </div>
            )}

            {/* Stack (Right side, fanned out) */}
            <ArenaStack
                stack={gameStore.gameView.stack}
                onCardClick={handleCardClick}
                onCardInspect={handleCardInspect}
                onCardHover={handleCardHover}
            />

            {/* Arena-style Priority Controls (bottom-right) */}
            {myPlayer && !gameStore.isWatching && (
                <ArenaPriorityControls
                    hasPriority={myPlayer.hasPriority}
                    isMyTurn={isMyTurn}
                    currentPhase={gameStore.gameView.step}
                    skipEnabled={gameStore.arenaSkipEnabled}
                    onToggleSkip={actions.toggleArenaSkip}
                />
            )}

            {/* Phase Indicator (Top right corner) */}
            <div className="game-phase-region" data-testid="game-phase-region">
                <PhaseIndicator turn={gameStore.gameView.turn} step={gameStore.gameView.step} />
                <div className="turn-indicator" style={{
                    marginTop: 8,
                    padding: '4px 12px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: isMyTurn ? '#22c55e' : '#94a3b8',
                    textAlign: 'center'
                }}>
                    {isMyTurn ? "Your Turn" : `${gameStore.gameView?.activePlayerName || orientedOpponents.find(p => p.playerId === gameStore.gameView?.activePlayerId)?.name || 'Unknown'}'s Turn`}
                </div>
            </div>

            {/* Sidebar Toggle */}
            <button
                className={`arena-sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
                onClick={handleSidebarToggle}
                aria-label={sidebarOpen ? 'Close game sidebar' : 'Open game sidebar'}
                data-testid="game-sidebar-toggle"
            >
                {sidebarOpen ? '▶' : '◀'}
            </button>

            {/* Collapsible Sidebar */}
            <aside className={`arena-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h4 className="sidebar-title">
                        Game Info
                    </h4>
                </div>

                <div className="sidebar-content">
                    <MatchZonePanel
                        gameView={gameStore.gameView}
                        onShowZone={actions.showZone}
                    />
                </div>

                <div className="sidebar-content">
                    <MatchActionPanel
                        players={gameStore.gameView.players}
                        myPlayerId={gameStore.gameView.myPlayerId}
                        isWatching={gameStore.isWatching}
                        isReplay={isReplay}
                        rollbackTurnsAllowed={gameStore.gameView.rollbackTurnsAllowed}
                        rangeOfInfluence={gameStore.gameView.rangeOfInfluence}
                        attackOption={gameStore.gameView.attackOption}
                    />
                </div>

                <div className="sidebar-content keyboard-shortcuts">
                    <h4>Shortcuts</h4>
                    <div className="shortcut-list">
                        <div className="shortcut-item">
                            <kbd>F2</kbd> <span>Confirm</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F3</kbd> <span>Cancel Skip</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F4</kbd> <span>Next Turn</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F5</kbd> <span>End Step</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F6</kbd> <span>Next Turn, Skip Stack</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F7</kbd> <span>Next Main</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F9</kbd> <span>Until My Turn</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F10</kbd> <span>Stack Resolved</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F11</kbd> <span>Prior End Step</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>Alt+1</kbd> <span>Hold First Mana</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>ESC</kbd> <span>Cancel</span>
                        </div>
                    </div>
                </div>

                <div className="sidebar-chat-panel">
                    <MatchLogPanel
                        gameId={gameStore.gameView ? gameId : null}
                        gameView={gameStore.gameView}
                        lastMessage={gameStore.lastMessage}
                        lastError={gameStore.lastError}
                    />
                    <ChatPanel />
                </div>

                <div className="sidebar-footer">
                    <Button
                        onClick={handleConcedeGame}
                        variant="danger"
                        size="sm"
                        className="sidebar-concede-button"
                        data-testid="game-concede-game-button"
                    >
                        Concede Game
                    </Button>
                    <Button onClick={handleLeave} variant="secondary" size="sm" className="sidebar-leave-button">
                        Concede / Leave
                    </Button>
                </div>
            </aside>

            {/* Game Over Modal */}
            {showResultModal && (
                <ResultModal
                    gameEndView={gameStore.gameEndView}
                    endGameInfo={gameStore.endGameInfo}
                    onLeave={handleLeave}
                    onClose={() => setResultModalClosed(true)}
                    hasLost={hasLeft}
                />
            )}

            {/* Debug Mode */}
            {debugModeOpen && config.enabled && (
                <DebugMode onClose={() => setDebugModeOpen(false)} />
            )}
        </div>
    );
};
