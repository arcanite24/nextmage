/**
 * Returns `next`, but reuses every part of `previous` that is deeply equal, so unchanged cards,
 * players and zones keep their object identity across server snapshots and React can skip them.
 */
export function structuralShare<T>(previous: T, next: T): T {
  return share(previous, next) as T;
}

function share(previous: unknown, next: unknown): unknown {
  if (previous === next) return previous;

  const previousIsArray = Array.isArray(previous);
  const nextIsArray = Array.isArray(next);
  if (previousIsArray && nextIsArray) {
    const prevArray = previous as unknown[];
    const nextArray = next as unknown[];
    let same = prevArray.length === nextArray.length;
    const result = nextArray.map((item, index) => {
      const shared = index < prevArray.length ? share(prevArray[index], item) : item;
      if (shared !== prevArray[index]) same = false;
      return shared;
    });
    return same ? previous : result;
  }

  if (!isPlainObject(previous) || !isPlainObject(next) || previousIsArray || nextIsArray) {
    return next;
  }

  const prevObject = previous as Record<string, unknown>;
  const nextObject = next as Record<string, unknown>;
  const prevKeys = Object.keys(prevObject);
  const nextKeys = Object.keys(nextObject);
  let same = prevKeys.length === nextKeys.length;
  const result: Record<string, unknown> = {};
  for (const key of nextKeys) {
    const shared = share(prevObject[key], nextObject[key]);
    result[key] = shared;
    if (shared !== prevObject[key] || !(key in prevObject)) same = false;
  }
  return same ? previous : result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
