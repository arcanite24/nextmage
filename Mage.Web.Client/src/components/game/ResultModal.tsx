import React from 'react';
import { GameEndView, EndGameInfo } from '../../types';
import { Button } from '../common';
import './ResultModal.css';

interface ResultModalProps {
    gameEndView: GameEndView | null;
    endGameInfo: EndGameInfo | null;
    onLeave: () => void;
    onClose?: () => void;
    hasLost?: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({ gameEndView, endGameInfo, onLeave, onClose, hasLost }) => {

    // Helper for footer buttons
    const renderFooter = (showSpectate: boolean = false) => (
        <div className="modal-footer">
            {showSpectate && onClose && (
                <Button variant="secondary" onClick={onClose}>Spectate</Button>
            )}
            <Button variant="primary" onClick={onLeave}>Return to Lobby</Button>
        </div>
    );

    // Prefer EndGameInfo if available as it is richer
    if (endGameInfo) {
        const isWinner = endGameInfo.won;
        return (
            <div className="modal-overlay">
                <div className={`modal-container result-modal ${isWinner ? 'winner' : 'loser'}`}>
                    <div className="modal-header">
                        <h3>Match Result</h3>
                    </div>
                    <div className="modal-content">
                        <div className="result-title">
                            {isWinner ? "Victory!" : "Defeat"}
                        </div>
                        <div className="result-details">
                            <p className="main-info">{endGameInfo.matchInfo}</p>
                            <p className="sub-info">{endGameInfo.gameInfo}</p>

                            {endGameInfo.matchView && endGameInfo.matchView.result && (
                                <div className="match-score">
                                    {endGameInfo.matchView.result}
                                </div>
                            )}
                        </div>
                    </div>
                    {renderFooter(true)}
                </div>
            </div>
        );
    }

    // Fallback to GameEndView
    if (gameEndView) {
        return (
            <div className="modal-overlay">
                <div className="modal-container result-modal">
                    <div className="modal-header">
                        <h3>Game Over</h3>
                    </div>
                    <div className="modal-content">
                        <div className="result-details">
                            <p><strong>Winner:</strong> {gameEndView.winners?.join(', ') || 'None'}</p>
                            <p><strong>Loser:</strong> {gameEndView.losers?.join(', ') || 'None'}</p>
                            {gameEndView.matchWinner && (
                                <p className="match-winner"><strong>Match Winner:</strong> {gameEndView.matchWinner}</p>
                            )}
                        </div>
                    </div>
                    {renderFooter(true)}
                </div>
            </div>
        );
    }

    // Fallback if we just know we lost/left
    if (hasLost) {
        return (
            <div className="modal-overlay">
                <div className="modal-container result-modal loser">
                    <div className="modal-header">
                        <h3>Game Result</h3>
                    </div>
                    <div className="modal-content">
                        <div className="result-title">
                            Defeat
                        </div>
                        <div className="result-details">
                            <p>You have been eliminated from the game.</p>
                        </div>
                    </div>
                    {renderFooter(true)}
                </div>
            </div>
        );
    }

    return null;
};
