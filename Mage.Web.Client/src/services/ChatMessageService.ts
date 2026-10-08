import type {
  ChatMessageColor,
  ChatMessageType,
  ChatMessageView,
  ChatSoundToPlay,
  ClientCallback,
} from '../types/index.js';
import { sanitizeServerHtml, serverHtmlToPlainText } from './ServerHtmlService.js';

export type ChatDisplayType =
  | 'user'
  | 'system'
  | 'status'
  | 'error'
  | 'game'
  | 'personal'
  | 'whisper-from'
  | 'whisper-to';

export type ProfanityFilterLevel = 0 | 1 | 2;

export interface NormalizedChatMessage {
  channelId: string;
  userName: string;
  message: string;
  timestamp: Date | null;
  turnInfo: string | null;
  displayType: ChatDisplayType;
  messageType: ChatMessageType | null;
  color: ChatMessageColor | null;
  soundToPlay: ChatSoundToPlay | null;
}

export interface LocalChatCommandContext {
  serverUrl: string;
  currentUserName: string | null;
  ignoredUsers: string[];
  addIgnoredUser: (userName: string) => string[];
  removeIgnoredUser: (userName: string) => string[];
  setProfanityFilterLevel: (level: ProfanityFilterLevel) => void;
}

export interface LocalChatCommandResult {
  handled: boolean;
  response?: string;
}

const PLAIN_URL_PATTERN = /\bhttps?:\/\/[^\s<]+/gi;
const CARD_TOKEN_PATTERN = /\[\[([^[\]]{1,120})\]\]/g;
const MANA_TOKEN_PATTERN = /\{([WUBRGCX0-9/]+)\}/g;
const PROFANITY_COMMAND_PATTERN = /^profanity\s+([012])\b/i;
const PROFANITY_PATTERN = /\b(?:damn|stupid|moron|idiot|bastard|shit|fuck|fuk|cunt|dick|cock|whore|slut)\b/i;
const PROFANITY_STRICT_PATTERN = /\b(?:porn|drunk|dumb|suck|crap|crabs|condom|piss|boob|naked)\b/i;

const DISPLAY_TYPE_BY_MESSAGE_TYPE: Record<ChatMessageType, ChatDisplayType> = {
  USER_INFO: 'personal',
  STATUS: 'status',
  GAME: 'game',
  TALK: 'user',
  WHISPER_FROM: 'whisper-from',
  WHISPER_TO: 'whisper-to',
};

const SOUND_TITLES: Record<ChatSoundToPlay, string> = {
  PlayerLeft: 'Player left',
  PlayerQuitTournament: 'Player quit tournament',
  PlayerSubmittedDeck: 'Player submitted deck',
  PlayerWhispered: 'Whisper',
};

export function normalizeChatCallback(callback: ClientCallback): NormalizedChatMessage | null {
  if (callback.method !== 'chatMessage') return null;
  const data = isRecord(callback.data) ? callback.data : {};
  const channelId = callback.objectId ?? readString(data.chatId) ?? readString(data.id);
  if (!channelId) return null;

  const messageType = normalizeMessageType(readString(data.messageType) ?? readString(data.type));
  const color = normalizeMessageColor(readString(data.color));
  const soundToPlay = normalizeSoundToPlay(readString(data.soundToPlay));
  const userName = readString(data.username) ?? readString(data.userName) ?? '';
  const message = readString(data.message) ?? (typeof callback.data === 'string' ? callback.data : JSON.stringify(callback.data));
  const displayType = messageType
    ? DISPLAY_TYPE_BY_MESSAGE_TYPE[messageType]
    : color === 'RED'
      ? 'error'
      : userName === 'System' || userName === 'SERVER'
        ? 'system'
        : 'user';

  return {
    channelId,
    userName,
    message,
    timestamp: normalizeDate(data.time),
    turnInfo: readString(data.turnInfo),
    displayType,
    messageType,
    color,
    soundToPlay,
  };
}

export function shouldSuppressIgnoredMessage(message: NormalizedChatMessage, serverUrl: string, isIgnored: (serverUrl: string, userName: string) => boolean): boolean {
  if (!message.userName) return false;
  return (message.messageType === 'TALK' || message.messageType === 'WHISPER_FROM') && isIgnored(serverUrl, message.userName);
}

export function handleLocalChatCommand(input: string, context: LocalChatCommandContext): LocalChatCommandResult {
  const trimmed = input.trim();
  if (!trimmed) return { handled: false };

  const [commandToken, ...restTokens] = trimmed.split(/\s+/);
  const command = commandToken.toLowerCase();
  const rest = restTokens.join(' ').trim();

  if (command === '/ignore' || command === '\\ignore') {
    if (!rest) {
      const list = [...context.ignoredUsers].sort((a, b) => a.localeCompare(b));
      return {
        handled: true,
        response: `Current ignore list on ${context.serverUrl} (total: ${list.length}): [${list.join(', ')}]`,
      };
    }

    if (context.ignoredUsers.some(user => sameUser(user, rest))) {
      return { handled: true, response: `${rest} is already on your ignore list on ${context.serverUrl}` };
    }

    const nextUsers = context.addIgnoredUser(rest);
    return {
      handled: true,
      response: `Added ${rest} to your ignore list on ${context.serverUrl} (total: ${nextUsers.length})`,
    };
  }

  if (command === '/unignore' || command === '\\unignore') {
    if (!rest) {
      return {
        handled: true,
        response: `\\ignore - shows your ignore list on this server. \\ignore username - add username. \\unignore username - remove username.`,
      };
    }

    const wasIgnored = context.ignoredUsers.some(user => sameUser(user, rest));
    const nextUsers = context.removeIgnoredUser(rest);
    return {
      handled: true,
      response: wasIgnored
        ? `Removed ${rest} from your ignore list on ${context.serverUrl} (total: ${nextUsers.length})`
        : `No such user "${rest}" on your ignore list on ${context.serverUrl} (total: ${nextUsers.length})`,
    };
  }

  const whisperTarget = command === '/w' || command === '\\w' || command === '/whisper' || command === '\\whisper'
    ? restTokens[0] ?? ''
    : '';
  const whisperBody = restTokens.slice(1).join(' ').trim();
  const profanityLevel = parseProfanityCommand(whisperBody);
  if (whisperTarget && sameUser(whisperTarget, context.currentUserName) && profanityLevel !== null) {
    context.setProfanityFilterLevel(profanityLevel);
    return {
      handled: true,
      response: `Profanity filter strictness set to ${profanityLevel}.`,
    };
  }

  return { handled: false };
}

export function readProfanityLevelFromWhisper(message: NormalizedChatMessage, currentUserName: string | null): ProfanityFilterLevel | null {
  if (message.messageType !== 'WHISPER_FROM' || !sameUser(message.userName, currentUserName)) return null;
  return parseProfanityCommand(serverHtmlToPlainText(message.message));
}

export function applyProfanityFilter(
  message: NormalizedChatMessage,
  currentUserName: string | null,
  level: ProfanityFilterLevel,
): NormalizedChatMessage {
  if (level === 0 || message.messageType === 'USER_INFO' || message.messageType === 'GAME' || message.messageType === 'STATUS') {
    return message;
  }

  const plainMessage = serverHtmlToPlainText(message.message);
  if (!containsProfanity(plainMessage, level)) return message;

  if (level === 1) {
    return {
      ...message,
      message: `${message.message} <small>Profanity detected. Type /w ${currentUserName ?? 'yourUserName'} profanity 0 to turn the filter off.</small>`,
    };
  }

  return {
    ...message,
    message: `${message.userName || 'Message'}: Profanity detected. To make it less strict, type /w ${currentUserName ?? 'yourUserName'} profanity 1.`,
    displayType: 'personal',
  };
}

export function renderChatMessageHtml(message: string): string {
  const escapedAndSanitized = sanitizeServerHtml(message);
  return replaceManaSymbols(linkifyPlainUrls(replaceCardTokens(escapedAndSanitized)));
}

export function chatCueTitle(soundToPlay: ChatSoundToPlay | null): string | null {
  return soundToPlay ? SOUND_TITLES[soundToPlay] : null;
}

function replaceCardTokens(input: string): string {
  return input.replace(CARD_TOKEN_PATTERN, (_token, cardName: string) => (
    `<span class="chat-card-ref" tabindex="0" title="Card reference: ${escapeAttribute(cardName)}">${cardName}</span>`
  ));
}

function linkifyPlainUrls(input: string): string {
  return input.replace(PLAIN_URL_PATTERN, url => {
    const trailing = url.match(/[),.;!?]+$/)?.[0] ?? '';
    const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
    return `<a href="${escapeAttribute(cleanUrl)}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}`;
  });
}

function replaceManaSymbols(input: string): string {
  return input.replace(MANA_TOKEN_PATTERN, (_token, symbol: string) => {
    const label = symbol.toUpperCase();
    return `<span class="chat-mana-symbol" title="Mana ${escapeAttribute(label)}">${label}</span>`;
  });
}

function parseProfanityCommand(input: string): ProfanityFilterLevel | null {
  const match = input.trim().match(PROFANITY_COMMAND_PATTERN);
  if (!match) return null;
  const level = Number(match[1]);
  return level === 0 || level === 1 || level === 2 ? level : null;
}

function containsProfanity(input: string, level: ProfanityFilterLevel): boolean {
  const normalized = input
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1il]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[5z]/g, 's')
    .replace(/[@]/g, 'a')
    .replace(/(.)\1+/g, '$1');
  return PROFANITY_PATTERN.test(normalized) || (level === 2 && PROFANITY_STRICT_PATTERN.test(normalized));
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMessageType(value: string | null): ChatMessageType | null {
  const allowed: ChatMessageType[] = ['USER_INFO', 'STATUS', 'GAME', 'TALK', 'WHISPER_FROM', 'WHISPER_TO'];
  return allowed.includes(value as ChatMessageType) ? value as ChatMessageType : null;
}

function normalizeMessageColor(value: string | null): ChatMessageColor | null {
  const allowed: ChatMessageColor[] = ['BLACK', 'RED', 'GREEN', 'BLUE', 'ORANGE', 'YELLOW'];
  return allowed.includes(value as ChatMessageColor) ? value as ChatMessageColor : null;
}

function normalizeSoundToPlay(value: string | null): ChatSoundToPlay | null {
  const allowed: ChatSoundToPlay[] = ['PlayerLeft', 'PlayerQuitTournament', 'PlayerSubmittedDeck', 'PlayerWhispered'];
  return allowed.includes(value as ChatSoundToPlay) ? value as ChatSoundToPlay : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function sameUser(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type { ChatMessageView };
