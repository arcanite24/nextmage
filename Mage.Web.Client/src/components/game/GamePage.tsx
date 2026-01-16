import React, { useEffect, useState } from 'react';
import { useGameStore, useSessionStore, useChatStore } from '../../stores';
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
import './GamePage.css';
import './ArenaLayout.css';

interface GamePageProps {
    gameId: string;
    onLeave: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ gameId, onLeave }) => {
    const {
        gameView,
        isLoading,
        leaveGame,
        getMyPlayer,
        getOpponents,
        sendUUID,
        gameEnded,
        gameEndView,
        endGameInfo,
        passPriority,
        passPriorityUntilEndOfTurn,
        passPriorityUntilNextMain,
        passPriorityUntilStackResolved,
        passPriorityUntilNextTurn,
        cancelPassActions,
        pendingAction,
        activeSkip,
        showingZone,
        showZone,
        submitDeck,
        showingPlayerId,
        sendPlayerAction,
        toggleArenaSkip,
        arenaSkipEnabled
    } = useGameStore();

    const [previewCard, setPreviewCard] = React.useState<any>(null);
    const [resultModalClosed, setResultModalClosed] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    passPriority();
                    break;
                case 'F4':
                    e.preventDefault();
                    passPriorityUntilEndOfTurn();
                    break;
                case 'F5':
                    e.preventDefault();
                    passPriorityUntilNextMain();
                    break;
                case 'F7':
                    e.preventDefault();
                    passPriorityUntilStackResolved();
                    break;
                case 'F9':
                    e.preventDefault();
                    passPriorityUntilNextTurn();
                    break;
                case 'Escape':
                    e.preventDefault();
                    cancelPassActions();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [passPriority, passPriorityUntilEndOfTurn, passPriorityUntilNextMain, passPriorityUntilStackResolved, passPriorityUntilNextTurn, cancelPassActions]);

    const handleLeave = async () => {
        await leaveGame();
        onLeave();
    };


    const handleCardClick = (cardId: string) => {
        console.log('Card clicked:', cardId);
        // By default, just sending UUID to server handles most interactions 
        // (casting, activating, targeting) if the server state expects it.
        sendUUID(cardId);
    };

    const handleCardInspect = (cardId: string) => {
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
    };

    if (!gameView) {
        return (
            <div className="game-loading">
                <div className="loading-spinner"></div>
                <p>Waiting for game data...</p>
                <Button onClick={handleLeave} variant="ghost">Cancel</Button>
            </div>
        );
    }

    const myPlayer = getMyPlayer();
    const opponents = getOpponents();

    // Determine Turn label - if it's my turn
    const isMyTurn = gameView.activePlayerId === myPlayer?.playerId;

    // Determine if we should show result modal
    const hasLeft = myPlayer?.hasLeft;
    // We show the modal if:
    // 1. Game officially ended (gameEnded is true)
    // 2. OR we have left/lost the game (hasLeft is true)
    // AND the user hasn't explicitly closed it to spectate.
    const showResultModal = (gameEnded || hasLeft) && !resultModalClosed;

    return (
        <div className="game-page arena-layout">
            <CombatOverlay />
            <SkipIndicator activeSkip={activeSkip} onCancel={cancelPassActions} />
            {previewCard && (
                <CardPreviewModal
                    card={previewCard}
                    onClose={() => setPreviewCard(null)}
                />
            )}

            {/* Dialogs */}
            {pendingAction.type === 'chooseAbility' && (
                <AbilityPickerDialog
                    data={pendingAction.abilities}
                />
            )}

            {(pendingAction.type === 'mana' || pendingAction.type === 'xmana') && (
                <ManaPaymentDialog
                    isOpen={true}
                    message={pendingAction.message}
                />
            )}



            {pendingAction.type === 'chooseChoice' && (
                <ChoiceDialog
                    isOpen={true}
                    message={pendingAction.message}
                    choices={pendingAction.choices}
                    keyChoices={pendingAction.keyChoices}
                    hintData={pendingAction.hintData}
                    hintType={pendingAction.hintType}
                    specialEnabled={pendingAction.specialEnabled}
                    specialText={pendingAction.specialText}
                    specialHint={pendingAction.specialHint}
                    searchEnabled={pendingAction.searchEnabled}
                />
            )}

            {pendingAction.type === 'amount' && (
                <AmountDialog
                    isOpen={true}
                    message={pendingAction.message}
                    min={pendingAction.min}
                    max={pendingAction.max}
                />
            )}

            {pendingAction.type === 'multiAmount' && (
                <MultiAmountDialog
                    isOpen={true}
                    messages={pendingAction.messages}
                    min={pendingAction.min}
                    max={pendingAction.max}
                />
            )}

            {pendingAction.type === 'choosePile' && (
                <PileDialog
                    isOpen={true}
                    message={pendingAction.message}
                    pile1={pendingAction.pile1}
                    pile2={pendingAction.pile2}
                />
            )}

            {/* Show Cards / Zone View Dialog */}
            {showingZone && (
                <CardSelectorDialog
                    isOpen={true}
                    pendingAction={pendingAction.type === 'target' || pendingAction.type === 'select' ? pendingAction : undefined}
                    showingZone={showingZone || undefined}
                    showingPlayerId={showingPlayerId || undefined}
                    onClose={() => {
                        showZone(null);
                    }}
                />
            )}

            {/* Sideboard Dialog (unchanged) */}
            {pendingAction.type === 'sideboarding' && (
                <SideboardDialog
                    isOpen={true}
                    deck={pendingAction.deck}
                    onClose={() => {
                        console.log('Closing sideboard dialog not fully supported yet');
                    }}
                    onSubmit={(deck) => {
                        submitDeck(pendingAction.tableId, deck);
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
                            onShowZone={showZone}
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
                    onShowZone={showZone}
                    onInteract={handleCardClick}
                />
            )}

            {/* Hand (fixed position at bottom) */}
            {myPlayer && (
                <div className="arena-hand-area">
                    <Hand
                        hand={gameView.myHand}
                        onCardClick={handleCardClick}
                        onCardInspect={handleCardInspect}
                    />
                </div>
            )}

            {/* Stack (Right side, fanned out) */}
            <ArenaStack
                stack={gameView.stack}
                onCardClick={handleCardClick}
                onCardInspect={handleCardInspect}
            />

            {/* Arena-style Priority Controls (bottom-right) */}
            {myPlayer && (
                <ArenaPriorityControls
                    hasPriority={myPlayer.hasPriority}
                    isMyTurn={isMyTurn}
                    currentPhase={gameView.step}
                    skipEnabled={arenaSkipEnabled}
                    onToggleSkip={toggleArenaSkip}
                />
            )}

            {/* Phase Indicator (Top right corner) */}
            <div style={{
                position: 'fixed',
                top: 10,
                right: 20,
                zIndex: 100
            }}>
                <PhaseIndicator turn={gameView.turn} step={gameView.step} />
                <div className="turn-indicator" style={{
                    marginTop: 8,
                    padding: '4px 12px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: isMyTurn ? '#22c55e' : '#94a3b8',
                    textAlign: 'center'
                }}>
                    {isMyTurn ? "Your Turn" : `${gameView.activePlayerName || opponents.find(p => p.playerId === gameView.activePlayerId)?.name || 'Unknown'}'s Turn`}
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
                <div style={{ padding: 12 }}>
                    <h4 style={{ margin: 0, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Game Info
                    </h4>
                </div>

                <div className="keyboard-shortcuts" style={{ margin: '0 12px' }}>
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
                            <kbd>F7</kbd> <span>Until Stack Resolves</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>F9</kbd> <span>Until My Turn</span>
                        </div>
                        <div className="shortcut-item">
                            <kbd>ESC</kbd> <span>Cancel</span>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, margin: '12px', overflow: 'hidden' }}>
                    <ChatPanel />
                </div>

                <div style={{ padding: 12 }}>
                    <Button onClick={handleLeave} variant="secondary" size="sm" style={{ width: '100%' }}>
                        Concede / Leave
                    </Button>
                </div>
            </aside>

            {/* Game Over Modal */}
            {showResultModal && (
                <ResultModal
                    gameEndView={gameEndView}
                    endGameInfo={endGameInfo}
                    onLeave={handleLeave}
                    onClose={() => setResultModalClosed(true)}
                    hasLost={hasLeft}
                />
            )}
        </div>
    );
};
