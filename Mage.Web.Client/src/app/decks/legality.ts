/**
 * The server's deck-check messages, said to the player: "Your deck has 58 cards. Modern needs 60."
 * Messages we don't recognise keep their group and are only tidied.
 */
export function legalityLine(group: string | undefined, message: string | undefined, format: string): string {
  const name = format.replace(/^Constructed - /, '').replace(/^Variant Magic - /, '');
  const text = (message ?? '').replace(/\s+:/g, ':').replace(/\s{2,}/g, ' ').trim();
  const zone = (group ?? '').trim();
  const lower = zone.toLowerCase();

  let match = /at least (\d+) cards: has only (\d+)/i.exec(text);
  if (match && lower === 'deck') return `Your deck has ${match[2]} cards. ${name} needs ${match[1]}.`;
  match = /must contain (\d+) cards: has (\d+)/i.exec(text);
  if (match && lower === 'deck') return `Your deck has ${match[2]} cards. ${name} needs exactly ${match[1]}.`;
  match = /no more than (\d+) cards: has (\d+)/i.exec(text);
  if (match && lower === 'sideboard') return `Your sideboard has ${match[2]}. The limit is ${match[1]}.`;
  if (match && lower === 'deck') return `Your deck has ${match[2]} cards. ${name} allows ${match[1]}.`;
  if (/^banned$/i.test(text)) return `${zone} is banned in ${name}.`;
  if (/^restricted$/i.test(text)) return `${zone} is restricted in ${name}: one copy at most.`;
  match = /too many: (\d+)/i.exec(text);
  if (match) return `${zone}: ${match[1]} copies, more than ${name} allows.`;
  if (/not legal|isn't legal|is not allowed/i.test(text)) return `${zone} isn’t legal in ${name}.`;
  return zone ? `${zone}: ${text}` : text;
}
