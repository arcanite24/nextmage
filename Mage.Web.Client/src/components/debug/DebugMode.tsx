import React, { useState, useEffect } from 'react';
import { useDebugStore } from '../../stores/debugStore';
import { DebugModeHeader } from './DebugModeHeader';
import { DebugModeTabs } from './DebugModeTabs';
import { ActionHistoryPanel } from './ActionHistoryPanel';
import { BoardStatePanel } from './BoardStatePanel';
import { DebugConfigPanel } from './DebugConfigPanel';
import { ExportDialog } from './ExportDialog';
import './DebugMode.css';

interface DebugModeProps {
  onClose: () => void;
}

type TabType = 'history' | 'board' | 'config';

export const DebugMode: React.FC<DebugModeProps> = ({ onClose }) => {
  const { config } = useDebugStore();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!config.enabled) {
    return null;
  }

  return (
    <div className="debug-mode-overlay">
      <div className="debug-mode-container">
        <DebugModeHeader
          onClose={onClose}
          onExport={() => setExportDialogOpen(true)}
        />

        <DebugModeTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="debug-mode-content">
          {activeTab === 'history' && <ActionHistoryPanel />}
          {activeTab === 'board' && <BoardStatePanel gameView={useDebugStore.getState().currentGameView} />}
          {activeTab === 'config' && <DebugConfigPanel />}
        </div>
      </div>

      {exportDialogOpen && (
        <ExportDialog onClose={() => setExportDialogOpen(false)} />
      )}
    </div>
  );
};
