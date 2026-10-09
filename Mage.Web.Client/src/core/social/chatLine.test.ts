import { describe, expect, it } from 'vitest';
import { inviteLink, splitInviteLinks, toChatLines, withoutIgnored } from './chatLine';

describe('toChatLines', () => {
  it('keeps what players type as text', () => {
    const [line] = toChatLines({ username: 'Bob', message: 'gg &amp; <b>wp</b>', messageType: 'TALK', time: 5 }, 'k');
    expect(line).toMatchObject({ kind: 'talk', who: 'Bob', text: 'gg & wp', at: 5 });
  });

  it('marks whispers with the other player', () => {
    expect(toChatLines({ username: 'Alice', message: 'hi', messageType: 'WHISPER_FROM' }, 'k')[0]).toMatchObject({ kind: 'whisperFrom', who: 'Alice' });
    expect(toChatLines({ username: 'Alice', message: 'hi', messageType: 'WHISPER_TO' }, 'k')[0]).toMatchObject({ kind: 'whisperTo', who: 'Alice' });
  });

  it('splits server notices on line breaks', () => {
    const lines = toChatLines({ message: 'List of commands:<br/>\\h name<br/><font color=green>\\w</font> name text', messageType: 'USER_INFO' }, 'k');
    expect(lines.map((line) => line.text)).toEqual(['List of commands:', '\\h name', '\\w name text']);
    expect(lines.every((line) => line.kind === 'info')).toBe(true);
  });

  it('drops empty messages', () => {
    expect(toChatLines({ username: 'Bob', message: '  ', messageType: 'TALK' }, 'k')).toEqual([]);
  });
});

describe('withoutIgnored', () => {
  it('hides talk and whispers from ignored players only', () => {
    const lines = [
      ...toChatLines({ username: 'Troll', message: 'spam', messageType: 'TALK' }, 'a'),
      ...toChatLines({ username: 'troll', message: 'psst', messageType: 'WHISPER_FROM' }, 'b'),
      ...toChatLines({ username: 'Alice', message: 'hi', messageType: 'TALK' }, 'c'),
      ...toChatLines({ message: 'Troll has joined', messageType: 'STATUS' }, 'd'),
    ];
    expect(withoutIgnored(lines, ['TROLL']).map((line) => line.text)).toEqual(['hi', 'Troll has joined']);
  });
});

describe('invite links', () => {
  const origin = 'https://mage.example:8443';
  const tableId = '0b8f3c52-6f43-4d4c-9c51-2f8c1a1e9d10';

  it('builds and finds invite links of this site', () => {
    const link = inviteLink(origin, tableId);
    expect(splitInviteLinks(`Join me: ${link} now`, origin)).toEqual([
      { kind: 'text', text: 'Join me: ' },
      { kind: 'invite', path: `/join/${tableId}`, text: link },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('leaves other sites alone', () => {
    expect(splitInviteLinks(`https://evil.example/join/${tableId}`, origin)).toEqual([{ kind: 'text', text: `https://evil.example/join/${tableId}` }]);
  });
});
