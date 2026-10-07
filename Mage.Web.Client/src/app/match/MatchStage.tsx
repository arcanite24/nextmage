import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import type { Command } from '../../core/game/interaction';
import type { CardView, GameView } from '../../protocol/generated/views';
import { rosterOf, sleeveFor, SLEEVE_COLORS, useDecks } from '../stores/decks';
import { useEvents } from '../stores/events';
import { useGames } from '../stores/games';
import { usePlay } from '../stores/play';
import { useSettings } from '../stores/settings';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Dialog } from '../ui/Dialog';
import { ActionCluster } from './ActionCluster';
import { Arrows } from './Arrows';
import { buildBoard, fitCardWidth, type PermanentGroup, type PlayerBoard } from './boardModel';
import { CardZoom } from './CardZoom';
import { setCardMotion, useFlipOrigin } from './flip';
import { GameLog } from './GameLog';
import { Hand } from './Hand';
import { useMatchUi } from './matchUi';
import { CardPicker, ChoicePanel, GameOverOverlay, MulliganOverlay, ZoneViewer } from './Overlays';
import { PermanentStack } from './PermanentStack';
import { PhaseLadder } from './PhaseLadder';
import { Piles } from './Piles';
import { PlayerPlate } from './PlayerPlate';
import { StackZone } from './StackZone';
import { Stage } from './Stage';
import { STAGE_HEIGHT } from './stageContext';
import styles from './MatchStage.module.css';

/** The battlefield's horizontal span on the stage, between the seats (left) and the stack and decision corner (right). */
const FIELD_LEFT = 300;
const FIELD_RIGHT = 1450;
const FIELD_WIDTH = FIELD_RIGHT - FIELD_LEFT;
const EMPTY: ReadonlySet<string> = new Set();

/** Attacking and blocking permanents, from the combat groups. */
function combatSets(combat: GameView['combat']) {
  const attacking = new Set<string>();
  const blocking = new Set<string>();
  const links: [string, string][] = [];
  for (const group of combat ?? []) {
    const attackers = Object.keys(group.attackers ?? {});
    attackers.forEach((id) => attacking.add(id));
    for (const blocker of Object.keys(group.blockers ?? {})) {
      blocking.add(blocker);
      attackers.forEach((attacker) => links.push([blocker, attacker]));
    }
  }
  return { attacking, blocking, links };
}

function useSleeves() {
  const deckId = usePlay((state) => state.deckId);
  const sleeves = useDecks((state) => state.sleeves);
  const saved = useDecks((state) => state.saved);
  const starters = useDecks((state) => state.starters);
  return useMemo(() => {
    const deck = rosterOf({ saved, starters }).find((candidate) => candidate.id === deckId);
    const mine = sleeveFor(sleeves, deck);
    // opponents' sleeves must read as "theirs" at a glance
    const theirs = SLEEVE_COLORS.find((color) => color !== mine && color !== SLEEVE_COLORS[0]) ?? SLEEVE_COLORS[2];
    return { mine, theirs };
  }, [deckId, sleeves, saved, starters]);
}

export function MatchStage({ session, state }: { session: GameSession; state: GameSessionState }) {
  const { view, interaction, playerId, mode, awaitingServer } = state;
  const navigate = useNavigate();
  const animations = useSettings((settings) => settings.settings.animations);
  const viewer = useMatchUi((ui) => ui.viewer);
  const openViewer = useMatchUi((ui) => ui.openViewer);
  const sleeves = useSleeves();
  const [holding, setHolding] = useState(false);

  useEffect(() => setCardMotion(animations), [animations]);
  // a new game starts with a clean table
  useEffect(() => () => useMatchUi.setState({ zoom: null, dragging: null, viewer: null, logOpen: false }), []);

  const board = useMemo(() => buildBoard(view, playerId), [view, playerId]);
  const clickable = useMemo(() => new Set(interaction.clickable.keys()), [interaction.clickable]);
  const combat = view?.combat;
  const { attacking, blocking, links } = useMemo(() => combatSets(combat), [combat]);
  // lands can always tap for mana while you hold priority; glowing them all would drown the real options
  const quiet = useMemo(() => {
    if (interaction.mode !== 'priority' || !board.me) return EMPTY;
    const lands = new Set<string>();
    for (const group of board.me.back) {
      for (const permanent of group.members) {
        if ((permanent.cardTypes ?? []).includes('LAND')) lands.add(permanent.id!);
      }
    }
    return lands;
  }, [interaction.mode, board.me]);
  const hand = useMemo(() => Object.values(view?.myHand ?? {}), [view?.myHand]);
  const stack = useMemo(() => Object.values(view?.stack ?? {}), [view?.stack]);

  const onCommand = useCallback((command: Command) => {
    if (command.type === 'action' && (command.action === 'HOLD_PRIORITY' || command.action === 'UNHOLD_PRIORITY')) {
      setHolding(command.action === 'HOLD_PRIORITY');
    }
    void session.respond(command).catch(() => undefined);
  }, [session]);
  const onClick = useCallback((id: string) => session.click(id), [session]);

  const myId = board.me?.player.playerId ?? null;
  const sleeveOf = useCallback((card: CardView) => (card.controllerId && card.controllerId !== myId ? sleeves.theirs : sleeves.mine), [myId, sleeves]);
  const originOf = useCallback((card: CardView) => (card.controllerId && card.controllerId !== myId ? `hand:${card.controllerId}` : undefined), [myId]);

  // games inside an event lead back to the event; others back to Play
  const eventId = useEvents((events) => events.currentTournamentId);
  const leave = useCallback(() => {
    useGames.getState().close(state.gameId);
    navigate(eventId ? `/event/${eventId}` : '/');
  }, [navigate, state.gameId, eventId]);
  const deckId = usePlay((play) => play.deckId);
  const playAgain = useCallback(() => {
    const { lastOptions } = usePlay.getState();
    leave();
    if (deckId) void usePlay.getState().playVsAi(deckId, lastOptions);
  }, [leave, deckId]);

  // the arrow starts at the spell being cast (top of the stack) while it chooses targets
  const choosingTargets = interaction.mode === 'target' && !awaitingServer;
  const arrowSource = stack[0]?.id ?? null;
  const arrowTargets = useMemo(() => {
    if (choosingTargets) return [...interaction.selected];
    return (stack[0]?.targets ?? []).filter(Boolean) as string[];
  }, [choosingTargets, interaction.selected, stack]);

  const prompt = interaction.prompt;
  const pregame = !view?.step;
  const handIds = useMemo(() => new Set(hand.map((card) => card.id!)), [hand]);
  // London mulligan: choose cards from the opening hand to put on the bottom
  const choosingFromHand = interaction.mode === 'target' && pregame && clickable.size > 0 && [...clickable].every((id) => handIds.has(id));
  const pickerCards = interaction.mode === 'pickCards' && prompt?.kind === 'target' && prompt.cards
    ? Object.values(prompt.cards)
    : choosingFromHand ? hand : null;
  const canAct = mode === 'play' && !state.gameOver;

  return (
    <Stage>
      <div className={styles.mat} aria-hidden="true" />
      <div className={styles.seam} aria-hidden="true" />

      {board.opponents.map((opponent, index) => (
        <OpponentSide
          key={opponent.player.playerId}
          board={opponent}
          index={index}
          count={board.opponents.length}
          sleeve={sleeves.theirs}
          handCount={opponent.player.handCount ?? 0}
          clickable={clickable}
          selected={interaction.selected}
          quiet={EMPTY}
          attacking={attacking}
          blocking={blocking}
          onClick={onClick}
          deciding={!!opponent.player.hasPriority && interaction.mode === 'waiting'}
        />
      ))}

      {board.me && (
        <>
          <Battlefield board={board.me} sleeve={sleeves.mine} clickable={clickable} selected={interaction.selected} quiet={quiet} attacking={attacking} blocking={blocking} onClick={onClick} left={FIELD_LEFT} width={FIELD_WIDTH} frontTop={572} backTop={770} />
          <div className={styles.myPlate}>
            <PlayerPlate
              player={board.me.player}
              isMe={board.me.isMe}
              targetable={clickable.has(board.me.player.playerId!)}
              selected={interaction.selected.has(board.me.player.playerId!)}
              deciding={canAct && interaction.mode !== 'waiting' && !awaitingServer}
              onClick={() => onClick(board.me!.player.playerId!)}
            />
          </div>
          <div className={styles.myPiles}>
            <Piles player={board.me.player} sleeve={sleeves.mine} isMe={board.me.isMe} />
          </div>
        </>
      )}

      <StackZone items={stack} clickable={clickable} selected={interaction.selected} sleeveOf={sleeveOf} onClick={onClick} originOf={originOf} />
      <PhaseLadder step={view?.step} myTurn={!!myId && view?.activePlayerId === myId} turn={view?.turn ?? 0} />

      {mode === 'play' && board.me && (
        <Hand
          cards={hand}
          clickable={pickerCards ? EMPTY : clickable}
          selected={interaction.selected}
          sleeve={sleeves.mine}
          onPlay={onClick}
          playLine={STAGE_HEIGHT - 300}
          libraryOrigin={`library:${board.me.player.playerId}`}
        />
      )}

      {mode === 'play' ? (
        <ActionCluster
          interaction={interaction}
          awaiting={awaitingServer}
          status={state.status}
          canAct={canAct}
          special={!!view?.special}
          holdingPriority={holding}
          onCommand={onCommand}
        />
      ) : (
        <div className={styles.watching}>
          <p>{mode === 'watch' ? 'Watching' : 'Replay'}</p>
          <Button variant="print" onClick={leave}>Leave</Button>
        </div>
      )}

      <Arrows sourceId={arrowSource} targetIds={arrowTargets} live={choosingTargets} links={links} />
      <GameLog gameId={state.gameId} notices={state.notices} canChat={mode !== 'replay'} />
      <GameMenu canConcede={canAct} onConcede={() => onCommand({ type: 'action', action: 'CONCEDE' })} onLeave={leave} />

      {interaction.mode === 'mulligan' && !awaitingServer && (
        <MulliganOverlay hand={hand} interaction={interaction} sleeve={sleeves.mine} onCommand={onCommand} />
      )}
      {pickerCards && !awaitingServer && (
        <CardPicker
          title={choosingFromHand ? 'Put cards on the bottom' : 'Choose cards'}
          cards={pickerCards}
          interaction={interaction}
          sleeve={sleeves.mine}
          onCommand={onCommand}
        />
      )}
      {interaction.mode === 'panel' && prompt && !awaitingServer && <ChoicePanel prompt={prompt} onCommand={onCommand} />}
      {viewer && <ZoneViewer title={viewer.title} cards={viewer.cards} onClose={() => openViewer(null)} />}
      {state.gameOver && (
        <GameOverOverlay
          message={state.gameOver}
          endInfo={state.endInfo}
          onLeave={leave}
          leaveLabel={eventId ? 'Back to the event' : 'Back to Play'}
          onPlayAgain={mode === 'play' && deckId && !eventId ? playAgain : undefined}
        />
      )}
      <CardZoom />
    </Stage>
  );
}

interface RowProps {
  sleeve: string;
  clickable: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  quiet: ReadonlySet<string>;
  attacking: ReadonlySet<string>;
  blocking: ReadonlySet<string>;
  onClick(id: string): void;
}

/** One player's two rows of permanents. Rows shrink their cards to fit rather than wrapping. */
const Battlefield = memo(function Battlefield({ board, left, width, frontTop, backTop, ...row }: RowProps & {
  board: PlayerBoard;
  left: number;
  width: number;
  frontTop: number;
  backTop: number;
}) {
  const forward = board.isMe ? -1 : 1;
  return (
    <>
      <Row groups={board.front} left={left} width={width} top={frontTop} ideal={128} min={58} forward={forward} {...row} />
      <Row groups={board.back} left={left} width={width} top={backTop} ideal={98} min={50} forward={forward} {...row} />
    </>
  );
});

function Row({ groups, left, width, top, ideal, min, forward, ...rest }: RowProps & {
  groups: PermanentGroup[];
  left: number;
  width: number;
  top: number;
  ideal: number;
  min: number;
  forward: 1 | -1;
}) {
  const cardWidth = fitCardWidth(groups, width, ideal, min);
  return (
    <div className={styles.row} style={{ left, top, width, gap: cardWidth * 0.12 }}>
      {groups.map((group) => (
        <PermanentStack key={group.key} group={group} width={cardWidth} forward={forward} {...rest} />
      ))}
    </div>
  );
}

/** An opponent's half: their rows mirrored above the seam, their seat, piles and hidden hand. */
function OpponentSide({ board, index, count, sleeve, handCount, deciding, ...row }: RowProps & {
  board: PlayerBoard;
  index: number;
  count: number;
  handCount: number;
  deciding: boolean;
}) {
  const width = FIELD_WIDTH / count;
  const left = FIELD_LEFT + index * width;
  const player = board.player;
  const plateTop = count === 1 ? 24 : 24 + index * 120;
  return (
    <>
      <Battlefield board={board} sleeve={sleeve} left={left} width={width - (count > 1 ? 24 : 0)} frontTop={count === 1 ? 330 : 300} backTop={count === 1 ? 160 : 150} {...row} />
      <div className={styles.theirPlate} style={{ top: plateTop }}>
        <PlayerPlate
          player={player}
          isMe={false}
          targetable={row.clickable.has(player.playerId!)}
          selected={row.selected.has(player.playerId!)}
          deciding={deciding}
          onClick={() => row.onClick(player.playerId!)}
        />
      </div>
      {count === 1 && (
        <div className={styles.theirPiles}>
          <Piles player={player} sleeve={sleeve} isMe={false} />
        </div>
      )}
      <HiddenHand playerId={player.playerId!} count={handCount} sleeve={sleeve} left={left + width / 2} />
    </>
  );
}

/** The backs of an opponent's hand peeking over the top edge; their spells fly out of it. */
function HiddenHand({ playerId, count, sleeve, left }: { playerId: string; count: number; sleeve: string; left: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFlipOrigin(`hand:${playerId}`, ref);
  const shown = Math.min(count, 10);
  return (
    <div ref={ref} className={styles.hiddenHand} style={{ left }} aria-label={`${count} cards in hand`} role="img">
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} className={styles.hiddenCard} style={{ ['--i' as string]: i - (shown - 1) / 2 }}>
          <CardFace card={{}} hidden sleeve={sleeve} size="small" />
        </div>
      ))}
      {count > 0 && <span className={styles.handCount}>{count}</span>}
    </div>
  );
}

function GameMenu({ canConcede, onConcede, onLeave }: { canConcede: boolean; onConcede(): void; onLeave(): void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={styles.menu}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={styles.menuButton} aria-label="Game menu">
          <Menu size={24} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menuContent} align="end" sideOffset={8}>
            {canConcede && (
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => setConfirming(true)}>Concede</DropdownMenu.Item>
            )}
            <DropdownMenu.Item className={styles.menuItem} onSelect={() => (canConcede ? setConfirming(true) : onLeave())}>
              Leave the game
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Concede this game?"
        description="Your opponent wins this game. You can't undo it."
        width="sm"
        footer={(
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>Keep playing</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onConcede();
              }}
            >
              Concede
            </Button>
          </>
        )}
      >
        {null}
      </Dialog>
    </div>
  );
}
