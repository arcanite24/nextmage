import {
  AlertTriangle, ArrowDownToLine, Ban, BellRing, BookOpen, Dot, Flag, Flame, Heart, HeartCrack, MessageCircle,
  MessageSquare, Mountain, Shield, Shuffle, Skull, Sparkles, Swords, Trophy, Archive, Zap, X, type LucideIcon,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { GameNotice } from '../../core/game/gameSession';
import {
  buildLogRows, cardInk, collectCards, EMOTES, findLogCard, isEmote, noticeEntry, parseChatMessage,
  type LogEntry, type LogIcon, type LogSegment,
} from '../../core/game/gameLog';
import type { CardView, ChatMessage, GameView } from '../../protocol/generated/views';
import { api, events } from '../connection';
import { useSession } from '../stores/session';
import { IconButton } from '../ui/Button';
import { PromptText } from '../ui/PromptText';
import { useEmotes } from './emotes';
import { useMatchUi } from './matchUi';
import styles from './GameLog.module.css';

const MAX_LINES = 300;

const ICONS: Record<LogIcon, LucideIcon> = {
  turn: Dot,
  cast: Sparkles,
  land: Mountain,
  ability: Zap,
  trigger: BellRing,
  attack: Swords,
  block: Shield,
  damage: Flame,
  lifeGain: Heart,
  lifeLoss: HeartCrack,
  draw: BookOpen,
  discard: ArrowDownToLine,
  counter: Ban,
  destroy: Skull,
  exile: Archive,
  mulligan: Shuffle,
  win: Trophy,
  lose: Flag,
  chat: MessageCircle,
  error: AlertTriangle,
  info: Dot,
};

/** Game chat and the game's running log, joined once per game. */
function useGameChat(gameId: string, view: GameView | null) {
  // the latest view, read when a line arrives: it says whose turn the line belongs to
  const latest = useRef(view);
  useEffect(() => {
    latest.current = view;
  }, [view]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let joined: string | null = null;
    api.chatFindByGame(gameId)
      .then(async (id) => {
        if (cancelled || !id) return;
        await api.chatJoin(id, useSession.getState().userName);
        joined = id;
        setChatId(id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      useEmotes.getState().clear();
      if (joined) api.chatLeave(joined).catch(() => undefined);
    };
  }, [gameId]);

  useEffect(() => {
    if (!chatId) return;
    let seq = 0;
    return events.on('CHATMESSAGE', (message: ChatMessage, event) => {
      if (event.objectId !== chatId) return;
      const parsed = parseChatMessage(message, `c${seq++}`);
      if (!parsed) return;
      const current = latest.current;
      const entry = parsed.turn !== null && parsed.turn === current?.turn && current.activePlayerName
        ? { ...parsed, turnOwner: current.activePlayerName }
        : parsed;
      setEntries((current) => [...current, entry].slice(-MAX_LINES));
      if (entry.tone !== 'chat') return;
      const me = useSession.getState().userName;
      const fromOther = entry.who !== me;
      const muted = !!useEmotes.getState().muted[gameId];
      if (fromOther && muted) return;
      if (entry.who && isEmote(entry.text)) useEmotes.getState().show(entry.who, entry.text);
      if (fromOther) setUnread((count) => count + 1);
    });
  }, [chatId, gameId]);

  const send = (text: string) => {
    if (chatId && text.trim()) api.chatSendMessage(chatId, useSession.getState().userName, text.trim()).catch(() => undefined);
  };
  return { entries, send, ready: !!chatId, unread, clearUnread: () => setUnread(0) };
}

export function GameLog({ gameId, notices, canChat, view }: { gameId: string; notices: GameNotice[]; canChat: boolean; view: GameView | null }) {
  const open = useMatchUi((state) => state.logOpen);
  const toggle = useMatchUi((state) => state.toggleLog);
  const muted = useEmotes((state) => !!state.muted[gameId]);
  const toggleMute = useEmotes((state) => state.toggleMute);
  const myName = useSession((state) => state.userName);
  const chat = useGameChat(gameId, view);
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLOListElement>(null);
  // every card seen this game, so lines about cards that left the table can still show them
  const cards = useRef(new Map<string, CardView>());
  useEffect(() => {
    collectCards(view, cards.current);
  }, [view]);

  const rows = useMemo(() => {
    const errors = notices.filter((notice) => notice.kind === 'error').map((notice) => noticeEntry(`n${notice.id}`, notice.text, notice.at));
    const visible = muted ? chat.entries.filter((entry) => entry.tone !== 'chat' || entry.who === myName) : chat.entries;
    // stable sort: lines from the same moment keep the order the server sent them in
    const entries = [...visible, ...errors].sort((a, b) => a.at - b.at);
    return buildLogRows(entries, myName);
  }, [chat.entries, notices, muted, myName]);

  useEffect(() => {
    if (open) chat.clearUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.unread]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [rows.length, open]);

  return (
    <>
      <div className={styles.toggle}>
        <IconButton label={open ? 'Close log and chat' : 'Open log and chat'} icon={<MessageSquare size={22} />} pressed={open} onClick={() => toggle()} />
        {chat.unread > 0 && !open && <span className={styles.badge}>{chat.unread}</span>}
      </div>
      {open && (
        <aside className={styles.drawer} aria-label="Game log and chat">
          <header className={styles.head}>
            <h2>Log</h2>
            <div className={styles.headActions}>
              {canChat && (
                <button type="button" className={styles.mute} aria-pressed={muted} onClick={() => toggleMute(gameId)}>
                  {muted ? 'Unmute opponent' : 'Mute opponent'}
                </button>
              )}
              <IconButton label="Close log" icon={<X size={20} />} onClick={() => toggle(false)} />
            </div>
          </header>
          <ol ref={list} className={styles.lines}>
            {rows.length === 0 && <li className={styles.empty}>The game's events will show here.</li>}
            {rows.map((row) => (row.kind === 'separator'
              ? (
                <li key={row.key} className={[styles.separator, row.mine ? styles.separatorMine : ''].join(' ')}>
                  <span>Turn {row.turn}{row.player ? ` · ${row.mine ? 'You' : row.player}` : ''}</span>
                </li>
              )
              : <LogLine key={row.key} entry={row.entry} cards={cards} />))}
          </ol>
          {canChat && (
            <footer className={styles.foot}>
              <div className={styles.emotes}>
                {EMOTES.map((emote) => (
                  <button key={emote} type="button" className={styles.emote} onClick={() => chat.send(emote)} disabled={!chat.ready}>{emote}</button>
                ))}
              </div>
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  chat.send(draft);
                  setDraft('');
                }}
              >
                <input
                  className={styles.input}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={chat.ready ? 'Say something' : 'Joining chat…'}
                  disabled={!chat.ready}
                  aria-label="Chat message"
                  maxLength={400}
                />
              </form>
            </footer>
          )}
        </aside>
      )}
    </>
  );
}

const LogLine = memo(function LogLine({ entry, cards }: { entry: LogEntry; cards: { current: Map<string, CardView> } }) {
  const Icon = ICONS[entry.icon];
  return (
    <li className={[styles.line, styles[entry.tone]].join(' ')}>
      <Icon className={[styles.icon, styles[`icon_${entry.icon}`] ?? ''].join(' ')} size={16} aria-hidden="true" />
      <span className={styles.body}>
        {entry.who && <b>{entry.who}: </b>}
        {entry.segments.map((segment, index) => <Segment key={index} segment={segment} cards={cards} />)}
      </span>
    </li>
  );
});

function Segment({ segment, cards }: { segment: LogSegment; cards: { current: Map<string, CardView> } }) {
  const setZoom = useMatchUi((state) => state.setZoom);
  const openDetail = useMatchUi((state) => state.openDetail);
  if (segment.kind === 'text') return <PromptText text={segment.text} />;
  if (segment.kind === 'player') return <span className={styles.player}>{segment.name}</span>;
  // looked up when used: the card may have moved since the line was written
  const find = () => findLogCard(cards.current, segment);
  return (
    <button
      type="button"
      className={[styles.card, styles[`ink_${cardInk(segment.color) ?? 'none'}`] ?? ''].join(' ')}
      onPointerEnter={(event) => {
        const card = find();
        if (card) setZoom({ card, x: event.clientX, y: event.clientY, anchor: event.currentTarget });
      }}
      onPointerLeave={() => setZoom(null)}
      onClick={() => {
        const card = find();
        if (card?.id) openDetail({ id: card.id, card });
      }}
      aria-label={`${segment.name}, show card`}
    >
      {segment.name}
    </button>
  );
}
