import type { ChatMessage } from '../../protocol/generated/views';
import { decodeEntities, parseLogHtml, segmentsText, type LogSegment } from '../game/gameLog';

export type ChatLineKind = 'talk' | 'whisperFrom' | 'whisperTo' | 'info' | 'status' | 'game';

export interface ChatLine {
  key: string;
  at: number;
  kind: ChatLineKind;
  /** who said it; for whispers, the other player */
  who: string | null;
  segments: LogSegment[];
  text: string;
}

const KIND: Record<string, ChatLineKind> = {
  TALK: 'talk',
  WHISPER_FROM: 'whisperFrom',
  WHISPER_TO: 'whisperTo',
  USER_INFO: 'info',
  STATUS: 'status',
  GAME: 'game',
};

/**
 * A chat message as lines to show. What players type is text, never markup; server notices (command output, player
 * history) are small HTML snippets whose <br>s become separate lines.
 */
export function toChatLines(message: ChatMessage, key: string, now = Date.now()): ChatLine[] {
  const kind = KIND[message.messageType ?? ''] ?? 'info';
  const at = message.time ?? now;
  const who = message.username || null;
  if (kind === 'talk' || kind === 'whisperFrom' || kind === 'whisperTo') {
    const text = decodeEntities((message.message ?? '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    return text ? [{ key, at, kind, who, segments: [{ kind: 'text', text }], text }] : [];
  }
  return (message.message ?? '')
    .split(/<br\s*\/?>/i)
    .map((part) => parseLogHtml(part))
    .filter((segments) => segments.length > 0)
    .map((segments, index) => ({ key: `${key}.${index}`, at, kind, who: null, segments, text: segmentsText(segments) }));
}

/** Lines a player should not see: chat and whispers from players they ignore (case-insensitive names). */
export function withoutIgnored(lines: readonly ChatLine[], ignored: readonly string[]): readonly ChatLine[] {
  if (ignored.length === 0) return lines;
  const names = new Set(ignored.map((name) => name.toLowerCase()));
  return lines.filter((line) => !(line.who && (line.kind === 'talk' || line.kind === 'whisperFrom') && names.has(line.who.toLowerCase())));
}

/** Pieces of a chat text with links to this site's invites ("…/join/<table>") picked out, so they can be followed. */
export function splitInviteLinks(text: string, origin: string): ({ kind: 'text'; text: string } | { kind: 'invite'; path: string; text: string })[] {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}(/join/[0-9a-f-]{36})`, 'gi');
  const parts: ({ kind: 'text'; text: string } | { kind: 'invite'; path: string; text: string })[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    parts.push({ kind: 'invite', path: match[1], text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** The link that invites a friend to a table on this site. */
export function inviteLink(origin: string, tableId: string): string {
  return `${origin}/join/${tableId}`;
}
