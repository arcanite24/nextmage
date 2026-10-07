import React from 'react';
import { MatchView, RoomUsersView, UsersView } from '../../types';
import { Button } from '../common';
import './LobbyInfoPanels.css';

interface LobbyInfoPanelsProps {
    roomUsers: RoomUsersView | null;
    finishedMatches: MatchView[];
    currentUserName?: string | null;
    ignoredUsers?: string[];
    onWhisperUser?: (userName: string) => void;
    onShowUserHistory?: (userName: string) => void;
    onIgnoreUser?: (userName: string) => void;
    onUnignoreUser?: (userName: string) => void;
    onReplay?: (match: MatchView) => void;
}

export const LobbyInfoPanels: React.FC<LobbyInfoPanelsProps> = ({
    roomUsers,
    finishedMatches,
    currentUserName,
    ignoredUsers = [],
    onWhisperUser,
    onShowUserHistory,
    onIgnoreUser,
    onUnignoreUser,
    onReplay,
}) => {
    const users = roomUsers?.usersView ?? [];
    const visibleUsers = users.slice(0, 6);
    const visibleMatches = finishedMatches.slice(0, 4);
    const ignoredUserKeys = new Set(ignoredUsers.map(normalizeUserKey));
    const ignoredCount = ignoredUsers.length;

    return (
        <div className="lobby-info-panels" data-testid="lobby-info-panels">
            <section className="lobby-side-panel room-users-panel" data-testid="room-users-panel">
                <header className="side-panel-header">
                    <div>
                        <h3>Players</h3>
                        <span>{users.length} online{ignoredCount > 0 ? ` / ${ignoredCount} ignored` : ''}</span>
                    </div>
                    <div className="room-capacity" title="Active games, active game threads, and game-thread limit">
                        {roomUsers ? `${roomUsers.numberActiveGames}/${roomUsers.numberGameThreads}/${roomUsers.numberMaxGames}` : '-'}
                    </div>
                </header>

                <div className="room-users-list">
                    {visibleUsers.length > 0 ? visibleUsers.map(user => (
                        <RoomUserRow
                            key={user.userName}
                            user={user}
                            isCurrentUser={normalizeUserKey(user.userName) === normalizeUserKey(currentUserName ?? '')}
                            isIgnored={ignoredUserKeys.has(normalizeUserKey(user.userName))}
                            onWhisperUser={onWhisperUser}
                            onShowUserHistory={onShowUserHistory}
                            onIgnoreUser={onIgnoreUser}
                            onUnignoreUser={onUnignoreUser}
                        />
                    )) : (
                        <div className="side-panel-empty">No players listed</div>
                    )}
                </div>
            </section>

            <section className="lobby-side-panel finished-matches-panel" data-testid="finished-matches-panel">
                <header className="side-panel-header">
                    <div>
                        <h3>Finished</h3>
                        <span>{finishedMatches.length} matches</span>
                    </div>
                </header>

                <div className="finished-match-list">
                    {visibleMatches.length > 0 ? visibleMatches.map(match => (
                        <FinishedMatchRow
                            key={match.matchId}
                            match={match}
                            onReplay={onReplay}
                        />
                    )) : (
                        <div className="side-panel-empty">No finished matches</div>
                    )}
                </div>
            </section>
        </div>
    );
};

interface RoomUserRowProps {
    user: UsersView;
    isCurrentUser: boolean;
    isIgnored: boolean;
    onWhisperUser?: (userName: string) => void;
    onShowUserHistory?: (userName: string) => void;
    onIgnoreUser?: (userName: string) => void;
    onUnignoreUser?: (userName: string) => void;
}

const RoomUserRow: React.FC<RoomUserRowProps> = ({
    user,
    isCurrentUser,
    isIgnored,
    onWhisperUser,
    onShowUserHistory,
    onIgnoreUser,
    onUnignoreUser,
}) => {
    const canToggleIgnore = !isCurrentUser && Boolean(onIgnoreUser && onUnignoreUser);
    const canMessageUser = !isCurrentUser && Boolean(onWhisperUser);
    const canShowHistory = Boolean(onShowUserHistory);

    return (
        <article
            className={`room-user-row${isIgnored ? ' is-ignored' : ''}`}
            data-testid="room-user-row"
            data-user-name={user.userName}
            data-ignored={isIgnored ? 'true' : 'false'}
        >
            <div className="room-user-main">
                <span className="user-flag-pill" title={user.flagName}>
                    {formatFlagLabel(user.flagName)}
                </span>
                <div className="room-user-identity">
                    <strong>{user.userName}</strong>
                    <span>{user.infoGames || 'Idle'}</span>
                </div>
                <div className="room-user-actions">
                    {isIgnored && (
                        <span className="room-user-state" data-testid="room-user-ignored-badge">
                            Ignored
                        </span>
                    )}
                    {canMessageUser && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="room-user-action-button"
                            title={`Whisper to ${user.userName}`}
                            onClick={() => onWhisperUser?.(user.userName)}
                            data-testid="room-user-whisper-button"
                        >
                            Whisper
                        </Button>
                    )}
                    {canShowHistory && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="room-user-action-button"
                            title={`Show ${user.userName}'s match history`}
                            onClick={() => onShowUserHistory?.(user.userName)}
                            data-testid="room-user-history-button"
                        >
                            Stats
                        </Button>
                    )}
                    {canToggleIgnore && (
                        <Button
                            type="button"
                            variant={isIgnored ? 'secondary' : 'ghost'}
                            size="sm"
                            className="room-user-action-button"
                            title={isIgnored
                                ? `Remove ${user.userName} from your ignored users`
                                : `Ignore ${user.userName} on this server`}
                            onClick={() => isIgnored ? onUnignoreUser?.(user.userName) : onIgnoreUser?.(user.userName)}
                            data-testid={isIgnored ? 'room-user-unignore-button' : 'room-user-ignore-button'}
                        >
                            {isIgnored ? 'Allow' : 'Ignore'}
                        </Button>
                    )}
                </div>
            </div>
            <div className="room-user-meta">
                <span title={`Constructed rating ${user.constructedRating}`}>C {formatRating(user.constructedRating)}</span>
                <span title={`Limited rating ${user.limitedRating}`}>L {formatRating(user.limitedRating)}</span>
                <span title={user.infoPing}>{user.infoPing || 'ping -'}</span>
            </div>
            <div className="room-user-history">
                <span title={`Match history: ${user.matchHistory}`}>{user.matchHistory || '-'}</span>
                <span title={`Match quit ratio: ${user.matchQuitRatio}%`}>{user.matchQuitRatio}%</span>
                <span title={`Tournament history: ${user.tourneyHistory}`}>{user.tourneyHistory || '-'}</span>
                <span title={`Tournament quit ratio: ${user.tourneyQuitRatio}%`}>{user.tourneyQuitRatio}%</span>
            </div>
        </article>
    );
};

interface FinishedMatchRowProps {
    match: MatchView;
    onReplay?: (match: MatchView) => void;
}

const FinishedMatchRow: React.FC<FinishedMatchRowProps> = ({ match, onReplay }) => {
    const canReplay = Boolean(onReplay && match.replayAvailable && match.games?.[0]);

    return (
        <article
            className="finished-match-row"
            data-testid="finished-match-card"
            data-match-id={match.matchId}
        >
            <div className="finished-match-main">
                <strong title={match.matchName}>{match.matchName || 'Finished match'}</strong>
                <span title={match.players}>{match.players || 'Players unavailable'}</span>
            </div>
            <div className="finished-match-meta">
                <span>{match.deckType || '-'}</span>
                <span>{formatMatchTime(match.endTime || match.startTime)}</span>
            </div>
            <div className="finished-match-footer">
                <span title={match.result}>{match.result || 'Finished'}</span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onReplay?.(match)}
                    disabled={!canReplay}
                    data-testid="finished-match-replay-button"
                >
                    Replay
                </Button>
            </div>
        </article>
    );
};

function formatFlagLabel(flagName: string): string {
    const normalized = flagName.replace(/\.[^.]+$/, '').trim();
    if (!normalized || normalized.toLowerCase() === 'world') return 'WRLD';
    return normalized.slice(0, 4).toUpperCase();
}

function formatRating(value: number): string {
    return Number.isFinite(value) ? String(value) : '-';
}

function normalizeUserKey(userName: string): string {
    return userName.trim().toLowerCase();
}

function formatMatchTime(value: string | number | null | undefined): string {
    // the server sends epoch milliseconds; older payloads and fixtures use date strings
    const timestamp = typeof value === 'number' ? value : Date.parse(value ?? '');
    if (!Number.isFinite(timestamp)) return value ? String(value) : '-';
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(timestamp));
}

export default LobbyInfoPanels;
