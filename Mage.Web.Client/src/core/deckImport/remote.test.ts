import { describe, expect, it } from 'vitest';
import { RPC_ERROR, RpcError } from '../rpc/RpcClient';
import { applyUpdate, diffDecks } from './diff';
import { decodePayload, encodePayload, MAX_PAYLOAD_BYTES } from './payload';
import { describeFailure, readingFromServer } from './remote';

describe('readingFromServer', () => {
  it('turns the server reading into a list with its source', () => {
    const reading = readingFromServer({
      site: 'archidekt',
      remoteId: '7',
      url: 'https://archidekt.com/decks/7',
      name: 'Murktide',
      author: 'someone',
      format: 'Constructed - Modern',
      main: [{ cardName: 'Murktide Regent', setCode: 'MH2', cardNumber: '52', amount: 4 }],
      side: [{ cardName: 'Engineered Explosives', setCode: '', cardNumber: '', amount: 1 }],
      commanders: [],
      companion: [],
      maybeboardCount: 3,
      cover: { cardName: 'Murktide Regent', setCode: 'MH2', cardNumber: '52', amount: 1 },
      remoteUpdatedAt: 99,
    }, 'archidekt', 'https://archidekt.com/decks/7/murktide');
    expect(reading.list.main).toEqual([{ amount: 4, cardName: 'Murktide Regent', setCode: 'MH2', cardNumber: '52' }]);
    expect(reading.list.side).toEqual([{ amount: 1, cardName: 'Engineered Explosives', setCode: null, cardNumber: null }]);
    expect(reading).toMatchObject({ name: 'Murktide', maybeCount: 3, format: 'Constructed - Modern', cover: { setCode: 'MH2', cardNumber: '52' } });
    expect(reading.source).toEqual({ site: 'archidekt', url: 'https://archidekt.com/decks/7', remoteId: '7', remoteUpdatedAt: 99 });
  });
});

describe('describeFailure', () => {
  const failed = (reason: string) => new RpcError('deckImportFromUrl', RPC_ERROR.DECK_IMPORT_FAILED, 'x', { reason });

  it('names the site and the way forward', () => {
    expect(describeFailure(failed('private'), 'archidekt')).toEqual({
      reason: 'private', assisted: true, message: 'This deck is private. Make it public or unlisted on Archidekt, or paste its list.',
    });
    expect(describeFailure(failed('site_changed'), 'scryfall')).toMatchObject({ assisted: true, message: 'Scryfall changed how its decks load. Paste the list for now.' });
    expect(describeFailure(failed('rate_limited'), 'scryfall')).toMatchObject({ assisted: false, message: 'Too many imports at once. Try again in a minute.' });
  });

  it('handles unknown reasons, old servers and lost connections', () => {
    expect(describeFailure(failed('mystery'), 'mtgtop8').reason).toBe('unavailable');
    expect(describeFailure(new RpcError('deckImportFromUrl', RPC_ERROR.METHOD_NOT_FOUND, 'Unknown method'), 'mtgtop8').reason).toBe('unsupported');
    expect(describeFailure(new Error('socket closed'), 'mtgtop8').reason).toBe('offline');
  });
});

describe('bookmarklet payload', () => {
  it('round-trips a deck, including non-ASCII names', () => {
    const payload = { site: 'moxfield', url: 'https://moxfield.com/decks/abc', text: '1 Lim-Dûl the Necromancer\n1 Æther Vial', name: 'Ætherworks' };
    const encoded = encodePayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePayload(`#deck=${encoded}`)).toEqual(payload);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  it('rejects missing, broken and oversized payloads', () => {
    expect(decodePayload('')).toBeNull();
    expect(decodePayload('#deck=%%%')).toBeNull();
    expect(decodePayload(`#deck=${encodePayload({ site: 'x', url: 'y', text: '   ' })}`)).toBeNull();
    expect(decodePayload(`#deck=${encodePayload({ site: 'x', url: 'y', text: 'a'.repeat(MAX_PAYLOAD_BYTES + 10) })}`)).toBeNull();
  });
});

describe('deck updates', () => {
  const saved = {
    id: 'd1',
    name: 'My Murktide',
    coverCard: { setCode: 'MH2', cardNumber: '52' },
    cards: [{ cardName: 'Murktide Regent', amount: 4 }, { cardName: 'Island', amount: 10 }, { cardName: 'Spell Pierce', amount: 1 }],
    sideboard: [{ cardName: 'Engineered Explosives', amount: 1 }],
    source: { site: 'archidekt', url: 'u', remoteId: '7', importedAt: 1, importedName: 'Murktide' },
  };
  const fresh = {
    name: 'Murktide v2',
    cards: [{ cardName: 'Murktide Regent', amount: 4 }, { cardName: 'Island', amount: 9 }, { cardName: 'Counterspell', amount: 2 }],
    sideboard: [{ cardName: 'Engineered Explosives', setCode: 'MH2', cardNumber: '1', amount: 1 }],
    source: { site: 'archidekt', url: 'u', remoteId: '7', importedAt: 2, remoteUpdatedAt: 5, importedName: 'Murktide v2' },
  };

  it('lists additions, removals and count changes by name', () => {
    expect(diffDecks(saved, fresh)).toEqual([
      { cardName: 'Counterspell', zone: 'main', before: 0, after: 2 },
      { cardName: 'Spell Pierce', zone: 'main', before: 1, after: 0 },
      { cardName: 'Island', zone: 'main', before: 10, after: 9 },
    ]);
  });

  it('keeps the deck id, cover and a name the player chose', () => {
    const updated = applyUpdate(saved, fresh);
    expect(updated).toMatchObject({ id: 'd1', name: 'My Murktide', coverCard: { setCode: 'MH2', cardNumber: '52' }, cards: fresh.cards });
    expect(updated.source).toMatchObject({ importedAt: 2, remoteUpdatedAt: 5, importedName: 'Murktide' });
  });

  it('follows the site name when the player never renamed the deck', () => {
    expect(applyUpdate({ ...saved, name: 'Murktide' }, fresh).name).toBe('Murktide v2');
  });
});
