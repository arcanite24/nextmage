/**
 * What a line typed into a chat box means. Ignoring and befriending players are handled by the client (the server
 * only learns the ignore list); everything else, server commands included ("/w", "/h", "/card"), is sent as typed.
 */
export type ChatInput =
  | { kind: 'send'; text: string }
  | { kind: 'help' }
  | { kind: 'ignoreList' }
  | { kind: 'ignore' | 'unignore' | 'friend' | 'unfriend'; name: string }
  | { kind: 'error'; message: string };

const NAMED: Record<string, 'ignore' | 'unignore' | 'friend' | 'unfriend'> = {
  ignore: 'ignore',
  unignore: 'unignore',
  friend: 'friend',
  unfriend: 'unfriend',
};

export const CHAT_HELP: { command: string; detail: string }[] = [
  { command: '/w name message', detail: 'Whisper to a player. Tab completes the name.' },
  { command: '/ignore name', detail: "Hide a player's chat and whispers, and keep them off your tables." },
  { command: '/unignore name', detail: 'Stop ignoring a player.' },
  { command: '/ignore', detail: 'List the players you ignore.' },
  { command: '/friend name', detail: 'Add a friend: you hear when they come online.' },
  { command: '/unfriend name', detail: 'Remove a friend.' },
  { command: '/h name', detail: "A player's match history on this server." },
  { command: '/card name', detail: "Print a card's rules text." },
  { command: '[[Card name]]', detail: 'Link a card in a message.' },
];

export function parseChatInput(raw: string): ChatInput | null {
  const text = raw.trim();
  if (!text) return null;
  const match = /^[/\\](\w+)(?:\s+(.*))?$/s.exec(text);
  if (!match) return { kind: 'send', text };
  const command = match[1].toLowerCase();
  const rest = (match[2] ?? '').trim();
  if (command === 'help' || command === '?') return { kind: 'help' };
  const named = NAMED[command];
  if (named) {
    if (!rest) return named === 'ignore' ? { kind: 'ignoreList' } : { kind: 'error', message: `Say who: /${command} name` };
    // names have no spaces on XMage
    return { kind: named, name: rest.split(/\s+/)[0] };
  }
  if ((command === 'w' || command === 'whisper') && !/^\S+\s+\S/.test(rest)) {
    return { kind: 'error', message: 'Whisper with /w name message' };
  }
  return { kind: 'send', text };
}

/**
 * Tab completion of a player name in "/w na": the first known name that starts with what was typed (case-insensitive),
 * cycling past the one already completed. Returns null when there is nothing to complete.
 */
export function completeWhisper(text: string, names: readonly string[]): string | null {
  const match = /^([/\\](?:w|whisper)\s+)(\S*)$/i.exec(text);
  if (!match) return null;
  const typed = match[2].toLowerCase();
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  // a completed name moves on to the next one with the same first letter
  const complete = sorted.some((name) => name.toLowerCase() === typed);
  const prefix = complete ? typed.slice(0, 1) : typed;
  const candidates = sorted.filter((name) => name.toLowerCase().startsWith(prefix));
  if (candidates.length === 0) return null;
  const exact = candidates.findIndex((name) => name.toLowerCase() === typed);
  const next = exact >= 0 ? candidates[(exact + 1) % candidates.length] : candidates[0];
  return `${match[1]}${next} `;
}

/** Start a whisper to someone: what to put in the chat box. */
export function whisperPrefix(name: string): string {
  return `/w ${name} `;
}
