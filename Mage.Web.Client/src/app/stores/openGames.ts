import { forgetGame, forgetOwner, gamesToRestore, ownerKey, rememberGame, type OpenGameRecord, type OpenGamesBook } from '../../core/game/openGames';
import { readJson, writeJson } from './persist';

/** Open games per server and player, kept in local storage so a reload can rejoin them (see core/game/openGames). */
const KEY = 'playmat.openGames';

function read(): OpenGamesBook {
  const book = readJson<unknown>(KEY, {});
  return book && typeof book === 'object' && !Array.isArray(book) ? book as OpenGamesBook : {};
}

export function rememberOpenGame(serverUrl: string, userName: string, record: OpenGameRecord): void {
  if (!userName) return;
  writeJson(KEY, rememberGame(read(), ownerKey(serverUrl, userName), record));
}

export function forgetOpenGame(serverUrl: string, userName: string, gameId: string): void {
  const book = read();
  const next = forgetGame(book, ownerKey(serverUrl, userName), gameId);
  if (next !== book) writeJson(KEY, next);
}

export function forgetOpenGames(serverUrl: string, userName: string): void {
  const book = read();
  const next = forgetOwner(book, ownerKey(serverUrl, userName));
  if (next !== book) writeJson(KEY, next);
}

export function openGamesToRestore(serverUrl: string, userName: string): OpenGameRecord[] {
  return gamesToRestore(read(), ownerKey(serverUrl, userName), Date.now());
}
