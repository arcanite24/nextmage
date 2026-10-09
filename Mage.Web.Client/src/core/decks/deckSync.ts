/**
 * Deck sync between this browser and the player's account on the server: what to send, fetch and delete so both end
 * up with the newest version of every deck. The newer change wins; deletions travel as tombstones.
 */

export interface LocalDeckStamp {
  id: string;
  updatedAt: number;
}

export interface RemoteDeckStamp {
  id: string;
  updatedAt: number;
  deleted: boolean;
}

export interface SyncPlan {
  /** local decks the server should get */
  upload: string[];
  /** server decks this browser should get */
  download: string[];
  /** local decks deleted on another device */
  deleteLocal: string[];
  /** decks deleted here that the server still has */
  deleteRemote: { id: string; at: number }[];
  /** local tombstones that have done their job */
  dropTombstones: string[];
}

/**
 * @param tombstones decks deleted in this browser, by id, with the time
 * @param foreign decks this browser synced with another account: never uploaded to this one
 */
export function planSync(
  local: LocalDeckStamp[],
  tombstones: Record<string, number>,
  remote: RemoteDeckStamp[],
  foreign: ReadonlySet<string> = new Set(),
): SyncPlan {
  const plan: SyncPlan = { upload: [], download: [], deleteLocal: [], deleteRemote: [], dropTombstones: [] };
  const remoteById = new Map(remote.map((deck) => [deck.id, deck]));
  const localById = new Map(local.map((deck) => [deck.id, deck]));

  for (const deck of local) {
    const theirs = remoteById.get(deck.id);
    if (!theirs) {
      if (!foreign.has(deck.id)) plan.upload.push(deck.id);
    } else if (theirs.deleted) {
      // brought back here after it was deleted elsewhere, or deleted elsewhere after the last change here
      if (deck.updatedAt > theirs.updatedAt) plan.upload.push(deck.id);
      else plan.deleteLocal.push(deck.id);
    } else if (deck.updatedAt > theirs.updatedAt) {
      plan.upload.push(deck.id);
    } else if (deck.updatedAt < theirs.updatedAt) {
      plan.download.push(deck.id);
    }
  }

  for (const theirs of remote) {
    if (localById.has(theirs.id) || theirs.deleted) continue;
    const deletedAt = tombstones[theirs.id];
    if (deletedAt !== undefined && deletedAt >= theirs.updatedAt) plan.deleteRemote.push({ id: theirs.id, at: deletedAt });
    else plan.download.push(theirs.id);
  }

  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const theirs = remoteById.get(id);
    // the server knows (or never had it), or it changed since: either way this tombstone is settled after this sync
    if (!theirs || theirs.deleted || theirs.updatedAt > deletedAt || plan.deleteRemote.some((entry) => entry.id === id)) {
      plan.dropTombstones.push(id);
    }
  }
  return plan;
}
