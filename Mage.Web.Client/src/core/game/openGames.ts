/**
 * The games a player has open, remembered across page reloads so the client can take them back up. Pure: the app
 * keeps the book in local storage.
 */

export type OpenGameMode = 'play' | 'watch';

export interface OpenGameRecord {
  gameId: string;
  /** the player we control (null when watching) */
  playerId: string | null;
  mode: OpenGameMode;
  tableId: string | null;
  parentTableId: string | null;
  /** epoch ms */
  openedAt: number;
}

/** open games per server and user name */
export type OpenGamesBook = Record<string, OpenGameRecord[]>;

/** Games older than this are not worth trying to rejoin: the server has long given the seat up. */
export const OPEN_GAME_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_GAMES_PER_OWNER = 8;

export function ownerKey(serverUrl: string, userName: string): string {
  return `${serverUrl}|${userName.toLowerCase()}`;
}

export function rememberGame(book: OpenGamesBook, owner: string, record: OpenGameRecord): OpenGamesBook {
  const others = (book[owner] ?? []).filter((game) => game.gameId !== record.gameId);
  return { ...book, [owner]: [...others, record].slice(-MAX_GAMES_PER_OWNER) };
}

export function forgetGame(book: OpenGamesBook, owner: string, gameId: string): OpenGamesBook {
  const games = book[owner];
  if (!games?.some((game) => game.gameId === gameId)) return book;
  const rest = games.filter((game) => game.gameId !== gameId);
  const next = { ...book };
  if (rest.length > 0) next[owner] = rest;
  else delete next[owner];
  return next;
}

export function forgetOwner(book: OpenGamesBook, owner: string): OpenGamesBook {
  if (!(owner in book)) return book;
  const next = { ...book };
  delete next[owner];
  return next;
}

/** The games to rejoin for this player, oldest first (so the newest ends up on screen); stale ones are left out. */
export function gamesToRestore(book: OpenGamesBook, owner: string, now: number, maxAgeMs = OPEN_GAME_MAX_AGE_MS): OpenGameRecord[] {
  return (book[owner] ?? [])
    .filter((game) => typeof game?.gameId === 'string' && (game.mode === 'play' || game.mode === 'watch'))
    .filter((game) => now - (game.openedAt ?? 0) <= maxAgeMs)
    .sort((a, b) => a.openedAt - b.openedAt);
}
