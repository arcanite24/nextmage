import { create } from 'zustand';
import { api, events } from '../connection';
import { stripMarkup } from '../../core/game/prompt';
import type { ChatMessage, UsersView } from '../../protocol/generated/views';
import { attention } from './attention';
import { useSession } from './session';
import { isFriend, isIgnored, useSocial } from './social';
import { notify } from './toasts';

const MAX_LINES = 300;
export const PRESENCE_POLL_MS = 10_000;

/** A lobby chat message as received; the drawer turns these into lines when it is opened. */
export interface LobbyMessage {
  key: string;
  message: ChatMessage;
}

/**
 * The main room: its chat, followed from login on (whispers reach the player wherever they are), and who is online.
 * The drawer in the shell shows it; whispers and friends coming online also surface as toasts.
 */
interface LobbyState {
  chatId: string | null;
  messages: LobbyMessage[];
  /** chat lines from others since the drawer was last open */
  unread: number;
  users: UsersView[];
  /** the drawer is open, on this tab */
  open: boolean;
  tab: 'chat' | 'players';
  /** text to put in the chat box (a whisper started from the player list); the box takes it and clears it */
  draft: string | null;
  /** the player whose profile is open */
  profile: string | null;
  openProfile(name: string | null): void;
  /** the player being reported */
  reporting: string | null;
  openReport(name: string | null): void;
  /** client-side lines (help, ignore list): shown in the lobby chat only */
  addLocal(text: string): void;
  setOpen(open: boolean, tab?: LobbyState['tab']): void;
  whisper(name: string): void;
  takeDraft(): string | null;
  send(text: string): Promise<void>;
  refreshUsers(): Promise<void>;
}

let seq = 0;

export const useLobby = create<LobbyState>((set, get) => ({
  chatId: null,
  messages: [],
  unread: 0,
  users: [],
  open: false,
  tab: 'chat',
  draft: null,
  profile: null,
  reporting: null,

  openProfile(name) {
    set({ profile: name });
  },
  openReport(name) {
    set({ reporting: name });
  },
  addLocal(text) {
    const local: LobbyMessage = { key: `l${seq++}`, message: { message: text, messageType: 'USER_INFO', time: Date.now() } };
    set((state) => ({ messages: [...state.messages, local].slice(-MAX_LINES) }));
  },
  setOpen(open, tab) {
    set((state) => ({ open, tab: tab ?? state.tab, unread: open ? 0 : state.unread }));
  },
  whisper(name) {
    set({ open: true, tab: 'chat', draft: `/w ${name} `, unread: 0 });
  },
  takeDraft() {
    const draft = get().draft;
    if (draft !== null) set({ draft: null });
    return draft;
  },
  async send(text) {
    const chatId = get().chatId;
    if (!chatId || !text.trim()) return;
    await api.chatSendMessage(chatId, useSession.getState().userName, text.trim());
  },
  async refreshUsers() {
    const roomId = useSession.getState().roomId;
    if (!roomId) return;
    const rooms = await api.roomGetUsers(roomId).catch(() => null);
    if (!rooms) return;
    const users = rooms[0]?.usersView ?? [];
    announceFriends(get().users, users, seenOnce);
    seenOnce = true;
    set({ users });
  },
}));

let seenOnce = false;

/** Friends who came online since the last look (not on the first look after login: they were simply there). */
function announceFriends(before: readonly UsersView[], after: readonly UsersView[], announce: boolean): void {
  if (!announce) return;
  const was = new Set(before.map((user) => user.userName?.toLowerCase()));
  const social = useSocial.getState();
  for (const user of after) {
    if (!user.userName || was.has(user.userName.toLowerCase()) || !isFriend(social, user.userName)) continue;
    const name = user.userName;
    notify(`${name} is online`, 'Say hello in the lobby, or invite them to a table.', 'info', {
      label: 'Whisper',
      run: () => useLobby.getState().whisper(name),
    });
  }
}

events.on('CHATMESSAGE', (message, event) => {
  const { chatId, open, tab } = useLobby.getState();
  if (!chatId || event.objectId !== chatId || !message) return;
  const me = useSession.getState().userName;
  const who = message.username || null;
  const type = message.messageType;
  const fromOther = !!who && who !== me && (type === 'TALK' || type === 'WHISPER_FROM');
  const hidden = fromOther && isIgnored(useSocial.getState(), who);
  useLobby.setState((state) => ({
    messages: [...state.messages, { key: `m${seq++}`, message }].slice(-MAX_LINES),
    unread: fromOther && !hidden && !(open && tab === 'chat') ? state.unread + 1 : state.unread,
  }));
  if (type === 'WHISPER_FROM' && who && !hidden) {
    const text = stripMarkup(message.message);
    if (!(open && tab === 'chat')) {
      notify(`Whisper from ${who}`, text, 'info', { label: 'Reply', run: () => useLobby.getState().whisper(who) });
    }
    attention(`Whisper from ${who}`, text, { tag: `whisper:${who}`, onClick: () => useLobby.getState().whisper(who) });
  }
});

let poll: ReturnType<typeof setInterval> | null = null;

function stopPolling(): void {
  if (poll) clearInterval(poll);
  poll = null;
}

// each login joins the main room's chat (again) and starts watching who is online
useSession.subscribe((state, previous) => {
  if (state.phase !== 'signedIn') {
    if (previous.phase === 'signedIn') {
      stopPolling();
      seenOnce = false;
      useLobby.setState({ chatId: null, users: [], unread: 0 });
    }
    return;
  }
  if (state.loginCount === previous.loginCount || !state.roomId) return;
  const roomId = state.roomId;
  api.chatFindByRoom(roomId)
    .then(async (chatId) => {
      if (!chatId) return;
      await api.chatJoin(chatId, state.userName);
      useLobby.setState({ chatId });
    })
    .catch(() => undefined);
  void useLobby.getState().refreshUsers();
  stopPolling();
  poll = setInterval(() => {
    if (useSession.getState().connection === 'open') void useLobby.getState().refreshUsers();
  }, PRESENCE_POLL_MS);
});
