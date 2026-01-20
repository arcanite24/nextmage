import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, useSessionStore, useChatStore, useDebugStore } from '../../stores';
import { Button } from '../common';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { ArenaPlayerHUD } from './ArenaPlayerHUD';
import { ArenaOpponentHUD } from './ArenaOpponentHUD';
import { ArenaStack } from './ArenaStack';
import { PhaseIndicator } from './PhaseIndicator';
import { FeedbackPanel } from './FeedbackPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { CombatOverlay } from './CombatOverlay';
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
import { cardImageService } from '../../services/CardImageService';
import { DebugMode } from '../debug/DebugMode';
import './GamePage.css';
import './ArenaLayout.css';

interface GamePageProps {
    gameId: string;
    onLeave: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ gameId, onLeave }) => {
    const gameStore = useGameStore(useShallow(state => ({
        gameView: state.gameView,
        isLoading: state.isLoading,
        gameEnded: state.gameEnded,
        gameEndView: state.gameEndView,
        endGameInfo: state.endGameInfo,
        pendingAction: state.pendingAction,
        activeSkip: state.activeSkip,
        showingZone: state.showingZone,
        showingPlayerId: state.showingPlayerId,
        arenaSkipEnabled: state.arenaSkipEnabled
    })));

    const actions = useGameStore(useShallow(state => ({
        leaveGame: state.leaveGame,
        sendUUID: state.sendUUID,
        passPriority: state.passPriority,
        passPriorityUntilEndOfTurn: state.passPriorityUntilEndOfTurn,
        passPriorityUntilNextMain: state.passPriorityUntilNextMain,
        passPriorityUntilStackResolved: state.passPriorityUntilStackResolved,
        passPriorityUntilNextTurn: state.passPriorityUntilNextTurn,
        cancelPassActions: state.cancelPassActions,
        showZone: state.showZone,
        submitDeck: state.submitDeck,
        sendPlayerAction: state.sendPlayerAction,
        toggleArenaSkip: state.toggleArenaSkip
    })));

    const { config, toggleDebugMode } = useDebugStore();
    const [previewCard, setPreviewCard] = React.useState<any>(null);
    const [resultModalClosed, setResultModalClosed] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [debugModeOpen, setDebugModeOpen] = useState(false);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case 'F2':
                    e.preventDefault();
                    actions.passPriority();
                    break;
                case 'F4':
                    e.preventDefault();
                    actions.passPriorityUntilEndOfTurn();
                    break;
                case 'F5':
                    e.preventDefault();
                    actions.passPriorityUntilNextMain();
                    break;
                case 'F7':
                    e.preventDefault();
                    actions.passPriorityUntilStackResolved();
                    break;
                case 'F9':
                    e.preventDefault();
                    actions.passPriorityUntilNextTurn();
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (debugModeOpen) {
                        setDebugModeOpen(false);
                    } else {
                        actions.cancelPassActions();
                    }
                    break;
                case 'd':
                case 'D':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        toggleDebugMode();
                        setDebugModeOpen(!debugModeOpen);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions.passPriority, actions.passPriorityUntilEndOfTurn, actions.passPriorityUntilNextMain, actions.passPriorityUntilStackResolved, actions.passPriorityUntilNextTurn, actions.cancelPassActions]);

    const handleLeave = React.useCallback(async () => {
        await actions.leaveGame();
        onLeave();
    }, [actions.leaveGame, onLeave]);


    const handleCardClick = React.useCallback((cardId: string) => {
        console.log('Card clicked:', cardId);
        // By default, just sending UUID to server handles most interactions 
        // (casting, activating, targeting) if the server state expects it.
        actions.sendUUID(cardId);
    }, [actions.sendUUID]);

    const handleCardInspect = React.useCallback((cardId: string) => {
        // We need current gameView to inspect. 
        // We can't put gameView in dependency array effectively if it changes too much.
        // But preventing the function recreation helps Battlefield memo.
        // To do this safely, we might need a ref to gameView OR just accept that if gameView changes, we re-create this.
        // However, Battlefield re-renders on gameView props anyway?
        // Actually, preventing 'handleCardClick' (which doesn't depend on gameView) from changing is a win.
        // For 'handleCardInspect', we need gameView.
        // Let's rely on useGameStore.getState() inside the callback to keep it stable!
        const { gameView, getMyPlayer, getOpponents } = useGameStore.getState();

        if (!gameView) return;

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

        if (card) {
            setPreviewCard(card);
        }
    }, [setPreviewCard]); // Dependency array is now super stable!


    if (!gameStore.gameView) {
        return (
            <div className="game-loading">
                <div className="loading-spinner"></div>
                <p>Waiting for game data...</p>
                <Button onClick={handleLeave} variant="ghost">Cancel</Button>
            </div>
        );
    }

    const myPlayer = useGameStore.getState().getMyPlayer();
    const opponents = useGameStore.getState().getOpponents();

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
        <div className="game-page arena-layout">
            <CombatOverlay />
            <SkipIndicator activeSkip={gameStore.activeSkip} onCancel={actions.cancelPassActions} />
            {previewCard && (
                <CardPreviewModal
                    card={previewCard}
                    onClose={() => setPreviewCard(null)}
                />
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
                    specialEnabled={gameStore.pendingAction.specialEnabled}
                    specialText={gameStore.pendingAction.specialText}
                    specialHint={gameStore.pendingAction.specialHint}
                    searchEnabled={gameStore.pendingAction.searchEnabled}
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

            {/* Sideboard Dialog (unchanged) */}
            {gameStore.pendingAction.type === 'sideboarding' && (
                <SideboardDialog
                    isOpen={true}
                    deck={gameStore.pendingAction.deck}
                    onClose={() => {
                        console.log('Closing sideboard dialog not fully supported yet');
                    }}
                    onSubmit={(deck) => {
                        actions.submitDeck(gameStore.pendingAction.tableId, deck);
                    }}
                />
            )}

            <div className="game-feedback-overlay">
                <FeedbackPanel />
            </div>

            {/* ===== ARENA LAYOUT ===== */}
            <div className="arena-battlefield-area">
                {/* Opponent Area (Top) */}
                {opponents.map(p => (
                    <div key={p.playerId} className="arena-opponent-area">
                        <ArenaOpponentHUD
                            player={p}
                            onShowZone={actions.showZone}
                            onInteract={handleCardClick}
                        />
                        <Battlefield
                            player={p}
                            onCardClick={handleCardClick}
                            onCardInspect={handleCardInspect}
                            isMe={false}
                        />
                    </div>
                ))}

                {/* Player Area (Bottom) */}
                {myPlayer && (
                    <div className="arena-player-area">
                        <Battlefield
                            player={myPlayer}
                            isMe
                            onCardClick={handleCardClick}
                            onCardInspect={handleCardInspect}
                        />
                    </div>
                )}
            </div>

            {/* Player HUD Overlay (fixed position) */}
            {myPlayer && (
                <ArenaPlayerHUD
                    player={myPlayer}
                    isMe
                    onShowZone={actions.showZone}
                    onInteract={handleCardClick}
                />
            )}

            {/* Hand (fixed position at bottom) */}
            {myPlayer && (
                <div className="arena-hand-area">
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
            />

            {/* Arena-style Priority Controls (bottom-right) */}
            {myPlayer && (
                <ArenaPriorityControls
                    hasPriority={myPlayer.hasPriority}
                    isMyTurn={isMyTurn}
                    currentPhase={gameStore.gameView.step}
                    skipEnabled={gameStore.arenaSkipEnabled}
                    onToggleSkip={actions.toggleArenaSkip}
                />
            )}

            {/* Phase Indicator (Top right corner) */}
            <div style={{
                position: 'fixed',
                top: 10,
                right: 20,
                zIndex: 100
            }}>
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
                    {isMyTurn ? "Your Turn" : `${gameStore.gameView.activePlayerName || opponents.find(p => p.playerId === gameStore.gameView.activePlayerId)?.name || 'Unknown'}'s Turn`}
                </div>
            </div>

            {/* Sidebar Toggle */}
            <button
                className={`arena-sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(!sidebarOpen)}
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

                <div className="sidebar-content keyboard-shortcuts">
                    <h4>Shortcuts</h4>
                    <div className="shortcut-list">
                        <div className="shortcut-item">
                            <kbd>F2</kbd> <span>Pass Priority</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F4</kbd> <span>Until End of Turn</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F5</kbd> <span>Until Next Main</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F7</kbd> <span>Until Stack Resolved</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F9</kbd> <span>Until My Turn</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>ESC</kbd> <span>Cancel</span>
                        </div>
                    </div>
                </div>

                <div className="sidebar-chat-panel">
                    <ChatPanel />
                </div>

                <div className="sidebar-footer">
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
