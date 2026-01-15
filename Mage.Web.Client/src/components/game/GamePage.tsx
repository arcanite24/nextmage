import React, { useEffect } from 'react';
import { useGameStore, useSessionStore, useChatStore } from '../../stores';
import { Button } from '../common';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { PlayerPanel } from './PlayerPanel';
import { Stack } from './Stack';
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
import { cardImageService } from '../../services/CardImageService';
import './GamePage.css';

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
        sendPlayerAction
    } = useGameStore();

    const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);

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
            setPreviewImageUrl(cardImageService.getImageUrl(card));
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

    return (
        <div className="game-page">
            <CombatOverlay />
            <SkipIndicator activeSkip={activeSkip} onCancel={cancelPassActions} />
            {previewImageUrl && (
                <CardPreviewModal
                    imageUrl={previewImageUrl}
                    onClose={() => setPreviewImageUrl(null)}
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
            {(pendingAction.type === 'target' || pendingAction.type === 'select' || showingZone) && (
                <CardSelectorDialog
                    isOpen={true}
                    pendingAction={pendingAction.type === 'target' || pendingAction.type === 'select' ? pendingAction : undefined}
                    showingZone={showingZone || undefined}
                    showingPlayerId={showingPlayerId || undefined}
                    onClose={() => {
                        if (showingZone) {
                            showZone(null);
                        } else if (pendingAction.type === 'target' || pendingAction.type === 'select') {
                            if (!pendingAction.required) {
                                sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS');
                            }
                        }
                    }}
                />
            )}

            {/* Sideboard Dialog */}
            {pendingAction.type === 'sideboarding' && (
                <SideboardDialog
                    isOpen={true}
                    deck={pendingAction.deck}
                    onClose={() => {
                        // User can't really "cancel" sideboarding in a tournament without conceding or timeouts
                        // But for UI capability, maybe minimize?
                        // For now, no-op or confirm concede?
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
            <div className="game-layout">
                {/* Main Battle Area */}
                <div className="game-center">
                    {/* Opponents (Top) */}
                    <div className="opponents-container">
                        {opponents.map(p => (
                            <div key={p.playerId} className="opponent-wrapper">
                                <PlayerPanel player={p} isOpponent onClick={handleCardClick} onShowZone={showZone} />
                                <Battlefield
                                    player={p}
                                    onCardClick={handleCardClick}
                                    onCardInspect={handleCardInspect}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Middle (Stack / Combat) -> Could be overlaid or separate div */}
                    <div className="midway-container">
                        <Stack stack={gameView.stack} />
                    </div>

                    {/* Me (Bottom) */}
                    {myPlayer && (
                        <div className="me-container">
                            <Battlefield
                                player={myPlayer}
                                isMe
                                onCardClick={handleCardClick}
                                onCardInspect={handleCardInspect}
                            />
                            <div className="my-controls-row">
                                <PlayerPanel player={myPlayer} isMe onClick={handleCardClick} onShowZone={showZone} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                    <Hand
                                        hand={gameView.myHand}
                                        onCardClick={handleCardClick}
                                        onCardInspect={handleCardInspect}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar (Right) */}
                <aside className="game-sidebar">
                    <div className="game-info">
                        <PhaseIndicator turn={gameView.turn} step={gameView.step} />
                        <div className="turn-indicator">
                            {isMyTurn ? "Your Turn" : `${gameView.activePlayerName || opponents.find(p => p.playerId === gameView.activePlayerId)?.name || 'Unknown'}'s Turn`}
                        </div>
                    </div>

                    <div className="game-log-panel">
                        <h4>Game Log</h4>
                        <div className="log-content">
                            {/* Log would go here */}
                            (Log implementation pending)
                        </div>
                    </div>

                    <ChatPanel />

                    <div className="keyboard-shortcuts">
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

                    <div className="game-actions">
                        <Button onClick={handleLeave} variant="secondary" size="sm">
                            Concede / Leave
                        </Button>
                    </div>
                </aside>
            </div>

            {/* Game Over Modal */}
            {gameEnded && (
                <ResultModal
                    gameEndView={gameEndView}
                    endGameInfo={endGameInfo}
                    onLeave={handleLeave}
                />
            )}
        </div>
    );
};
