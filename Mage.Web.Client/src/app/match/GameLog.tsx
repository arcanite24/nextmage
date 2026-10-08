import { MessageSquare, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GameNotice } from '../../core/game/gameSession';
import { stripMarkup } from '../../core/game/prompt';
import type { ChatMessage } from '../../protocol/generated/views';
import { api, events } from '../connection';
import { useSession } from '../stores/session';
import { IconButton } from '../ui/Button';
import { PromptText } from '../ui/PromptText';
import { useMatchUi } from './matchUi';
import styles from './GameLog.module.css';

interface LogLine {
  key: string;
  at: number;
  who: string | null;
  text: string;
  tone: 'game' | 'chat' | 'error';
}

const EMOTES = ['Good game', 'Nice play', 'Thinking…', 'Oops', 'Hello'];
const MAX_LINES = 300;

/** Game chat and the game's running log, joined once per game. */
function useGameChat(gameId: string) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
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
      if (joined) api.chatLeave(joined).catch(() => undefined);
    };
  }, [gameId]);

  useEffect(() => {
    if (!chatId) return;
    let seq = 0;
    return events.on('CHATMESSAGE', (message: ChatMessage, event) => {
      if (event.objectId !== chatId) return;
      const text = stripMarkup(message.message);
      if (!text) return;
      const user = message.username || null;
      const tone: LogLine['tone'] = message.messageType === 'TALK' || message.messageType === 'WHISPER_TO' || message.messageType === 'WHISPER_FROM' ? 'chat' : 'game';
      setLines((current) => [...current, { key: `c${seq++}`, at: message.time ?? Date.now(), who: tone === 'chat' ? user : null, text, tone }].slice(-MAX_LINES));
      if (tone === 'chat' && user !== useSession.getState().userName) setUnread((count) => count + 1);
    });
  }, [chatId]);

  const send = (text: string) => {
    if (chatId && text.trim()) api.chatSendMessage(chatId, useSession.getState().userName, text.trim()).catch(() => undefined);
  };
  return { lines, send, ready: !!chatId, unread, clearUnread: () => setUnread(0) };
}

export function GameLog({ gameId, notices, canChat }: { gameId: string; notices: GameNotice[]; canChat: boolean }) {
  const open = useMatchUi((state) => state.logOpen);
  const toggle = useMatchUi((state) => state.toggleLog);
  const chat = useGameChat(gameId);
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLOListElement>(null);

  const errors: LogLine[] = notices.filter((notice) => notice.kind === 'error').map((notice) => ({
    key: `n${notice.id}`, at: notice.at, who: null, text: notice.text, tone: 'error',
  }));
  const lines = [...chat.lines, ...errors].sort((a, b) => a.at - b.at);

  useEffect(() => {
    if (open) chat.clearUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.unread]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [lines.length, open]);

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
            <IconButton label="Close log" icon={<X size={20} />} onClick={() => toggle(false)} />
          </header>
          <ol ref={list} className={styles.lines}>
            {lines.length === 0 && <li className={styles.empty}>The game's events will show here.</li>}
            {lines.map((line) => (
              <li key={line.key} className={styles[line.tone]}>
                {line.who && <b>{line.who}: </b>}
                <PromptText text={line.text} />
              </li>
            ))}
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
