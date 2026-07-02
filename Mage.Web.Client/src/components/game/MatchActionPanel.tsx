import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PlayerAction, PlayerView } from '../../types';
import { useGameStore } from '../../stores';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import './MatchActionPanel.css';

interface MatchActionPanelProps {
    players: PlayerView[];
    myPlayerId: string | null;
    isWatching: boolean;
    isReplay: boolean;
    rollbackTurnsAllowed: boolean;
    rangeOfInfluence?: string;
    attackOption?: string;
}

interface ActionButton {
    label: string;
    action: PlayerAction;
    data?: unknown;
    disabled?: boolean;
}

const resetButtons: ActionButton[] = [
    { label: 'Reset Trigger Order', action: 'TRIGGER_AUTO_ORDER_RESET_ALL' },
    { label: 'Reset Replacement Picks', action: 'RESET_AUTO_SELECT_REPLACEMENT_EFFECTS' },
    { label: 'Reset Yes/No Answers', action: 'REQUEST_AUTO_ANSWER_RESET_ALL' },
    { label: 'Toggle Macro', action: 'TOGGLE_RECORD_MACRO' },
];

const rollbackQuickActions: Array<{ label: string; turns: number; title: string }> = [
    { label: 'Current Turn', turns: 0, title: 'Rollback to the start of the current turn' },
    { label: 'Previous Turn', turns: 1, title: 'Rollback to the start of the previous turn' },
    { label: '+2 Turns', turns: 2, title: 'Rollback the current turn and the two turns before it' },
    { label: '+3 Turns', turns: 3, title: 'Rollback the current turn and the three turns before it' },
];

const rangeLabels: Record<string, string> = {
    ONE: 'Range 1',
    TWO: 'Range 2',
    ALL: 'All players',
};

const attackOptionLabels: Record<string, string> = {
    MULTIPLE: 'Attack multiple players',
    LEFT: 'Attack left',
    RIGHT: 'Attack right',
};

function formatMatchOption(value: string | undefined, labels: Record<string, string>): string {
    if (!value) {
        return 'Server default';
    }

    return labels[value] ?? value
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

export const MatchActionPanel: React.FC<MatchActionPanelProps> = React.memo(({
    players,
    myPlayerId,
    isWatching,
    isReplay,
    rollbackTurnsAllowed,
    rangeOfInfluence,
    attackOption,
}) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [rollbackTurns, setRollbackTurns] = useState(1);
    const { gameId, sendPlayerAction, holdPriority, undo, cancelPassActions, stopWatching, stopReplay } = useGameStore(useShallow(state => ({
        gameId: state.gameId,
        sendPlayerAction: state.sendPlayerAction,
        holdPriority: state.holdPriority,
        undo: state.undo,
        cancelPassActions: state.cancelPassActions,
        stopWatching: state.stopWatching,
        stopReplay: state.stopReplay,
    })));
    const showLocalUserRequest = useSessionStore(state => state.showLocalUserRequest);
    const { settings, setSetting } = useSettingsStore(useShallow(state => ({
        settings: state.settings,
        setSetting: state.setSetting,
    })));

    const otherPlayers = useMemo(
        () => players.filter((player) => player.playerId !== myPlayerId),
        [myPlayerId, players],
    );
    const targetPlayerId = selectedPlayerId || otherPlayers[0]?.playerId || '';
    const hasTargetPlayer = targetPlayerId.length > 0;
    const showMatchOptions = players.length > 2 || Boolean(rangeOfInfluence || attackOption);

    const send = async (button: ActionButton) => {
        if (button.disabled || isWatching) {
            return;
        }
        await sendPlayerAction(button.action, button.data ?? null);
    };

    const updateManaAutomation = <K extends 'autoTapManaPayment' | 'manaPoolAutomaticRestricted' | 'useFirstManaAbility'>(
        key: K,
        value: boolean,
    ) => {
        setSetting(key, value);
    };

    const requestRollback = (turns: number) => {
        void sendPlayerAction('ROLLBACK_TURNS', turns);
    };

    const confirmStopWatching = async () => {
        if (!isWatching || !gameId) return;
        const confirmed = await showLocalUserRequest({
            title: 'Stop watching',
            message: 'Are you sure you want to stop watching?',
            gameId,
            button1Text: 'No',
            button1Action: null,
            button2Text: 'Yes',
            button2Action: 'CLIENT_STOP_WATCHING',
        });
        if (confirmed === 2) {
            await stopWatching();
        }
    };

    const confirmStopReplay = async () => {
        if (!isReplay || !gameId) return;
        const confirmed = await showLocalUserRequest({
            title: 'Stop replay',
            message: 'Are you sure you want to stop replay?',
            gameId,
            button1Text: 'No',
            button1Action: null,
            button2Text: 'Yes',
            button2Action: 'CLIENT_REPLAY_ACTION',
        });
        if (confirmed === 2) {
            await stopReplay();
        }
    };

    return (
        <div className="match-action-panel" data-testid="match-action-panel">
            {isWatching && (
                <div className="match-action-watch-banner" data-testid="match-watch-banner" role="status">
                    <span className="match-action-watch-dot" aria-hidden="true" />
                    <span>Watching this game. Player-only controls are locked.</span>
                </div>
            )}

            <section className="match-action-section">
                <h5>Priority</h5>
                <div className="match-action-grid">
                    <button type="button" onClick={holdPriority} disabled={isWatching}>Hold</button>
                    <button type="button" onClick={() => sendPlayerAction('UNHOLD_PRIORITY')} disabled={isWatching}>Release</button>
                    <button type="button" onClick={undo} disabled={isWatching}>Undo</button>
                    <button type="button" onClick={cancelPassActions} disabled={isWatching}>Cancel All</button>
                </div>
            </section>

            <section className="match-action-section">
                <h5>Rollback</h5>
                <div className="match-rollback-row">
                    <input
                        type="number"
                        min={0}
                        max={20}
                        value={rollbackTurns}
                        onChange={(event) => setRollbackTurns(Math.max(0, Number(event.target.value) || 0))}
                        disabled={isWatching}
                        aria-label="Rollback turns"
                    />
                    <button
                        type="button"
                        disabled={isWatching || !rollbackTurnsAllowed}
                        onClick={() => requestRollback(rollbackTurns)}
                    >
                        Custom
                    </button>
                </div>
                <div className="match-rollback-shortcuts" aria-label="Rollback shortcuts">
                    {rollbackQuickActions.map((rollback) => (
                        <button
                            key={rollback.turns}
                            type="button"
                            title={rollback.title}
                            disabled={isWatching || !rollbackTurnsAllowed}
                            onClick={() => requestRollback(rollback.turns)}
                            data-testid={`match-rollback-${rollback.turns}`}
                        >
                            {rollback.label}
                        </button>
                    ))}
                </div>
                <div className="match-action-grid">
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('REQUEST_PERMISSION_TO_ROLLBACK_TURN', targetPlayerId)}>
                        Ask Player
                    </button>
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('ADD_PERMISSION_TO_ROLLBACK_TURN', targetPlayerId)}>
                        Allow
                    </button>
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('DENY_PERMISSION_TO_ROLLBACK_TURN', targetPlayerId)}>
                        Deny
                    </button>
                </div>
            </section>

            <section className="match-action-section">
                <h5>Player</h5>
                <select
                    value={targetPlayerId}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                    disabled={otherPlayers.length === 0}
                    aria-label="Target player for match actions"
                >
                    {otherPlayers.map((player) => (
                        <option key={player.playerId} value={player.playerId}>
                            {player.name}
                        </option>
                    ))}
                </select>
                <div className="match-action-grid">
                    <button type="button" disabled={!hasTargetPlayer} onClick={() => sendPlayerAction('REQUEST_PERMISSION_TO_SEE_HAND_CARDS', targetPlayerId)}>
                        Ask Hand
                    </button>
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('ADD_PERMISSION_TO_SEE_HAND_CARDS', targetPlayerId)}>
                        Allow Hand
                    </button>
                    <button type="button" disabled={isWatching} onClick={() => sendPlayerAction('REVOKE_PERMISSIONS_TO_SEE_HAND_CARDS')}>
                        Revoke
                    </button>
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('VIEW_LIMITED_DECK', targetPlayerId)}>
                        Limited Deck
                    </button>
                    <button type="button" disabled={isWatching || !hasTargetPlayer} onClick={() => sendPlayerAction('VIEW_SIDEBOARD', targetPlayerId)}>
                        Sideboard
                    </button>
                </div>
            </section>

            <section className="match-action-section">
                <h5>Automation</h5>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.autoTapManaPayment}
                        disabled={isWatching}
                        onChange={(event) => updateManaAutomation('autoTapManaPayment', event.target.checked)}
                    />
                    Auto payment
                </label>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.manaPoolAutomaticRestricted}
                        disabled={isWatching}
                        onChange={(event) => updateManaAutomation('manaPoolAutomaticRestricted', event.target.checked)}
                    />
                    Preserve pool mana
                </label>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.useFirstManaAbility}
                        disabled={isWatching}
                        onChange={(event) => updateManaAutomation('useFirstManaAbility', event.target.checked)}
                    />
                    First mana ability
                </label>
                <p className="match-action-hint">Hold Alt+1 while tapping lands for a temporary first-mana override.</p>
            </section>

            <section className="match-action-section">
                <h5>Battlefield</h5>
                <label className="match-action-field">
                    <span>Grouping</span>
                    <select
                        value={settings.battlefieldGrouping}
                        onChange={(event) => setSetting('battlefieldGrouping', event.target.value as typeof settings.battlefieldGrouping)}
                        aria-label="Battlefield grouping"
                        data-testid="match-battlefield-grouping"
                    >
                        <option value="separate">Separate types</option>
                        <option value="nonlands">Nonlands + lands</option>
                        <option value="creature-land-other">Creatures / lands / other</option>
                    </select>
                </label>
                <label className="match-action-field">
                    <span>Seat order</span>
                    <select
                        value={settings.matchSeatOrientation}
                        onChange={(event) => setSetting('matchSeatOrientation', event.target.value as typeof settings.matchSeatOrientation)}
                        aria-label="Match seat orientation"
                        data-testid="match-seat-orientation"
                    >
                        <option value="table">Table order</option>
                        <option value="reverse">Reverse table</option>
                        <option value="active-first">Active player first</option>
                    </select>
                </label>
            </section>

            {showMatchOptions && (
                <section className="match-action-section" data-testid="match-options-section">
                    <h5>Match Options</h5>
                    <div className="match-option-summary">
                        <div className="match-option-chip" data-testid="match-range-chip">
                            <span>Range</span>
                            <strong>{formatMatchOption(rangeOfInfluence, rangeLabels)}</strong>
                        </div>
                        <div className="match-option-chip" data-testid="match-attack-option-chip">
                            <span>Attack</span>
                            <strong>{formatMatchOption(attackOption, attackOptionLabels)}</strong>
                        </div>
                    </div>
                </section>
            )}

            <section className="match-action-section">
                <h5>HUD</h5>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.alwaysShowPlayerNames}
                        onChange={(event) => setSetting('alwaysShowPlayerNames', event.target.checked)}
                        data-testid="match-player-names-toggle"
                    />
                    Always show names
                </label>
            </section>

            <section className="match-action-section">
                <h5>Card Detail</h5>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.showCardReminderText}
                        onChange={(event) => setSetting('showCardReminderText', event.target.checked)}
                        data-testid="match-card-reminder-toggle"
                    />
                    Reminder text
                </label>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.showCardSetInfo}
                        onChange={(event) => setSetting('showCardSetInfo', event.target.checked)}
                        data-testid="match-card-set-info-toggle"
                    />
                    Set symbol + metadata
                </label>
                <label className="match-action-toggle">
                    <input
                        type="checkbox"
                        checked={settings.showCardHints}
                        onChange={(event) => setSetting('showCardHints', event.target.checked)}
                        data-testid="match-card-hints-toggle"
                    />
                    Helper hints
                </label>
                <label className="match-action-field">
                    <span>Image fallback</span>
                    <select
                        value={settings.cardImageFallbackMode}
                        onChange={(event) => setSetting('cardImageFallbackMode', event.target.value as typeof settings.cardImageFallbackMode)}
                        data-testid="match-card-image-fallback-mode"
                        aria-label="Card image fallback mode"
                    >
                        <option value="card-back">Card back</option>
                        <option value="text-card">Text card</option>
                    </select>
                </label>
            </section>

            <section className="match-action-section">
                <h5>Resets</h5>
                <div className="match-action-grid">
                    {resetButtons.map((button) => (
                        <button key={button.action} type="button" disabled={isWatching} onClick={() => send(button)}>
                            {button.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="match-action-section">
                <h5>Exit</h5>
                <div className="match-action-grid">
                    <button type="button" onClick={() => sendPlayerAction('CLIENT_CONCEDE_GAME')} disabled={isWatching}>
                        Concede Game
                    </button>
                    <button type="button" onClick={() => sendPlayerAction('CLIENT_CONCEDE_MATCH')} disabled={isWatching}>
                        Concede Match
                    </button>
                    <button type="button" onClick={() => void confirmStopWatching()} disabled={!isWatching}>
                        Stop Watching
                    </button>
                    <button type="button" onClick={() => void confirmStopReplay()} disabled={!isReplay}>
                        Stop Replay
                    </button>
                </div>
            </section>
        </div>
    );
});
