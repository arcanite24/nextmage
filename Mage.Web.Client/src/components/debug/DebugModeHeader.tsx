import React from 'react';

interface DebugModeHeaderProps {
  onClose: () => void;
  onExport: () => void;
}

export const DebugModeHeader: React.FC<DebugModeHeaderProps> = ({ onClose, onExport }) => {
  return (
    <div className="debug-mode-header">
      <h1 className="debug-mode-title">Debug Mode</h1>
      <div className="debug-mode-actions">
        <button
          className="debug-mode-btn debug-mode-btn-export"
          onClick={onExport}
        >
          Export
        </button>
        <button
          className="debug-mode-btn debug-mode-btn-close"
          onClick={onClose}
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
};
