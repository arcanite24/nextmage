import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import type { Command } from '../../core/game/interaction';
import { pregameChoice } from '../../core/game/pregame';
import type { CardView, GameView } from '../../protocol/generated/views';
import { rosterOf, sleeveFor, SLEEVE_COLORS, useDecks } from '../stores/decks';
import { useEvents } from '../stores/events';
import { useGames } from '../stores/games';
import { usePlay } from '../stores/play';
import { useSettings } from '../stores/settings';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Dialog } from '../ui/Dialog';
import { MatPrint } from '../ui/MatPrint';
import { SettingsDialog } from '../screens/SettingsDialog';
import { Stitch } from '../ui/Stitch';
import { ActionCluster } from './ActionCluster';
import { Arrows } from './Arrows';
import { buildBoard, fitCardWidth, type PermanentGroup, type PlayerBoard } from './boardModel';
import { CardDetail } from './CardDetail';
import { CardZoom } from './CardZoom';
import { setCardMotion, useFlipOrigin } from './flip';
import { GameLog } from './GameLog';
import { Hand } from './Hand';
import { useMatchUi } from './matchUi';
import { useGameCues } from './useGameCues';
import { useWarmImages } from './useWarmImages';
import { useAutoPay } from './useAutoPay';
import { useAutoPass } from './useAutoPass';
import { Vfx } from './Vfx';
import { CardPicker, ChoicePanel, GameOverOverlay, MulliganOverlay, StartingPlayerOverlay, ZoneViewer } from './Overlays';
import { PermanentStack } from './PermanentStack';
import { PhaseLadder } from './PhaseLadder';
import { Piles } from './Piles';
import { PlayerPlate } from './PlayerPlate';
import { StackZone } from './StackZone';
import { Stage } from './Stage';
import { STAGE_HEIGHT } from './stageContext';
import styles from './MatchStage.module.css';

/**
 * The battlefield's horizontal span on the stage, between the seats (left) and the stack and decision corner (right).
 * The stage widens with the window, and the field takes all of the extra width.
 */
const FIELD_LEFT = 300;
const FIELD_RIGHT_MARGIN = 470;
const EMPTY: ReadonlySet<string> = new Set();
const NO_CARDS: readonly CardView[] = [];

/** Attacking and blocking permanents, from the combat groups. */
function combatSets(combat: GameView['combat']) {
  const attacking = new Set<string>();
  const blocking = new Set<string>();
  const links: [string, string][] = [];
  const attacks: [string, string][] = [];
  for (const group of combat ?? []) {
    const attackers = Object.keys(group.attackers ?? {});
    attackers.forEach((id) => attacking.add(id));
    const blockers = Object.keys(group.blockers ?? {});
    // unblocked attackers point at what they attack; blocked ones are tied to their blockers instead
    if (group.defenderId && blockers.length === 0 && !group.isBlocked) attackers.forEach((id) => attacks.push([id, group.defenderId!]));
    for (const blocker of blockers) {
      blocking.add(blocker);
      attackers.forEach((attacker) => links.push([blocker, attacker]));
    }
  }
  return { attacking, blocking, links, attacks };
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
    return { mine, theirs, cover: deck?.cover ?? null };
  }, [deckId, sleeves, saved, starters]);
}

export function MatchStage({ session, state }: { session: GameSession; state: GameSessionState }) {
  const { view, interaction, playerId, mode, awaitingServer } = state;
  const navigate = useNavigate();
  const animations = useSettings((settings) => settings.settings.animations);
  const autoPay = useSettings((settings) => settings.settings.autoPayMana);
  const viewer = useMatchUi((ui) => ui.viewer);
  const openViewer = useMatchUi((ui) => ui.openViewer);
  const sleeves = useSleeves();
  const [holding, setHolding] = useState(false);
  const fullControl = useSettings((settings) => settings.fullControl);
  const setFullControl = useSettings((settings) => settings.setFullControl);
  // full control lasts for the match on screen, as on Arena
  useEffect(() => () => useSettings.getState().setFullControl(false), []);

  useEffect(() => setCardMotion(animations), [animations]);
  // a new game starts with a clean table
  useEffect(() => () => useMatchUi.setState({ zoom: null, dragging: null, viewer: null, logOpen: false, detail: null }), []);

  const board = useMemo(() => buildBoard(view, playerId), [view, playerId]);
  const clickable = useMemo(() => new Set(interaction.clickable.keys()), [interaction.clickable]);
  const combat = view?.combat;
  const { attacking, blocking, links, attacks } = useMemo(() => combatSets(combat), [combat]);
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
    // one answer per question: while the server works on the last one, further answers are dropped
    if (command.type !== 'action' && session.getState().awaitingServer) return;
    if (command.type === 'action' && (command.action === 'HOLD_PRIORITY' || command.action === 'UNHOLD_PRIORITY')) {
      setHolding(command.action === 'HOLD_PRIORITY');
    }
    void session.respond(command).catch(() => undefined);
  }, [session]);
  const onResend = useCallback(() => void session.resend().catch(() => undefined), [session]);
  const onResync = useCallback(() => {
    void session.resync().then((resent) => {
      if (!resent) notify('Nothing to answer', "The game isn't waiting for you. It goes on as soon as the server is ready.");
    });
  }, [session]);
  // the blocker just chosen: the server's follow-up question ("Select attacker to block") doesn't say which it is
  const [lastBlocker, setLastBlocker] = useState<string | null>(null);
  const onClick = useCallback((id: string) => {
    if (session.getState().interaction.mode === 'declareBlockers') setLastBlocker(id);
    session.click(id);
  }, [session]);

  const myId = board.me?.player.playerId ?? null;
  useWarmImages(view);
  useAutoPay(session, state, board.me?.isMe ? board.me : null, autoPay && mode === 'play');
  // holding priority means the player wants every stop
  const autoPassing = useAutoPass(session, state, !holding);
  useGameCues(state, myId, !!autoPassing);
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
  const targeting = interaction.mode === 'target' && !awaitingServer;
  // the decision corner names the blocker when the server asks which attacker it blocks
  const cornerInteraction = useMemo(() => {
    if (interaction.mode !== 'target' || !/attacker to block/i.test(prompt?.text ?? '') || !lastBlocker) return interaction;
    const blocker = board.me?.front.flatMap((group) => group.members).find((card) => card.id === lastBlocker);
    return blocker ? { ...interaction, headline: `Which attacker does ${blocker.name} block?` } : interaction;
  }, [interaction, prompt, board.me, lastBlocker]);
  const pregame = !view?.step;
  const handIds = useMemo(() => new Set(hand.map((card) => card.id!)), [hand]);
  // the server names the pre-game choices (who starts, the London mulligan's bottom cards); older servers are recognized
  // by what can be chosen
  const pregamePick = useMemo(
    () => (interaction.mode === 'target' ? pregameChoice(prompt, { pregame, clickable, handIds, playerIds: board.players }) : null),
    [interaction.mode, prompt, pregame, clickable, handIds, board.players],
  );
  // London mulligan: choose cards from the opening hand to put on the bottom
  const choosingFromHand = pregamePick === 'mulliganBottom';
  const pickerCards = interaction.mode === 'pickCards' && prompt?.kind === 'target' && prompt.cards
    ? Object.values(prompt.cards)
    : choosingFromHand ? hand : null;
  const canAct = mode === 'play' && !state.gameOver;
  const choosingStarter = pregamePick === 'startingPlayer';
  // one decision, one set of controls: an overlay owns the choice while it's open
  const overlayOpen = (interaction.mode === 'mulligan' || choosingStarter || !!pickerCards || interaction.mode === 'panel') && !awaitingServer;
  const handHidden = (interaction.mode === 'mulligan' || choosingStarter || !!pickerCards) && !awaitingServer;
  // a choice among cards in hand (discard, reveal...): eligible cards take the decision edge
  const choosingInHand = interaction.mode === 'target' && !pickerCards && [...clickable].some((id) => handIds.has(id));
  const opponentArt = useMemo(() => {
    const permanent = board.opponents[0]?.front[0]?.lead ?? board.opponents[0]?.back.find((group) => !(group.lead.cardTypes ?? []).includes('LAND'))?.lead;
    return permanent?.expansionSetCode && permanent.cardNumber
      ? { setCode: permanent.expansionSetCode, cardNumber: permanent.cardNumber, name: permanent.name }
      : null;
  }, [board.opponents]);

  return (
    <Stage>
      {(stageWidth) => {
        const fieldWidth = stageWidth - FIELD_LEFT - FIELD_RIGHT_MARGIN;
        return (
          <>
            <div className={styles.mat} aria-hidden="true" />
            {/* each half carries its player's deck art, printed faintly into the mat */}
            <div className={styles.printTheirs}><MatPrint card={opponentArt} /></div>
            <div className={styles.printMine}><MatPrint card={sleeves.cover} /></div>
            <div className={styles.seam} aria-hidden="true" />
            {/* under the hand and the controls, over the mat */}
            <Stitch inset={10} radius={22} zIndex={2} />

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
                targeting={targeting}
                blocking={blocking}
                onClick={onClick}
                deciding={!!opponent.player.hasPriority && interaction.mode === 'waiting'}
                fieldWidth={fieldWidth}
              />
            ))}

            {board.me && (
              <>
                <Battlefield board={board.me} sleeve={sleeves.mine} clickable={clickable} selected={interaction.selected} quiet={quiet} attacking={attacking} blocking={blocking} targeting={targeting} onClick={onClick} left={FIELD_LEFT} width={fieldWidth} frontTop={556} backTop={778} />
                <div className={styles.myPlate}>
                  <PlayerPlate
                    player={board.me.player}
                    isMe={board.me.isMe}
                    sleeve={sleeves.mine}
                    targetable={clickable.has(board.me.player.playerId!)}
                    selected={interaction.selected.has(board.me.player.playerId!)}
                    deciding={canAct && interaction.mode !== 'waiting'}
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

            {mode === 'play' && board.me && !handHidden && (
              <Hand
                cards={hand}
                choosing={choosingInHand}
                clickable={pickerCards ? EMPTY : clickable}
                selected={interaction.selected}
                sleeve={sleeves.mine}
                onPlay={onClick}
                playLine={STAGE_HEIGHT - 300}
                libraryOrigin={`library:${board.me.player.playerId}`}
              />
            )}

            {mode === 'play' ? (
              !overlayOpen && <ActionCluster
                interaction={cornerInteraction}
                awaiting={awaitingServer}
                status={state.status}
                canAct={canAct}
                special={!!view?.special}
                holdingPriority={holding}
                autoPassing={!!autoPassing}
                fullControl={fullControl}
                onFullControl={setFullControl}
                stalled={state.stalled}
                onResend={onResend}
                onResync={onResync}
                onCommand={onCommand}
              />
            ) : (
              <div className={styles.watching}>
                <p>{mode === 'watch' ? 'Watching' : 'Replay'}</p>
                <Button variant="print" onClick={leave}>Leave</Button>
              </div>
            )}

            <Vfx view={view} myPlayerId={myId} />
            <Arrows sourceId={arrowSource} targetIds={arrowTargets} live={choosingTargets} links={links} attacks={attacks} />
            <GameLog gameId={state.gameId} notices={state.notices} canChat={mode !== 'replay'} />
            <GameMenu canConcede={canAct} onConcede={() => onCommand({ type: 'action', action: 'CONCEDE' })} onLeave={leave} />

            {interaction.mode === 'mulligan' && !awaitingServer && (
              <MulliganOverlay hand={hand} interaction={interaction} sleeve={sleeves.mine} onCommand={onCommand} />
            )}
            {choosingStarter && board.me && !awaitingServer && (
              <StartingPlayerOverlay
                me={{ id: board.me.player.playerId!, name: board.me.player.name ?? 'You' }}
                opponents={board.opponents.map((opponent) => ({ id: opponent.player.playerId!, name: opponent.player.name ?? 'Opponent' }))}
                onChoose={onClick}
              />
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
            <CardDetail view={view} extra={pickerCards ?? viewer?.cards ?? NO_CARDS} sleeveOf={sleeveOf} attacking={attacking} blocking={blocking} />
          </>
        );
      }}
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
  targeting: boolean;
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
      <Row groups={board.front} left={left} width={width} top={frontTop} ideal={150} min={58} forward={forward} label="Creatures" flip={!board.isMe} {...row} />
      <Row groups={board.back} left={left} width={width} top={backTop} ideal={112} min={50} forward={forward} label="Lands & permanents" flip={!board.isMe} {...row} />
    </>
  );
});

function Row({ groups, left, width, top, ideal, min, forward, label, flip, ...rest }: RowProps & {
  groups: PermanentGroup[];
  left: number;
  width: number;
  top: number;
  ideal: number;
  min: number;
  forward: 1 | -1;
  /** printed into the zone outline */
  label: string;
  /** the opponent's zones read from their side: label at the top edge */
  flip: boolean;
}) {
  const cardWidth = fitCardWidth(groups, width - 24, ideal, min);
  const height = ideal * (88 / 63);
  return (
    <div
      className={[styles.row, flip ? styles.rowFlip : ''].join(' ')}
      style={{ left, top, width, height, gap: cardWidth * 0.12 }}
      data-label={label}
    >
      {groups.map((group) => (
        <PermanentStack key={group.key} group={group} width={cardWidth} forward={forward} {...rest} />
      ))}
    </div>
  );
}

/** An opponent's half: their rows mirrored above the seam, their seat, piles and hidden hand. */
function OpponentSide({ board, index, count, sleeve, handCount, deciding, fieldWidth, ...row }: RowProps & {
  fieldWidth: number;
  board: PlayerBoard;
  index: number;
  count: number;
  handCount: number;
  deciding: boolean;
}) {
  const width = fieldWidth / count;
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
          sleeve={sleeve}
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
  // conceding gives up this game; leaving a game in progress gives up the whole match
  const [confirming, setConfirming] = useState<'concede' | 'leave' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const leaving = confirming === 'leave';
  return (
    <div className={styles.menu}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={styles.menuButton} aria-label="Game menu">
          <Menu size={24} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menuContent} align="end" sideOffset={8}>
            <DropdownMenu.Item className={styles.menuItem} onSelect={() => setSettingsOpen(true)}>Settings</DropdownMenu.Item>
            {canConcede && (
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => setConfirming('concede')}>Concede</DropdownMenu.Item>
            )}
            <DropdownMenu.Item className={styles.menuItem} onSelect={() => (canConcede ? setConfirming('leave') : onLeave())}>
              Leave the game
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={leaving ? 'Leave this match?' : 'Concede this game?'}
        description={leaving
          ? 'You concede this game and the rest of the match. You can\'t undo it.'
          : 'Your opponent wins this game. You can\'t undo it.'}
        width="sm"
        footer={(
          <>
            <Button variant="quiet" onClick={() => setConfirming(null)}>Keep playing</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(null);
                if (leaving) onLeave();
                else onConcede();
              }}
            >
              {leaving ? 'Leave match' : 'Concede'}
            </Button>
          </>
        )}
      >
        {null}
      </Dialog>
    </div>
  );
}
