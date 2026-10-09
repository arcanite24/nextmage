import { useEffect, useState } from 'react';
import { api, events } from '../connection';
import { toChatLines, type ChatLine } from '../../core/social/chatLine';
import { useSession } from '../stores/session';

const MAX_LINES = 200;

/**
 * A table's or an event's chat while it is on screen: found with `find`, joined, followed, and left again.
 * `key` names the room (a table or tournament id); a new key joins the new room.
 */
export function useChatRoom(key: string | null, find: (key: string) => Promise<string | null>) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const loginCount = useSession((state) => state.loginCount);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let joined: string | null = null;
    find(key)
      .then(async (id) => {
        if (cancelled || !id) return;
        await api.chatJoin(id, useSession.getState().userName);
        if (cancelled) {
          api.chatLeave(id).catch(() => undefined);
          return;
        }
        joined = id;
        setChatId(id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      setChatId(null);
      if (joined) api.chatLeave(joined).catch(() => undefined);
    };
    // a login after a dropped connection is a new server session: join again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loginCount]);

  useEffect(() => {
    if (!chatId) return;
    let seq = 0;
    return events.on('CHATMESSAGE', (message, event) => {
      if (event.objectId !== chatId) return;
      const next = toChatLines(message, `${chatId}:${seq++}`);
      if (next.length > 0) setLines((current) => [...current, ...next].slice(-MAX_LINES));
    });
  }, [chatId]);

  const send = async (text: string) => {
    if (chatId && text.trim()) await api.chatSendMessage(chatId, useSession.getState().userName, text.trim());
  };
  return { lines, ready: !!chatId, send };
}
