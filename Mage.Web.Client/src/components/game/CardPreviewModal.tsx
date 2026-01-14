import React, { useEffect } from 'react';
import './CardPreviewModal.css';

interface CardPreviewModalProps {
    imageUrl: string;
    onClose: () => void;
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({ imageUrl, onClose }) => {

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on click outside (overlay click)
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="card-preview-overlay" onClick={handleOverlayClick} onContextMenu={(e) => e.preventDefault()}>
            <div className="card-preview-content">
                <img src={imageUrl} alt="Card Preview" className="card-preview-image" />
                <button className="card-preview-close" onClick={onClose}>×</button>
            </div>
        </div>
    );
};
