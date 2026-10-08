/*
 * "Send to Playmat": a bookmarklet the player runs on a deck page. It reads the deck the way the page itself
 * does (same site, the player's own session), then opens Playmat with the list in the URL fragment, which
 * the browser never sends to any server. It reads only the deck page it runs on.
 * Settings inlines this file into a javascript: link, with __PLAYMAT_ORIGIN__ replaced by Playmat's address.
 */
(function () {
  var APP = '__PLAYMAT_ORIGIN__';
  var MAX = 200 * 1024;
  var host = location.hostname.replace(/^(www|m)\./, '');
  var path = location.pathname;

  function fail(message) {
    window.alert('Send to Playmat: ' + message);
  }

  function send(site, text, name) {
    if (!text || !String(text).trim()) {
      fail('this deck came back empty. Copy its list instead.');
      return;
    }
    var json = JSON.stringify({ site: site, url: location.href, text: String(text), name: name || undefined });
    var bytes = unescape(encodeURIComponent(json));
    if (bytes.length > MAX) {
      fail('this deck is too large to send. Copy its list instead.');
      return;
    }
    var encoded = btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.open(APP + '/import#deck=' + encoded, '_blank', 'noopener');
  }

  function text(url) {
    return fetch(url, { credentials: 'include' }).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    });
  }

  function json(url) {
    return fetch(url, { credentials: 'include' }).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    });
  }

  function title() {
    var heading = document.querySelector('h1');
    return (heading && heading.textContent ? heading.textContent : document.title).replace(/\s+/g, ' ').trim();
  }

  function line(quantity, name, set, number) {
    return quantity + ' ' + name + (set ? ' (' + String(set).toUpperCase() + ')' + (number ? ' ' + number : '') : '');
  }

  var failed = function () {
    fail('this site didn’t hand over the deck. Copy its list instead.');
  };

  // sites Playmat reads from a link: just pass the link along
  if (/^(archidekt\.com|scryfall\.com|manabox\.app|mtgtop8\.com|infinite\.tcgplayer\.com|tcgplayer\.com)$/.test(host)) {
    window.open(APP + '/import?url=' + encodeURIComponent(location.href), '_blank', 'noopener');
    return;
  }

  if (host === 'moxfield.com') {
    var mox = /^\/decks\/([A-Za-z0-9_-]+)/.exec(path);
    if (!mox) return fail('open a deck first.');
    json('https://api2.moxfield.com/v3/decks/all/' + mox[1]).then(function (deck) {
      var boards = deck.boards || {};
      var sections = [['Commander', 'commanders'], ['Companion', 'companions'], ['Deck', 'mainboard'], ['Sideboard', 'sideboard'], ['Maybeboard', 'maybeboard']];
      var out = [];
      sections.forEach(function (section) {
        var cards = boards[section[1]] && boards[section[1]].cards;
        if (!cards) return;
        var lines = Object.keys(cards).map(function (key) {
          var entry = cards[key];
          var card = entry.card || {};
          return line(entry.quantity, card.name, card.set, card.cn);
        });
        if (lines.length) out.push(section[0] + '\n' + lines.join('\n'));
      });
      send('moxfield', out.join('\n\n'), deck.name);
    }).catch(failed);
    return;
  }

  if (host === 'mtggoldfish.com') {
    var fish = /^\/deck\/(\d+)/.exec(path);
    if (!fish) return fail('open a deck first.');
    text('/deck/download/' + fish[1]).then(function (list) {
      send('mtggoldfish', list, title());
    }).catch(failed);
    return;
  }

  if (host === 'tappedout.net') {
    if (!/^\/mtg-decks\/[^/]+\/?$/.test(path)) return fail('open a deck first.');
    text(path.replace(/\/?$/, '/') + '?fmt=txt').then(function (list) {
      send('tappedout', list, title());
    }).catch(failed);
    return;
  }

  if (host === 'deckstats.net') {
    if (!/^\/decks\/\d+\/\d+/.test(path)) return fail('open a deck first.');
    text(path.replace(/\/[a-z]{2}\/?$/, '') + '?export_mtgarena=1&include_comments=0').then(function (list) {
      send('deckstats', list, title());
    }).catch(failed);
    return;
  }

  if (host === 'aetherhub.com') {
    var holder = document.querySelector('[data-deckid]');
    var id = holder && holder.getAttribute('data-deckid');
    if (!id) return fail('open a deck first.');
    json('/Deck/FetchMtgaDeckJson?deckId=' + encodeURIComponent(id) + '&langId=0&simple=false').then(function (deck) {
      var rows = deck.convertedDeck || [];
      var lines = rows.map(function (row) {
        // rows without a quantity are section headers (Deck, Sideboard, Commander, Companion)
        return row.quantity ? line(row.quantity, row.name, row.set, row.number) : '\n' + row.name;
      });
      send('aetherhub', lines.join('\n'), title());
    }).catch(failed);
    return;
  }

  fail('this page isn’t a deck on a site Playmat knows.');
})();
