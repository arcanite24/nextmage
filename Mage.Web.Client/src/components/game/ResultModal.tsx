import React from 'react';
import { GameEndView, EndGameInfo } from '../../types';
import { Button } from '../common';
import './ResultModal.css';

interface ResultModalProps {
    gameEndView: GameEndView | null;
    endGameInfo: EndGameInfo | null;
    onLeave: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ gameEndView, endGameInfo, onLeave }) => {

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
                    <div className="modal-footer">
                        <Button variant="primary" onClick={onLeave}>Return to Lobby</Button>
                    </div>
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
                    <div className="modal-footer">
                        <Button variant="primary" onClick={onLeave}>Return to Lobby</Button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
