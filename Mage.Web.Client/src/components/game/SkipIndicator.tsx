import React, { useMemo, useCallback } from 'react';
import './SkipIndicator.css';

interface SkipIndicatorProps {
    activeSkip: 'none' | 'F4' | 'F5' | 'F7' | 'F9';
    onCancel: () => void;
}

export const SkipIndicator: React.FC<SkipIndicatorProps> = React.memo(({ activeSkip, onCancel }) => {
    if (activeSkip === 'none') {
        return null;
    }

    const skipLabel = useMemo(() => {
        switch (activeSkip) {
            case 'F4':
                return 'Until End of Turn';
            case 'F5':
                return 'Until Next Main';
            case 'F7':
                return 'Until Stack Resolves';
            case 'F9':
                return 'Until My Turn';
            default:
                return '';
        }
    }, [activeSkip]);

    const handleCancel = useCallback(() => {
        onCancel();
    }, [onCancel]);

    return (
        <div className="skip-indicator">
            <div className="skip-indicator-content">
                <div className="skip-indicator-icon">⏩</div>
                <div className="skip-indicator-text">
                    <div className="skip-indicator-key">{activeSkip}</div>
                    <div className="skip-indicator-label">{skipLabel}</div>
                </div>
                <button
                    className="skip-indicator-cancel"
                    onClick={handleCancel}
                    title="Cancel (ESC)"
                >
                    ✕
                </button>
            </div>
        </div>
    );
});
