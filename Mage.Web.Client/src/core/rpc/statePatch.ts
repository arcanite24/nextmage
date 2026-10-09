/**
 * Game state patches (the "stateDiffs" capability, see docs/WebSocketAPI.md "State patches").
 *
 * The server sends each game's state complete once, then as patches against the previous one. A patch operation is:
 * - `[value]`: replace with value (null included)
 * - `[]`: remove the object key
 * - `{key: operation}`: change an object key by key; new keys come after the existing ones
 * - `[length, {index: operation}]`: change an array element by element, then cut or grow it to length
 * - `["o", {key: operation or 0}]`: the object gets exactly the listed keys, in that order; 0 keeps the old value
 *
 * Unchanged parts of the old state are reused as they are, so they keep their identity (cheap re-renders).
 */

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRemove = (operation: unknown) => Array.isArray(operation) && operation.length === 0;

function put(target: JsonObject, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
  } else {
    target[key] = value;
  }
}

/** The new state: `base` with the patch operation applied (`base` is not changed). */
export function applyStatePatch(base: unknown, operation: unknown): unknown {
  if (isObject(operation)) {
    if (!isObject(base)) throw new PatchError('object patch on a non-object');
    const result: JsonObject = {};
    for (const key of Object.keys(base)) {
      if (!Object.prototype.hasOwnProperty.call(operation, key)) {
        put(result, key, base[key]);
      } else if (!isRemove(operation[key])) {
        put(result, key, applyStatePatch(base[key], operation[key]));
      }
    }
    for (const key of Object.keys(operation)) {
      if (Object.prototype.hasOwnProperty.call(base, key)) continue;
      const added = operation[key];
      if (!Array.isArray(added) || added.length !== 1) throw new PatchError(`bad operation for new key ${key}`);
      put(result, key, added[0]);
    }
    return result;
  }
  if (!Array.isArray(operation)) throw new PatchError('patch operation is not an array or object');
  if (operation.length === 1) return operation[0];
  if (operation.length === 2 && operation[0] === 'o' && isObject(operation[1])) {
    if (!isObject(base)) throw new PatchError('ordered object patch on a non-object');
    const keys = operation[1];
    const result: JsonObject = {};
    for (const key of Object.keys(keys)) {
      const keep = keys[key] === 0;
      const known = Object.prototype.hasOwnProperty.call(base, key);
      if (keep && !known) throw new PatchError(`keeps missing key ${key}`);
      put(result, key, keep ? base[key] : applyStatePatch(known ? base[key] : undefined, keys[key]));
    }
    return result;
  }
  if (operation.length !== 2 || typeof operation[0] !== 'number' || !isObject(operation[1])) {
    throw new PatchError('bad patch operation');
  }
  if (!Array.isArray(base)) throw new PatchError('array patch on a non-array');
  const [length, changes] = operation as [number, JsonObject];
  const result: unknown[] = new Array<unknown>(length);
  for (let i = 0; i < length; i++) {
    const change = changes[String(i)];
    if (i < base.length) {
      result[i] = change === undefined ? base[i] : applyStatePatch(base[i], change);
    } else if (Array.isArray(change) && change.length === 1) {
      result[i] = change[0];
    } else {
      throw new PatchError(`missing new array element ${i}`);
    }
  }
  return result;
}

/** The `state` field of a server event that carries a game view. */
export interface StateHeader {
  seq: number;
  base?: number;
  patch?: unknown;
}

/** Server events whose data is the view itself; the others hold it in data.gameView. */
const VIEW_IS_DATA = new Set(['GAME_INIT', 'GAME_UPDATE', 'REPLAY_INIT', 'REPLAY_UPDATE']);
/** after these the server forgets the game */
const LAST = new Set(['GAME_OVER', 'REPLAY_DONE']);

export function readStateHeader(value: unknown): StateHeader | null {
  return isObject(value) && typeof value.seq === 'number' ? (value as unknown as StateHeader) : null;
}

/**
 * The client's copy of each game's last state, to rebuild patched events.
 * When a patch does not fit (a lost or out of order state), patches of that game are dropped until the server
 * sends the complete state again, which `requestResync` asks for.
 */
export class GameStateCache {
  private readonly games = new Map<string, { seq: number; view: unknown }>();
  private readonly resyncing = new Set<string>();

  constructor(private readonly requestResync: (gameId: string) => Promise<boolean>) {}

  /**
   * @returns the event data with the complete view, or undefined to drop the event (a resync is on its way)
   */
  receive(method: string, gameId: string | null, data: unknown, state: StateHeader | null): { data: unknown } | undefined {
    if (gameId === null) return { data };
    if (!state) {
      if (LAST.has(method)) this.forget(gameId);
      return { data };
    }
    const inData = !VIEW_IS_DATA.has(method);
    if (state.base === undefined) {
      const view = inData ? (isObject(data) ? data.gameView : undefined) : data;
      this.games.set(gameId, { seq: state.seq, view });
      this.resyncing.delete(gameId);
      return { data };
    }
    const known = this.games.get(gameId);
    if (this.resyncing.has(gameId)) return undefined;
    try {
      if (!known || known.seq !== state.base) throw new PatchError(`state ${state.base} is not the last one received`);
      const view = applyStatePatch(known.view, state.patch);
      this.games.set(gameId, { seq: state.seq, view });
      return { data: inData ? { ...(isObject(data) ? data : {}), gameView: view } : view };
    } catch (error) {
      console.warn(`[rpc] Game state patch for ${gameId} does not apply, asking for the whole state`, error);
      this.resync(gameId);
      return undefined;
    }
  }

  forget(gameId: string): void {
    this.games.delete(gameId);
    this.resyncing.delete(gameId);
  }

  clear(): void {
    this.games.clear();
    this.resyncing.clear();
  }

  /** for tests and diagnostics */
  size(): number {
    return this.games.size;
  }

  private resync(gameId: string): void {
    this.games.delete(gameId);
    this.resyncing.add(gameId);
    this.requestResync(gameId)
      .catch(() => false)
      .then((sent) => {
        // nothing remembered on the server: its next state for the game comes complete anyway
        if (!sent) this.resyncing.delete(gameId);
      });
  }
}
