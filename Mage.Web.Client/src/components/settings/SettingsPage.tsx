import React, { useEffect, useState } from 'react';
import { Navbar, type NavPage } from '../common/Navbar';
import { Button } from '../common';
import { cardImageService } from '../../services';
import { useSettingsStore } from '../../stores/settingsStore';
import './SettingsPage.css';

interface SettingsPageProps {
  onExit: () => void;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  supportMenu?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

const FLAG_OPTIONS = [
  { value: 'world', label: 'World' },
  { value: 'us', label: 'United States' },
  { value: 'mx', label: 'Mexico' },
  { value: 'ca', label: 'Canada' },
  { value: 'br', label: 'Brazil' },
  { value: 'de', label: 'Germany' },
  { value: 'europeanunion', label: 'European Union' },
  { value: 'jp', label: 'Japan' },
];

const AUTO_TARGET_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Most' },
  { value: 2, label: 'All' },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ onExit, onNavigate, onLogout, supportMenu }) => {
  const { settings, setSetting, resetSettings } = useSettingsStore();
  const [cacheSummary, setCacheSummary] = useState('Loading...');
  const [cacheBusy, setCacheBusy] = useState(false);

  const refreshCacheSummary = React.useCallback(async () => {
    const stats = await cardImageService.getCacheStats();
    setCacheSummary(`${stats.entryCount} images, ${formatBytes(stats.totalSize)}, ${stats.hitRate.toFixed(0)}% hit rate`);
  }, []);

  useEffect(() => {
    void refreshCacheSummary();
  }, [refreshCacheSummary]);

  const clearCache = async () => {
    setCacheBusy(true);
    try {
      await cardImageService.clearAllCaches();
      await refreshCacheSummary();
    } finally {
      setCacheBusy(false);
    }
  };

  const trimCache = async () => {
    setCacheBusy(true);
    try {
      await cardImageService.clearOldCache(settings.imageCacheMaxAgeDays);
      await refreshCacheSummary();
    } finally {
      setCacheBusy(false);
    }
  };

  return (
    <div className="settings-page">
      <Navbar currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} supportMenu={supportMenu} />

      <main className="settings-shell">
        <div className="settings-header">
          <div>
            <h1>Client Settings</h1>
            <p>Profile, prompts, mana automation, and local image cache.</p>
          </div>
          <Button variant="secondary" onClick={onExit}>Back to Lobby</Button>
        </div>

        <section className="settings-grid">
          <div className="settings-panel settings-panel-wide">
            <h2>Profile</h2>
            <label className="setting-field">
              <span>
                <strong>Avatar ID</strong>
                <small>Sent to the server for lobby seats and player panels.</small>
              </span>
              <input
                type="number"
                min="1"
                max="9999"
                value={settings.avatarId}
                onChange={(event) => setSetting('avatarId', Number(event.target.value))}
                data-testid="settings-avatar-id"
              />
            </label>

            <label className="setting-field">
              <span>
                <strong>Flag</strong>
                <small>Country/flag resource name, without the image extension.</small>
              </span>
              <input
                list="settings-flag-options"
                value={settings.flagName}
                onChange={(event) => setSetting('flagName', event.target.value)}
                data-testid="settings-flag-name"
              />
              <datalist id="settings-flag-options">
                {FLAG_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </datalist>
            </label>
          </div>

          <div className="settings-panel">
            <h2>Game Feel</h2>
            <label className="setting-row">
              <span>
                <strong>Animations</strong>
                <small>Card movement, combat hits, and damage feedback.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.animationsEnabled}
                onChange={(event) => setSetting('animationsEnabled', event.target.checked)}
              />
            </label>

            <label className="setting-slider">
              <span>
                <strong>Animation speed</strong>
                <small>{settings.animationSpeed.toFixed(1)}x</small>
              </span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.animationSpeed}
                onChange={(event) => setSetting('animationSpeed', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Mana</h2>
            <label className="setting-row">
              <span>
                <strong>Auto-pay mana</strong>
                <small>Send Java's mana pool automatic preference on connect.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoTapManaPayment}
                onChange={(event) => setSetting('autoTapManaPayment', event.target.checked)}
                data-testid="settings-mana-automatic"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Restrict auto-pay</strong>
                <small>Only use one automatic mana source when Java would restrict payment.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.manaPoolAutomaticRestricted}
                onChange={(event) => setSetting('manaPoolAutomaticRestricted', event.target.checked)}
                data-testid="settings-mana-restricted"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Use first mana ability</strong>
                <small>Prefer the first available mana ability on lands.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.useFirstManaAbility}
                onChange={(event) => setSetting('useFirstManaAbility', event.target.checked)}
                data-testid="settings-use-first-mana-ability"
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Prompts</h2>
            <label className="setting-row">
              <span>
                <strong>Allow hand requests</strong>
                <small>Let other players ask to view your hand.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.allowRequestShowHandCards}
                onChange={(event) => setSetting('allowRequestShowHandCards', event.target.checked)}
                data-testid="settings-allow-hand-requests"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Confirm empty mana pool</strong>
                <small>Ask before passing while mana remains in pool.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.confirmEmptyManaPool}
                onChange={(event) => setSetting('confirmEmptyManaPool', event.target.checked)}
                data-testid="settings-confirm-empty-mana"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Ask graveyard order</strong>
                <small>Prompt when multiple cards move to graveyard together.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.askMoveToGraveOrder}
                onChange={(event) => setSetting('askMoveToGraveOrder', event.target.checked)}
                data-testid="settings-ask-grave-order"
              />
            </label>
          </div>

          <div className="settings-panel settings-panel-wide">
            <h2>Priority & Targets</h2>
            <label className="setting-row">
              <span>
                <strong>Pass priority after casting</strong>
                <small>Mirror Java's pass-priority cast preference.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.passPriorityCast}
                onChange={(event) => setSetting('passPriorityCast', event.target.checked)}
                data-testid="settings-pass-priority-cast"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Pass priority after activating</strong>
                <small>Mirror Java's pass-priority activation preference.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.passPriorityActivation}
                onChange={(event) => setSetting('passPriorityActivation', event.target.checked)}
                data-testid="settings-pass-priority-activation"
              />
            </label>

            <label className="setting-row">
              <span>
                <strong>Auto-order triggers</strong>
                <small>Let the server order triggers automatically when allowed.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoOrderTrigger}
                onChange={(event) => setSetting('autoOrderTrigger', event.target.checked)}
                data-testid="settings-auto-order-trigger"
              />
            </label>

            <label className="setting-field">
              <span>
                <strong>Auto-target level</strong>
                <small>Off, Most, or All target automation.</small>
              </span>
              <select
                value={settings.autoTargetLevel}
                onChange={(event) => setSetting('autoTargetLevel', Number(event.target.value))}
                data-testid="settings-auto-target-level"
              >
                {AUTO_TARGET_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="setting-row">
              <span>
                <strong>Reuse replacement choices</strong>
                <small>Use the same auto-choice settings for matching replacement effects.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.useSameSettingsForReplacementEffects}
                onChange={(event) => setSetting('useSameSettingsForReplacementEffects', event.target.checked)}
                data-testid="settings-same-replacement-effects"
              />
            </label>
          </div>

          <div className="settings-panel">
            <h2>Images & Cache</h2>
            <label className="setting-row">
              <span>
                <strong>Preload match images</strong>
                <small>Cache visible hand, battlefield, stack, graveyard, and exile images as match state arrives.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.preloadMatchImages}
                onChange={(event) => setSetting('preloadMatchImages', event.target.checked)}
              />
            </label>

            <label className="setting-slider">
              <span>
                <strong>Cache trim age</strong>
                <small>{settings.imageCacheMaxAgeDays} days</small>
              </span>
              <input
                type="range"
                min="1"
                max="90"
                step="1"
                value={settings.imageCacheMaxAgeDays}
                onChange={(event) => setSetting('imageCacheMaxAgeDays', Number(event.target.value))}
              />
            </label>

            <div className="cache-actions">
              <span>{cacheSummary}</span>
              <Button variant="secondary" size="sm" onClick={trimCache} disabled={cacheBusy}>Trim Old</Button>
              <Button variant="ghost" size="sm" onClick={clearCache} disabled={cacheBusy}>Clear</Button>
            </div>
          </div>
        </section>

        <div className="settings-footer">
          <Button variant="ghost" onClick={resetSettings}>Reset Defaults</Button>
        </div>
      </main>
    </div>
  );
};
