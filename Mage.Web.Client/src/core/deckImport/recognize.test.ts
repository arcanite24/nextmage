import { describe, expect, it } from 'vitest';
import { recognize } from './recognize';
import { nameFromLink } from './sites';

const site = (input: string) => {
  const result = recognize(input);
  return result.kind === 'site' ? [result.site, result.remoteId] : [result.kind];
};

describe('recognize: deck links', () => {
  it.each([
    ['https://archidekt.com/decks/7031486/buffs_by_hans', 'archidekt', '7031486'],
    ['https://www.archidekt.com/decks/7031486', 'archidekt', '7031486'],
    ['archidekt.com/decks/3872725/murktide?utm_source=discord', 'archidekt', '3872725'],
    ['https://archidekt.com/api/decks/3872725/', 'archidekt', '3872725'],
    ['https://infinite.tcgplayer.com/magic-the-gathering/deck/Rakdos-Grief/496500', 'tcgplayer', '496500'],
    ['https://www.tcgplayer.com/content/magic-the-gathering/deck/Malcolm-and-Vial-Smasher/496887', 'tcgplayer', '496887'],
    ['https://tcgplayer.com/magic-the-gathering/deck/Izzet-Murktide/497000/', 'tcgplayer', '497000'],
    ['https://mtgtop8.com/event?e=91675&d=896184&f=MO', 'mtgtop8', '896184'],
    ['https://www.mtgtop8.com/event?e=91675&d=896184', 'mtgtop8', '896184'],
    ['https://mtgtop8.com/dec?d=896184', 'mtgtop8', '896184'],
    ['https://mtgtop8.com/mtgo?d=896184', 'mtgtop8', '896184'],
    ['https://scryfall.com/@gorila/decks/e7aceb4c-29d5-49f5-9a49-c24f64da264b', 'scryfall', 'e7aceb4c-29d5-49f5-9a49-c24f64da264b'],
    ['https://scryfall.com/@gorila/decks/e7aceb4c-29d5-49f5-9a49-c24f64da264b?as=visual', 'scryfall', 'e7aceb4c-29d5-49f5-9a49-c24f64da264b'],
    ['https://api.scryfall.com/decks/e7aceb4c-29d5-49f5-9a49-c24f64da264b/export/json', 'scryfall', 'e7aceb4c-29d5-49f5-9a49-c24f64da264b'],
    ['https://manabox.app/decks/AZ6V4n88fhahOvNRFHbXTQ', 'manabox', 'AZ6V4n88fhahOvNRFHbXTQ'],
    ['https://www.manabox.app/decks/SrfEJy-wQ7u3oncFMqWeqg/', 'manabox', 'SrfEJy-wQ7u3oncFMqWeqg'],
    ['https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A', 'moxfield', 'E3zZUHuCBUiC2dExO6wn4A'],
    ['https://www.moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A?fbclid=abc', 'moxfield', 'E3zZUHuCBUiC2dExO6wn4A'],
    ['moxfield.com/decks/-x9Lq_u0lEuBqs7mS0Uz2w', 'moxfield', '-x9Lq_u0lEuBqs7mS0Uz2w'],
    ['https://www.mtggoldfish.com/deck/6512345', 'mtggoldfish', '6512345'],
    ['https://www.mtggoldfish.com/deck/6512345#paper', 'mtggoldfish', '6512345'],
    ['https://mtggoldfish.com/deck/arena_download/6512345', 'mtggoldfish', '6512345'],
    ['https://aetherhub.com/Deck/Public/1012345', 'aetherhub', '1012345'],
    ['https://aetherhub.com/Deck/mono-red-aggro-1012345', 'aetherhub', 'mono-red-aggro-1012345'],
    ['https://aetherhub.com/Metagame/Standard-BO1/Deck/izzet-prowess-1012345', 'aetherhub', 'izzet-prowess-1012345'],
    ['https://tappedout.net/mtg-decks/atraxa-superfriends-21/', 'tappedout', 'atraxa-superfriends-21'],
    ['https://m.tappedout.net/mtg-decks/atraxa-superfriends-21', 'tappedout', 'atraxa-superfriends-21'],
    ['https://deckstats.net/decks/12345/678901-atraxa-superfriends/en', 'deckstats', '12345/678901'],
    ['https://deckstats.net/decks/12345/678901-atraxa-superfriends', 'deckstats', '12345/678901'],
    ['https://deckstats.net/decks/12345/678901-atraxa-superfriends/', 'deckstats', '12345/678901'],
  ])('%s', (input, expectedSite, expectedId) => {
    expect(site(input)).toEqual(expectedId === undefined ? [expectedSite] : [expectedSite, expectedId]);
  });

  it('keeps only the parameters a deck link needs', () => {
    expect(recognize('https://mtgtop8.com/event?e=91675&d=896184&f=MO&utm_source=x')).toMatchObject({ url: 'https://mtgtop8.com/event?e=91675&d=896184&f=MO' });
    expect(recognize('http://archidekt.com/decks/1/x?utm_medium=y#cards')).toMatchObject({ url: 'https://archidekt.com/decks/1/x' });
  });

  it('treats other pages on deck sites, and other sites, as unknown links', () => {
    expect(site('https://www.moxfield.com/users/someone')).toEqual(['unknownUrl']);
    expect(site('https://archidekt.com/search/decks')).toEqual(['unknownUrl']);
    expect(site('https://www.mtggoldfish.com/metagame/standard')).toEqual(['unknownUrl']);
    expect(site('https://melee.gg/Decklist/View/4b2a')).toEqual(['unknownUrl']);
    expect(site('https://example.com/decks/12')).toEqual(['unknownUrl']);
  });
});

describe('recognize: lists and nothing', () => {
  it('reads empty and whitespace input as nothing', () => {
    expect(recognize('')).toEqual({ kind: 'empty' });
    expect(recognize('   \n\t ')).toEqual({ kind: 'empty' });
  });

  it('reads a bare id or a single word as nothing', () => {
    expect(recognize('896184')).toEqual({ kind: 'empty' });
    expect(recognize('E3zZUHuCBUiC2dExO6wn4A')).toEqual({ kind: 'empty' });
  });

  it('reads card lines as a list', () => {
    expect(recognize('4 Lightning Bolt').kind).toBe('list');
    expect(recognize('1x Sol Ring').kind).toBe('list');
    expect(recognize('SB: 2 Duress').kind).toBe('list');
  });

  it('reads a list that mentions a link in a comment as a list', () => {
    expect(recognize('// from https://moxfield.com/decks/abcdefgh\n4 Lightning Bolt\n20 Mountain').kind).toBe('list');
  });

  it('reads names without counts as a list once there are several', () => {
    expect(recognize('Lightning Bolt\nShock').kind).toBe('list');
  });

  it('reads deck files as a list', () => {
    expect(recognize('<?xml version="1.0"?><cockatrice_deck version="1"></cockatrice_deck>').kind).toBe('list');
    expect(recognize('{"data":{"mainBoard":[]}}').kind).toBe('list');
  });
});

describe('nameFromLink', () => {
  it('reads a name from the slug, and nothing from ids', () => {
    expect(nameFromLink('https://archidekt.com/decks/3872725/murktide')).toBe('Murktide');
    expect(nameFromLink('https://aetherhub.com/Deck/mono-red-aggro-1012345')).toBe('Mono Red Aggro');
    expect(nameFromLink('https://deckstats.net/decks/12345/678901-atraxa-superfriends/en')).toBe('Atraxa Superfriends');
    expect(nameFromLink('https://tappedout.net/mtg-decks/atraxa-superfriends-21/')).toBe('Atraxa Superfriends 21');
    expect(nameFromLink('https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A')).toBeUndefined();
    expect(nameFromLink('https://www.mtggoldfish.com/deck/6512345')).toBeUndefined();
  });
});
