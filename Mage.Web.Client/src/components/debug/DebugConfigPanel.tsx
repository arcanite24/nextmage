import React from 'react';
import { useDebugStore } from '../../stores/debugStore';
import { ImageCachePanel } from './ImageCachePanel';

export const DebugConfigPanel: React.FC = () => {
  const { config, toggleDebugMode, setMaxHistorySize, setAutoTrack, clearHistory } = useDebugStore();

  return (
    <div className="debug-config-panel">
      <h2 className="debug-config-title">Debug Configuration</h2>

      <div className="debug-config-section">
        <h3 className="debug-config-section-title">General Settings</h3>

        <div className="debug-config-option">
          <label className="debug-config-checkbox">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={toggleDebugMode}
            />
            <span className="debug-config-label">Debug Mode Enabled</span>
          </label>
          <p className="debug-config-description">
            When disabled, debug tracking stops and interface is hidden
          </p>
        </div>

        <div className="debug-config-option">
          <label className="debug-config-checkbox">
            <input
              type="checkbox"
              checked={config.autoTrack}
              onChange={(e) => setAutoTrack(e.target.checked)}
            />
            <span className="debug-config-label">Auto-Track Actions</span>
          </label>
          <p className="debug-config-description">
            Automatically record game actions during matches
          </p>
        </div>
      </div>

      <div className="debug-config-section">
        <h3 className="debug-config-section-title">History Settings</h3>

        <div className="debug-config-option">
          <label className="debug-config-label">Max History Size: {config.maxHistorySize}</label>
          <input
            type="range"
            className="debug-config-slider"
            min="10"
            max="200"
            step="10"
            value={config.maxHistorySize}
            onChange={(e) => setMaxHistorySize(parseInt(e.target.value))}
          />
          <div className="debug-config-range-labels">
            <span>10</span>
            <span>200</span>
          </div>
          <p className="debug-config-description">
            Number of actions to keep in history (older actions are removed)
          </p>
        </div>
      </div>

      <div className="debug-config-section">
        <h3 className="debug-config-section-title">Actions</h3>

        <div className="debug-config-actions">
          <button
            className="debug-config-btn debug-config-btn-danger"
            onClick={clearHistory}
          >
            Clear History
          </button>
          <ImageCachePanel />
        </div>
      </div>

      <div className="debug-config-info">
        <h3 className="debug-config-section-title">Keyboard Shortcuts</h3>
        <div className="debug-config-shortcuts">
          <div className="debug-config-shortcut">
            <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
            <span>Toggle Debug Mode</span>
          </div>
          <div className="debug-config-shortcut">
            <kbd>Esc</kbd>
            <span>Close Debug Panel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
