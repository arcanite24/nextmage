import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { cardImageService } from '../../services/CardImageService';
import { CacheStats } from '../../services/ImageCacheManager';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import './ImageCachePanel.css';

export const ImageCachePanel: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const cacheStats = await cardImageService.getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the entire image cache? This will force all images to be re-downloaded.')) {
      return;
    }

    setLoading(true);
    try {
      await cardImageService.clearAllCaches();
      await loadStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearOldCache = async () => {
    const days = prompt('Delete cache entries older than how many days?', '30');
    if (!days) return;

    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      alert('Please enter a valid number of days.');
      return;
    }

    setLoading(true);
    try {
      const deletedCount = await cardImageService.clearOldCache(daysNum);
      alert(`Deleted ${deletedCount} cache entries older than ${daysNum} days.`);
      await loadStats();
    } catch (error) {
      console.error('Failed to clear old cache:', error);
      alert('Failed to clear old cache. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatRate = (rate: number): string => {
    return `${rate.toFixed(1)}%`;
  };

  return (
    <>
      <button
        className="image-cache-trigger"
        onClick={() => setOpen(true)}
        title="Manage image cache"
      >
        🖼️ Cache ({stats ? formatBytes(stats.totalSize) : 'Loading...'})
      </button>

      {open && (
        <Modal isOpen={true} onClose={() => setOpen(false)} title="Image Cache Management" size="md">
          <div className="image-cache-panel">
            {loading && !stats && (
              <div className="image-cache-loading">Loading cache statistics...</div>
            )}

            {stats && (
              <>
                <div className="image-cache-stats">
                  <div className="image-cache-stat">
                    <div className="image-cache-stat-label">Cache Size</div>
                    <div className="image-cache-stat-value">{formatBytes(stats.totalSize)}</div>
                  </div>

                  <div className="image-cache-stat">
                    <div className="image-cache-stat-label">Cached Images</div>
                    <div className="image-cache-stat-value">{stats.entryCount.toLocaleString()}</div>
                  </div>

                  <div className="image-cache-stat">
                    <div className="image-cache-stat-label">Cache Hits</div>
                    <div className="image-cache-stat-value image-cache-stat-success">{stats.hitCount.toLocaleString()}</div>
                  </div>

                  <div className="image-cache-stat">
                    <div className="image-cache-stat-label">Cache Misses</div>
                    <div className="image-cache-stat-value image-cache-stat-warning">{stats.missCount.toLocaleString()}</div>
                  </div>

                  <div className="image-cache-stat">
                    <div className="image-cache-stat-label">Hit Rate</div>
                    <div className={`image-cache-stat-value ${stats.hitRate >= 80 ? 'image-cache-stat-success' : stats.hitRate >= 50 ? 'image-cache-stat-neutral' : 'image-cache-stat-warning'}`}>
                      {formatRate(stats.hitRate)}
                    </div>
                  </div>
                </div>

                <div className="image-cache-actions">
                  <h3 className="image-cache-actions-title">Cache Actions</h3>

                  <Button
                    onClick={() => {
                      if (confirm('Refresh cache statistics?')) {
                        loadStats();
                      }
                    }}
                    variant="secondary"
                    disabled={loading}
                  >
                    Refresh Stats
                  </Button>

                  <Button
                    onClick={handleClearOldCache}
                    variant="secondary"
                    disabled={loading}
                  >
                    Clear Old Entries
                  </Button>

                  <Button
                    onClick={handleClearCache}
                    variant="danger"
                    disabled={loading}
                    isLoading={loading}
                  >
                    Clear All Cache
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
