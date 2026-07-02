import React, { useState } from 'react';
import { useDebugStore } from '../../stores/debugStore';
import { useSessionStore } from '../../stores';
import { DebugExportService } from '../../services/DebugExportService';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export const ExportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { getFullExportData } = useDebugStore();
  const showAlert = useSessionStore(state => state.showAlert);
  const [format, setFormat] = useState<'json' | 'text'>('json');
  const [content, setContent] = useState<'both' | 'state' | 'history'>('both');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = getFullExportData();

      const exportData = {
        ...data,
        actionHistory: content === 'state' ? [] : data.actionHistory,
        currentGameView: content === 'history' ? null : data.currentGameView,
        boardStateSummary: content === 'history' ? null : data.boardStateSummary,
      };

      if (format === 'json') {
        await DebugExportService.exportAsJson(exportData);
      } else {
        await DebugExportService.exportAsText(exportData);
      }

      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      showAlert('Debug export', 'Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  const handleClipboard = async () => {
    setExporting(true);
    try {
      const data = getFullExportData();
      const exportData = {
        ...data,
        actionHistory: content === 'state' ? [] : data.actionHistory,
        currentGameView: content === 'history' ? null : data.currentGameView,
        boardStateSummary: content === 'history' ? null : data.boardStateSummary,
      };

      await DebugExportService.exportToClipboard(exportData);
      showAlert('Debug export', 'Data copied to clipboard.');
    } catch (err) {
      console.error('Clipboard export failed:', err);
      showAlert('Debug export', 'Failed to copy to clipboard. Permission may have been denied.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Export Debug Data" size="md">
      <div className="export-dialog">
        <div className="export-dialog-section">
          <h3 className="export-dialog-section-title">Format</h3>
          <div className="export-dialog-options">
            <label className="export-dialog-radio">
              <input
                type="radio"
                value="json"
                checked={format === 'json'}
                onChange={(e) => setFormat(e.target.value as 'json' | 'text')}
              />
              <span>JSON</span>
            </label>
            <label className="export-dialog-radio">
              <input
                type="radio"
                value="text"
                checked={format === 'text'}
                onChange={(e) => setFormat(e.target.value as 'json' | 'text')}
              />
              <span>Text (Readable)</span>
            </label>
          </div>
        </div>

        <div className="export-dialog-section">
          <h3 className="export-dialog-section-title">Content</h3>
          <div className="export-dialog-options">
            <label className="export-dialog-radio">
              <input
                type="radio"
                value="both"
                checked={content === 'both'}
                onChange={(e) => setContent(e.target.value as any)}
              />
              <span>Both Board State & History</span>
            </label>
            <label className="export-dialog-radio">
              <input
                type="radio"
                value="state"
                checked={content === 'state'}
                onChange={(e) => setContent(e.target.value as any)}
              />
              <span>Board State Only</span>
            </label>
            <label className="export-dialog-radio">
              <input
                type="radio"
                value="history"
                checked={content === 'history'}
                onChange={(e) => setContent(e.target.value as any)}
              />
              <span>Action History Only</span>
            </label>
          </div>
        </div>

        <div className="export-dialog-section">
          <button
            className="export-dialog-preview-toggle"
            onClick={() => setPreviewExpanded(!previewExpanded)}
          >
            {previewExpanded ? 'Hide Preview' : 'Show Preview'}
          </button>

          {previewExpanded && (
            <div className="export-dialog-preview">
              <pre className="export-dialog-preview-content">
                {format === 'json' ? (
                  <code>{JSON.stringify(getFullExportData(), null, 2).substring(0, 500)}...</code>
                ) : (
                  <code>{DebugExportService.formatAsText(getFullExportData()).substring(0, 500)}...</code>
                )}
              </pre>
            </div>
          )}
        </div>

        <div className="export-dialog-actions">
          <Button onClick={handleClipboard} disabled={exporting} variant="secondary">
            Copy to Clipboard
          </Button>
          <Button onClick={handleExport} disabled={exporting} variant="primary">
            {exporting ? 'Exporting...' : 'Download File'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
