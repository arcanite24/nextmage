import { describe, expect, test } from 'vitest';
import { proxiedScryfallUrl } from './imageProxy';

describe('proxiedScryfallUrl', () => {
  test('leaves links alone without a proxy', () => {
    for (const proxy of [undefined, '']) {
      expect(proxiedScryfallUrl('https://api.scryfall.com/cards/collection', proxy)).toBe('https://api.scryfall.com/cards/collection');
      expect(proxiedScryfallUrl('https://cards.scryfall.io/normal/front/a/b/x.jpg?1', proxy)).toBe('https://cards.scryfall.io/normal/front/a/b/x.jpg?1');
    }
  });

  test('routes the API and the CDN through the proxy', () => {
    expect(proxiedScryfallUrl('https://api.scryfall.com/cards/collection', '/img')).toBe('/img/api/cards/collection');
    expect(proxiedScryfallUrl('https://api.scryfall.com/cards/pbng/15%E2%98%85?format=image&version=normal', '/img'))
      .toBe('/img/api/cards/pbng/15%E2%98%85?format=image&version=normal');
    expect(proxiedScryfallUrl('https://api.scryfall.com/cards/named?exact=Lightning+Bolt&format=image', '/img'))
      .toBe('/img/api/cards/named?exact=Lightning+Bolt&format=image');
    expect(proxiedScryfallUrl('https://cards.scryfall.io/large/back/a/b/x.jpg?1700000000', '/img'))
      .toBe('/img/cards/large/back/a/b/x.jpg?1700000000');
  });

  test('accepts a trailing slash or a full origin as the proxy', () => {
    expect(proxiedScryfallUrl('https://cards.scryfall.io/png/front/a/b/x.png', '/img/')).toBe('/img/cards/png/front/a/b/x.png');
    expect(proxiedScryfallUrl('https://api.scryfall.com/cards/m10/146', 'https://cdn.example.com/img'))
      .toBe('https://cdn.example.com/img/api/cards/m10/146');
  });

  test('keeps other links unchanged', () => {
    for (const url of [
      'https://upload.wikimedia.org/wikipedia/en/a/aa/Magic_the_gathering-card_back.jpg',
      'https://scryfall.com/card/m10/146',
      'https://svgs.scryfall.io/card-symbols/W.svg',
      'http://api.scryfall.com/cards/m10/146',
      '/back.webp',
      'bolt-normal',
    ]) {
      expect(proxiedScryfallUrl(url, '/img')).toBe(url);
    }
  });
});
