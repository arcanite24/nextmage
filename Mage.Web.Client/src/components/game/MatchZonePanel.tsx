import React, { useMemo } from 'react';
import { GameView, PlayerView } from '../../types';
import { getPlayerCommandZoneGroups, getSharedPlanes } from '../../services/CommandZoneService';
import { GameZoneView } from '../../stores/gameStore';
import './MatchZonePanel.css';

interface MatchZonePanelProps {
    gameView: GameView;
    onShowZone: (zone: GameZoneView | null, viewId?: string | null) => void;
}

interface ZoneButton {
    key: string;
    label: string;
    count: number;
    zone: GameZoneView;
    viewId?: string | null;
    tone?: 'player' | 'shared' | 'hidden';
}

function countCards(cards: Record<string, unknown> | undefined): number {
    return cards ? Object.keys(cards).length : 0;
}

function playerZoneButtons(player: PlayerView): ZoneButton[] {
    const commandGroups = getPlayerCommandZoneGroups(player);
    return [
        { key: `${player.playerId}-graveyard`, label: `${player.name} Grave`, count: countCards(player.graveyard), zone: 'graveyard', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-exile`, label: `${player.name} Exile`, count: countCards(player.exile), zone: 'exile', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-sideboard`, label: `${player.name} Side`, count: countCards(player.sideboard), zone: 'sideboard', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-commanders`, label: `${player.name} Commanders`, count: commandGroups.commanders.length, zone: 'commanders', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-dungeons`, label: `${player.name} Dungeons`, count: commandGroups.dungeons.length, zone: 'dungeons', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-command-emblems`, label: `${player.name} Emblems`, count: commandGroups.emblems.length, zone: 'commandEmblems', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-command-other`, label: `${player.name} Command`, count: commandGroups.other.length, zone: 'commandOther', viewId: player.playerId, tone: 'player' },
        { key: `${player.playerId}-top`, label: `${player.name} Top`, count: player.topCard ? 1 : 0, zone: 'topLibrary', viewId: player.playerId, tone: 'hidden' },
    ];
}

export const MatchZonePanel: React.FC<MatchZonePanelProps> = React.memo(({ gameView, onShowZone }) => {
    const zoneButtons = useMemo(() => {
        const buttons: ZoneButton[] = [];

        gameView.players.forEach((player) => {
            buttons.push(...playerZoneButtons(player));
        });

        const planes = getSharedPlanes(gameView.players);
        buttons.push({
            key: 'shared-planes',
            label: 'Planes',
            count: planes.length,
            zone: 'planes',
            tone: 'shared',
        });

        gameView.exiles?.forEach((exile) => {
            buttons.push({
                key: `exile-${exile.id}`,
                label: exile.name || 'Exile Group',
                count: countCards(exile.cards),
                zone: 'exileGroup',
                viewId: exile.id,
                tone: 'shared',
            });
        });

        gameView.revealed?.forEach((revealed, index) => {
            buttons.push({
                key: `revealed-${index}`,
                label: revealed.name || 'Revealed',
                count: countCards(revealed.cards),
                zone: 'revealed',
                viewId: String(index),
                tone: 'shared',
            });
        });

        gameView.lookedAt?.forEach((lookedAt, index) => {
            buttons.push({
                key: `looked-${index}`,
                label: lookedAt.name || 'Looked At',
                count: countCards(lookedAt.cards),
                zone: 'lookedAt',
                viewId: String(index),
                tone: 'hidden',
            });
        });

        gameView.companion?.forEach((companion, index) => {
            buttons.push({
                key: `companion-${index}`,
                label: companion.name || 'Companion',
                count: countCards(companion.cards),
                zone: 'companion',
                viewId: String(index),
                tone: 'shared',
            });
        });

        Object.entries(gameView.opponentHands || {}).forEach(([playerId, hand]) => {
            const playerName = gameView.players.find((player) => player.playerId === playerId)?.name || 'Opponent';
            buttons.push({
                key: `opponent-hand-${playerId}`,
                label: `${playerName} Hand`,
                count: countCards(hand),
                zone: 'opponentHand',
                viewId: playerId,
                tone: 'hidden',
            });
        });

        Object.entries(gameView.watchedHands || {}).forEach(([playerId, hand]) => {
            const playerName = gameView.players.find((player) => player.playerId === playerId)?.name || 'Watched';
            buttons.push({
                key: `watched-hand-${playerId}`,
                label: `${playerName} Watched`,
                count: countCards(hand),
                zone: 'watchedHand',
                viewId: playerId,
                tone: 'hidden',
            });
        });

        buttons.push({
            key: 'helper-emblems',
            label: 'Helper Emblems',
            count: countCards(gameView.myHelperEmblems),
            zone: 'emblems',
            tone: 'shared',
        });

        return buttons.filter((button) => button.count > 0 || button.tone === 'hidden');
    }, [gameView]);

    return (
        <div className="match-zone-panel" data-testid="match-zone-panel">
            <div className="match-zone-panel-header">
                <h5>Zones</h5>
                <span>{zoneButtons.length}</span>
            </div>
            <div className="match-zone-grid">
                {zoneButtons.map((button) => (
                    <button
                        key={button.key}
                        type="button"
                        className={`match-zone-button ${button.tone || 'shared'}`}
                        onClick={() => onShowZone(button.zone, button.viewId ?? null)}
                        aria-label={`Open ${button.label}`}
                    >
                        <span className="match-zone-label">{button.label}</span>
                        <span className="match-zone-count">{button.count}</span>
                    </button>
                ))}
            </div>
        </div>
    );
});
