import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProfanityFilter,
  handleLocalChatCommand,
  normalizeChatCallback,
  readProfanityLevelFromWhisper,
  renderChatMessageHtml,
  shouldSuppressIgnoredMessage,
  type ProfanityFilterLevel,
} from './ChatMessageService.js';
import type { ClientCallback } from '../types/index.js';

const CHAT_ID = '00000000-0000-0000-0000-000000000001';

test('normalizes Java chat callback metadata', () => {
  const message = normalizeChatCallback({
    messageId: 1,
    method: 'chatMessage',
    objectId: CHAT_ID,
    data: {
      username: 'Alice',
      message: 'casts {G}',
      time: '2026-07-05T12:34:00.000Z',
      turnInfo: 'Turn 2',
      color: 'ORANGE',
      messageType: 'GAME',
      soundToPlay: 'PlayerSubmittedDeck',
    },
  } satisfies ClientCallback);

  assert.equal(message?.channelId, CHAT_ID);
  assert.equal(message?.userName, 'Alice');
  assert.equal(message?.displayType, 'game');
  assert.equal(message?.messageType, 'GAME');
  assert.equal(message?.turnInfo, 'Turn 2');
  assert.equal(message?.soundToPlay, 'PlayerSubmittedDeck');
  assert.equal(message?.timestamp?.toISOString(), '2026-07-05T12:34:00.000Z');
});

test('suppresses ignored talk and incoming whispers only', () => {
  const talk = normalizeChatCallback(chatCallback({ username: 'Alice', messageType: 'TALK' }));
  const status = normalizeChatCallback(chatCallback({ username: 'Alice', messageType: 'STATUS' }));
  assert.ok(talk);
  assert.ok(status);

  const isIgnored = (_server: string, user: string) => user.toLowerCase() === 'alice';
  assert.equal(shouldSuppressIgnoredMessage(talk, 'ws://localhost:17172', isIgnored), true);
  assert.equal(shouldSuppressIgnoredMessage(status, 'ws://localhost:17172', isIgnored), false);
});

test('handles local ignore commands without sending to the server', () => {
  let ignoredUsers: string[] = [];
  const result = handleLocalChatCommand('/ignore Alice', {
    serverUrl: 'ws://localhost:17172',
    currentUserName: 'Me',
    ignoredUsers,
    addIgnoredUser: (user) => {
      ignoredUsers = [...ignoredUsers, user.trim()];
      return ignoredUsers;
    },
    removeIgnoredUser: (user) => {
      ignoredUsers = ignoredUsers.filter(item => item.toLowerCase() !== user.toLowerCase());
      return ignoredUsers;
    },
    setProfanityFilterLevel: () => {},
  });

  assert.equal(result.handled, true);
  assert.match(result.response ?? '', /Added Alice/);
  assert.deepEqual(ignoredUsers, ['Alice']);
});

test('handles Java profanity whisper command and filters messages', () => {
  let level: ProfanityFilterLevel = 0;
  const result = handleLocalChatCommand('/w Me profanity 2', {
    serverUrl: 'local',
    currentUserName: 'Me',
    ignoredUsers: [],
    addIgnoredUser: () => [],
    removeIgnoredUser: () => [],
    setProfanityFilterLevel: (nextLevel) => {
      level = nextLevel;
    },
  });
  assert.equal(result.handled, true);
  assert.equal(level, 2);

  const whisper = normalizeChatCallback(chatCallback({ username: 'Me', message: 'profanity 1', messageType: 'WHISPER_FROM' }));
  assert.ok(whisper);
  assert.equal(readProfanityLevelFromWhisper(whisper, 'me'), 1);

  const talk = normalizeChatCallback(chatCallback({ username: 'Alice', message: 'that was stupid', messageType: 'TALK' }));
  assert.ok(talk);
  assert.match(applyProfanityFilter(talk, 'Me', 2).message, /Profanity detected/);
});

test('renders safe rich chat markup with links, cards, and mana symbols', () => {
  const html = renderChatMessageHtml('See [[Lightning Bolt]] at https://example.test/card {R}<script>alert(1)</script>');
  assert.match(html, /chat-card-ref/);
  assert.match(html, /href="https:\/\/example.test\/card"/);
  assert.match(html, /chat-mana-symbol/);
  assert.doesNotMatch(html, /script/);
});

function chatCallback(data: Partial<Record<string, unknown>>): ClientCallback {
  return {
    messageId: 1,
    method: 'chatMessage',
    objectId: CHAT_ID,
    data: {
      username: 'Alice',
      message: 'hello',
      messageType: 'TALK',
      color: 'BLUE',
      ...data,
    },
  };
}
