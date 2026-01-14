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
        endGameInfo
    } = useGameStore();

    const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);

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
            {previewImageUrl && (
                <CardPreviewModal
                    imageUrl={previewImageUrl}
                    onClose={() => setPreviewImageUrl(null)}
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
                                <PlayerPanel player={p} isOpponent onClick={handleCardClick} />
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
                                <PlayerPanel player={myPlayer} isMe onClick={handleCardClick} />
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
