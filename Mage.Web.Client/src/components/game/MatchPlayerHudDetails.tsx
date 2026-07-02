import React, { useMemo } from 'react';
import { ManaPoolView, ManaType, PlayerView } from '../../types';
import './ArenaLayout.css';

type ZoneName = 'graveyard' | 'exile' | 'library' | 'sideboard';

interface MatchPlayerHudDetailsProps {
    player: PlayerView;
    variant: 'player' | 'opponent';
    displayedLife: number;
    onShowZone?: (zone: ZoneName, playerId: string) => void;
    onManaClick?: (manaType: ManaType) => void;
}

interface MatchPlayerFlagPillProps {
    flagName?: string;
}

const MANA_PIPS: Array<{ key: keyof ManaPoolView; type: ManaType; label: string; className: string }> = [
    { key: 'white', type: ManaType.WHITE, label: 'White', className: 'w' },
    { key: 'blue', type: ManaType.BLUE, label: 'Blue', className: 'u' },
    { key: 'black', type: ManaType.BLACK, label: 'Black', className: 'b' },
    { key: 'red', type: ManaType.RED, label: 'Red', className: 'r' },
    { key: 'green', type: ManaType.GREEN, label: 'Green', className: 'g' },
    { key: 'colorless', type: ManaType.COLORLESS, label: 'Colorless', className: 'c' },
];

function formatFlagLabel(flagName: string | undefined): string | null {
    if (!flagName) {
        return null;
    }

    const normalized = flagName.replace(/\.[^.]+$/, '').trim();
    if (!normalized) {
        return null;
    }

    return normalized.toLowerCase() === 'world' ? 'WRLD' : normalized.slice(0, 4).toUpperCase();
}

function countCards(cards: Record<string, unknown> | undefined): number {
    return cards ? Object.keys(cards).length : 0;
}

function formatTimer(seconds: number | undefined): string | null {
    if (seconds === undefined || seconds < 0) {
        return null;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function findCounter(player: PlayerView, matchers: string[]): number {
    return player.counters
        .filter((counter) => {
            const name = counter.name.toLowerCase();
            return matchers.some((matcher) => name.includes(matcher));
        })
        .reduce((total, counter) => total + counter.count, 0);
}

function getArbitraryCounters(player: PlayerView): Array<{ name: string; count: number }> {
    const hiddenMatchers = ['poison', 'energy', 'experience', 'rad'];
    return player.counters.filter((counter) => {
        const name = counter.name.toLowerCase();
        return !hiddenMatchers.some((matcher) => name.includes(matcher));
    });
}

function designationClassName(designation: string): string {
    return designation.trim().toLowerCase() === 'city blessing'
        ? 'match-hud-chip designation city-blessing'
        : 'match-hud-chip designation';
}

export const MatchPlayerFlagPill: React.FC<MatchPlayerFlagPillProps> = React.memo(({ flagName }) => {
    const label = useMemo(() => formatFlagLabel(flagName), [flagName]);

    if (!label) {
        return null;
    }

    return (
        <span className="match-hud-flag-pill" title={`Flag: ${flagName}`} data-testid="match-hud-flag">
            {label}
        </span>
    );
});

export const MatchPlayerHudDetails: React.FC<MatchPlayerHudDetailsProps> = React.memo(({
    player,
    variant,
    displayedLife,
    onShowZone,
    onManaClick,
}) => {
    const graveyardCount = useMemo(() => countCards(player.graveyard), [player.graveyard]);
    const exileCount = useMemo(() => countCards(player.exile), [player.exile]);
    const sideboardCount = useMemo(() => countCards(player.sideboard), [player.sideboard]);
    const commandZoneCount = useMemo(
        () => Math.max(player.commandList?.length ?? 0, player.commandObjectList?.length ?? 0),
        [player.commandList, player.commandObjectList],
    );
    const poisonCounters = useMemo(() => findCounter(player, ['poison']), [player]);
    const energyCounters = useMemo(() => findCounter(player, ['energy']), [player]);
    const experienceCounters = useMemo(() => findCounter(player, ['experience']), [player]);
    const radCounters = useMemo(() => findCounter(player, ['rad']), [player]);
    const arbitraryCounters = useMemo(() => getArbitraryCounters(player), [player]);
    const priorityTimer = useMemo(() => formatTimer(player.priorityTimeLeftSecs), [player.priorityTimeLeftSecs]);
    const bufferTimer = useMemo(() => formatTimer(player.bufferTimeLeft), [player.bufferTimeLeft]);
    const hasMana = useMemo(
        () => MANA_PIPS.some(({ key }) => player.manaPool[key] > 0),
        [player.manaPool],
    );
    const isInteractiveMana = Boolean(onManaClick);

    return (
        <div className={`match-hud-details match-hud-details-${variant}`} data-testid={`${variant}-hud-details`}>
            <div className="match-hud-status-row">
                {player.isActive && <span className="match-hud-chip active">Active</span>}
                {player.hasPriority && <span className="match-hud-chip priority">Priority</span>}
                {player.hasLeft && <span className="match-hud-chip danger">Left</span>}
                {displayedLife <= 0 && <span className="match-hud-chip danger">Dead</span>}
                {player.monarch && <span className="match-hud-chip">Monarch</span>}
                {player.initiative && <span className="match-hud-chip">Initiative</span>}
                {player.designationNames.map((designation) => (
                    <span key={designation} className={designationClassName(designation)} data-testid="match-hud-designation">
                        {designation}
                    </span>
                ))}
            </div>

            <div className="match-hud-meter-grid" aria-label={`${player.name} match statistics`}>
                <button type="button" className="match-hud-meter" onClick={() => onShowZone?.('library', player.playerId)}>
                    <span className="match-hud-meter-label">Library</span>
                    <span className="match-hud-meter-value">{player.libraryCount}</span>
                </button>
                <div className="match-hud-meter">
                    <span className="match-hud-meter-label">Hand</span>
                    <span className="match-hud-meter-value">{player.handCount}</span>
                </div>
                <button type="button" className="match-hud-meter" onClick={() => onShowZone?.('graveyard', player.playerId)}>
                    <span className="match-hud-meter-label">Grave</span>
                    <span className="match-hud-meter-value">{graveyardCount}</span>
                </button>
                <button type="button" className="match-hud-meter" onClick={() => onShowZone?.('exile', player.playerId)}>
                    <span className="match-hud-meter-label">Exile</span>
                    <span className="match-hud-meter-value">{exileCount}</span>
                </button>
                <div className="match-hud-meter">
                    <span className="match-hud-meter-label">Command</span>
                    <span className="match-hud-meter-value">{commandZoneCount}</span>
                </div>
                <button type="button" className="match-hud-meter" onClick={() => onShowZone?.('sideboard', player.playerId)}>
                    <span className="match-hud-meter-label">Side</span>
                    <span className="match-hud-meter-value">{sideboardCount}</span>
                </button>
            </div>

            <div className="match-hud-counter-row">
                {poisonCounters > 0 && <span className="match-hud-counter poison">Poison {poisonCounters}</span>}
                {energyCounters > 0 && <span className="match-hud-counter energy">Energy {energyCounters}</span>}
                {experienceCounters > 0 && <span className="match-hud-counter experience">XP {experienceCounters}</span>}
                {radCounters > 0 && <span className="match-hud-counter rad">Rad {radCounters}</span>}
                {arbitraryCounters.map((counter) => (
                    <span key={counter.name} className="match-hud-counter">
                        {counter.name} {counter.count}
                    </span>
                ))}
                <span className="match-hud-counter">Wins {player.wins}/{player.winsNeeded}</span>
                {priorityTimer && <span className={player.timerActive ? 'match-hud-counter timer active' : 'match-hud-counter timer'}>Pri {priorityTimer}</span>}
                {bufferTimer && <span className="match-hud-counter timer">Buf {bufferTimer}</span>}
            </div>

            {hasMana && (
                <div className="match-hud-mana-row" aria-label={`${player.name} mana pool`}>
                    {MANA_PIPS.map(({ key, type, label, className }) => {
                        const count = player.manaPool[key];
                        if (count <= 0) {
                            return null;
                        }

                        return (
                            <button
                                key={type}
                                type="button"
                                className={`arena-mana-pip ${className} ${isInteractiveMana ? 'interactive' : ''}`}
                                disabled={!isInteractiveMana}
                                onClick={() => onManaClick?.(type)}
                                title={isInteractiveMana ? `Pay ${label} mana from pool` : `${label} mana in pool`}
                                aria-label={`${count} ${label} mana`}
                            >
                                {count}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
