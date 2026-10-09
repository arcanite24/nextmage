import { describe, expect, it } from 'vitest';
import { completeWhisper, parseChatInput } from './chatInput';

describe('parseChatInput', () => {
  it('sends plain text and server commands as typed', () => {
    expect(parseChatInput('  hello  ')).toEqual({ kind: 'send', text: 'hello' });
    expect(parseChatInput('/w Bob gl hf')).toEqual({ kind: 'send', text: '/w Bob gl hf' });
    expect(parseChatInput('\\h Bob')).toEqual({ kind: 'send', text: '\\h Bob' });
    expect(parseChatInput('/card Lightning Bolt')).toEqual({ kind: 'send', text: '/card Lightning Bolt' });
  });

  it('ignores empty input', () => {
    expect(parseChatInput('   ')).toBeNull();
  });

  it('handles social commands on the client', () => {
    expect(parseChatInput('/ignore Troll')).toEqual({ kind: 'ignore', name: 'Troll' });
    expect(parseChatInput('\\unignore Troll')).toEqual({ kind: 'unignore', name: 'Troll' });
    expect(parseChatInput('/friend Alice extra words')).toEqual({ kind: 'friend', name: 'Alice' });
    expect(parseChatInput('/UNFRIEND Alice')).toEqual({ kind: 'unfriend', name: 'Alice' });
    expect(parseChatInput('/ignore')).toEqual({ kind: 'ignoreList' });
    expect(parseChatInput('/friend')?.kind).toBe('error');
    expect(parseChatInput('/help')).toEqual({ kind: 'help' });
  });

  it('catches a whisper without a message', () => {
    expect(parseChatInput('/w Bob')?.kind).toBe('error');
  });
});

describe('completeWhisper', () => {
  const names = ['bob', 'Alice', 'Albert'];

  it('completes the first matching name', () => {
    expect(completeWhisper('/w al', names)).toBe('/w Albert ');
    expect(completeWhisper('/whisper B', names)).toBe('/whisper bob ');
  });

  it('cycles through matches once a name is complete', () => {
    expect(completeWhisper('/w Albert', names)).toBe('/w Alice ');
    expect(completeWhisper('/w Alice', names)).toBe('/w Albert ');
  });

  it('leaves other input alone', () => {
    expect(completeWhisper('hello', names)).toBeNull();
    expect(completeWhisper('/w Bob hi', names)).toBeNull();
    expect(completeWhisper('/w zed', names)).toBeNull();
  });
});
