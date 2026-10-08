import React, { useMemo, useCallback } from 'react';
import { FastForward, X } from 'lucide-react';
import './SkipIndicator.css';

interface SkipIndicatorProps {
    activeSkip: 'none' | 'F4' | 'F5' | 'F6' | 'F7' | 'F9' | 'F10' | 'F11';
    onCancel: () => void;
}

export const SkipIndicator: React.FC<SkipIndicatorProps> = React.memo(({ activeSkip, onCancel }) => {
    const skipLabel = useMemo(() => {
        switch (activeSkip) {
            case 'F4':
                return 'Until Next Turn';
            case 'F5':
                return 'Until End Step';
            case 'F6':
                return 'Next Turn, Skip Stack';
            case 'F7':
                return 'Until Next Main';
            case 'F10':
                return 'Until Stack Resolves';
            case 'F9':
                return 'Until My Turn';
            case 'F11':
                return 'End Step Before My Turn';
            default:
                return '';
        }
    }, [activeSkip]);

    const handleCancel = useCallback(() => {
        onCancel();
    }, [onCancel]);

    if (activeSkip === 'none') {
        return null;
    }

    return (
        <div className="skip-indicator">
            <div className="skip-indicator-content">
                <FastForward className="skip-indicator-icon" size={24} aria-hidden="true" />
                <div className="skip-indicator-text">
                    <div className="skip-indicator-key">{activeSkip}</div>
                    <div className="skip-indicator-label">{skipLabel}</div>
                </div>
                <button
                    className="skip-indicator-cancel"
                    onClick={handleCancel}
                    title="Cancel (ESC)"
                >
                    <X size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
});
