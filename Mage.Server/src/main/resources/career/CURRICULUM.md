# Career schools: curriculum

The Five Paths campaign teaches the colours. The schools teach formats: one long questline per format, from a first
simple deck up to the decks people play today. This file is the spec every school is written against. Change it
before changing a school.

## Who it's for

Someone who knows how a turn works, has finished a chapter or two of the Five Paths, and has never played this
format, or played it only at a kitchen table. By graduation they should be able to:

- say what the format is, why people play it, and its deck-building rules;
- name its main archetypes and say which one they're piloting and who's the beatdown;
- explain the cards and interactions that only this format has;
- pick up a current tier deck, play it competently against the AI, and sideboard between games.

## The four acts

Every school has the same four acts (a campaign's `chapters`). Acts 1 and 3 end in a boss and act 4 in the final
(each flagged `"boss": true`); act 2 ends in its choice. The ids below are the shape; `<s>` is the school id.

| Act | Nodes | You play | Across the table | Teaches |
| --- | --- | --- | --- | --- |
| 1 First steps | `<s>-1a` duel (skill 1), `<s>-1b` duel (2), `<s>-1t` trial, `<s>-1boss` duel (3, a twist) | the act's starter deck (chapter `deck`); it joins your collection at the boss | simple, honest decks | the format's rules, its banlist, what's different at the table |
| 2 Archetypes | `<s>-2a` … `<s>-2d` duels (3, 3, 4, 4), `<s>-2choice` | a different loaner per duel (node `deck`): aggro, midrange, control, combo | the archetype yours is built to beat, always one the AI pilots well | the four roles; who's the beatdown |
| 3 Signature | `<s>-3t1` trial, `<s>-3a` duel (4), `<s>-3t2` trial, `<s>-3boss` duel (5, a twist) | the signature deck (chapter `deck`) | decks that punish getting the signature wrong | what only this format does |
| 4 The meta | `<s>-4a` … `<s>-4c` duels (5, 5, 6), `<s>-final` best of three (7) | current tier decks, one per duel (node `deck`) | current tier decks the AI pilots well | the real metagame and sideboarding |

Act 2 pairings, so every duel is winnable and each teaches one idea:

- **Aggro vs midrange.** Race. Count damage, ignore their board when you're ahead on the clock.
- **Midrange vs aggro.** Trade early, stabilise, then turn the corner.
- **Control vs midrange.** Answer their threats one for one, win with card advantage.
- **Combo vs aggro.** Goldfish fast and keep your combo pieces safe; don't interact unless it buys a turn.

The AI (COMPUTER_MAD) pilots aggro, midrange and burn reliably, and combo, control and prison badly. **The AI only
ever pilots decks it plays well.** Combo and control lists are the player's loaners. When a boss needs a control
feel, give an AI midrange deck a twist (an extra card, a permanent in play) instead.

## Rewards

Per node, first win only, in the Five Paths' scale:

- Act 1: 25, 30 coins / 125, 150 XP; the trial 20 / 100; boss 80 coins, 250 XP, `deckCards: true` (the starter
  joins the collection).
- Act 2: 35 coins / 175 XP each; the choice offers 60 coins, an uncommon wildcard or 200 XP.
- Act 3: trials 20 coins / 100 XP; the duel 40 / 200; boss 100 coins, 300 XP, 1 pack.
- Act 4: 45 coins / 225 XP each; the final pays graduation (below).
- **Graduation (the final):** 200 coins, 500 XP, 2 packs, a rare wildcard, and the school's title and sleeve:
  `"cosmetics": [{"kind": "title", "id": "<s>-graduate"}, {"kind": "sleeve", "id": "school-<s>"}]`. Meta decks stay
  loaners: the collection economy never hands out a whole tier deck.

## Schools and the order they open

| Id | Format | Deck type | Game type | Opens when |
| --- | --- | --- | --- | --- |
| `pauper` | Pauper | Constructed - Pauper | Two Player Duel | `five-paths@1` |
| `commander` | Commander | Variant Magic - Commander | Commander Two Player Duel; act 4 Commander Free For All | `five-paths@1` |
| `limited` | Limited | Limited | Two Player Duel | `five-paths@1` |
| `pioneer` | Pioneer | Constructed - Pioneer | Two Player Duel | `pauper@2\|five-paths@3` |
| `standard` | Standard | Constructed - Standard | Two Player Duel | `pioneer@1` |
| `modern` | Modern | Constructed - Modern | Two Player Duel | `pioneer@2` |
| `legacy` | Legacy | Constructed - Legacy | Two Player Duel | `modern@2` |
| `vintage` | Vintage | Constructed - Vintage | Two Player Duel | `legacy@2` |
| `brawl` | Brawl | Variant Magic - Brawl | Brawl Two Player Duel | `commander@2` |

A requirement is `<campaign>@<n>` (that many of its chapters finished: a chapter is finished when its boss is beaten,
or its last node is done when it has no boss) or `<campaign>` (all of it), and `a|b` means either. Every entry in the
list must hold. The academy shows a closed school with what it still needs.

### What each school teaches

- **Pauper.** Commons only (printed at common anywhere). Cheap removal and card advantage decide games; artifact lands
  and Affinity; flicker value; the grind. The cheapest format and the easiest for the AI, so it's the reference school.
- **Commander.** 100 cards, singleton, colour identity, the command zone, commander tax, 21 commander damage, 40 life.
  Act 4 is four-player pods: politics, threat assessment, not being the archenemy, when to attack whom.
- **Limited.** 40 cards from one set, 17 lands, curve and creature count, two-colour archetypes, combat tricks and
  combat maths, reading signals. Act 4's decks are typical draft decks; the lesson points at Career's solo draft.
- **Pioneer.** The first non-rotating format: real mana bases (shocks, pathways, fastlands), graveyard and value
  engines, the first best of three with sideboarding.
- **Standard.** Rotation and why it exists; reading a fresh metagame; refreshed whole at each set release.
- **Modern.** Fetch-and-shock mana and paying life for it; free spells; graveyard hate; racing fast decks; the
  wide variety of archetypes.
- **Legacy.** Brainstorm and Force of Will; Wasteland and Daze tempo; dual lands; the stack under pressure.
- **Vintage.** The restricted list; Moxen, Black Lotus and fast mana; Workshops versus blue; playing around one-ofs.
- **Brawl.** Commander with 60 cards and a Standard pool: 25 life, duel speed, planeswalker commanders.

## How a school is written

Each school is `campaigns/<id>.json` plus its decks. Decks are written **by card name** in
`Mage.Server/career-src/<id>/<deck>.txt` and built into `campaigns/decks/<id>/<deck>.dck` by `CareerDeckTool`
(Mage.Tests), which picks real printings and checks the deck against the school's format with XMage's own
validator. CI (`CareerSchoolsTest`, `CareerContentCardsTest`, `CareerModesTest`) fails on an illegal deck, an
unknown card or a broken node.

### Deck source files

```
# name: Mono-Red Burn
# archetype: aggro
# season: 2026-10
# source: https://… (where a meta list came from; omit for decks written for the school)
4 Lightning Bolt
…
SB: 2 Pyroblast
CMDR: Atraxa, Praetors' Voice
```

- Constructed decks have 60 cards and up to a 15-card sideboard; Commander decks 99 plus `CMDR:`; Brawl 59 plus
  `CMDR:`; Limited 40 (basic lands included).
- Act 4 decks are current tier lists with a `# season:` and `# source:`. Act 1–3 decks are written for the school:
  clear game plans, few one-ofs, nothing that makes the lesson hard to see.
- A deck the AI pilots: proactive, creature or burn based, few instants it would have to hold up, no combos that
  need sequencing.

### Campaign file

```jsonc
{
  "id": "pauper",
  "name": "The Pauper School",
  "format": "Pauper",
  "school": true,
  "order": 1,
  "colors": "UB",                       // the school crest's colours
  "summary": "Commons only. …",         // one line on the academy hall
  "text": "…",                          // the school's introduction
  "deckType": "Constructed - Pauper",
  "gameType": "Two Player Duel",
  "requires": ["five-paths@1"],
  "chapters": [
    {
      "id": "pauper-1", "name": "First steps", "text": "…",
      "deck": "pauper/starter.dck", "deckName": "…",
      "nodes": [
        {
          "id": "pauper-1a", "type": "duel", "name": "…", "text": "…",
          "requires": [],
          "opponent": { "name": "…", "deck": "pauper/….dck", "skill": 1 },
          "lesson": { "title": "…", "text": "…", "cards": ["Lightning Bolt", "…"] },
          "tips": [ { "on": "cast:Counterspell", "title": "…", "text": "…" } ],
          "reward": { "coins": 25, "xp": 125 },
          "before": "…", "after": "…"
        },
        {
          "id": "pauper-1t", "type": "trial", "name": "…", "text": "…", "hint": "…",
          "requires": ["pauper-1b"],
          "lesson": { … },
          "trial": { "objective": "win", "you": { "life": 20, "hand": […], "battlefield": […], "library": […] },
                     "opponent": { "life": 7, "battlefield": […] } },
          "reward": { "coins": 20, "xp": 100 }
        }
      ]
    }
  ]
}
```

Node fields beyond the Five Paths':

- `deck`, `deckName`: this duel's loaner (else the chapter's).
- `deckType`, `gameType`: override the school's (Commander's act 4 pods use `Commander Free For All`).
- `opponents`: more AI seats for a pod, each like `opponent`.
- `winsNeeded`: 2 for the best-of-three final.
- `lesson`: the card shown before the duel. A title, two to four short sentences, up to four key cards.
- `tips`: shown once each during the game, when their moment comes (below).
- `sideboard`: a short lesson shown while sideboarding between games of a best of three.
- `trial` (type `"trial"`): a set position. `objective` is `"win"` (win this turn; you lose at its end) or
  `"survive"` (the opponent takes the first turn; you win if you're alive when your turn starts). Sides as in
  `puzzles.json`: `life`, `hand`, `battlefield` (`"Name|tapped"`), `graveyard`, `library` (top first). A trial must
  have exactly one clear line, and it must work in XMage: no cards with hidden choices the AI could dodge.

Tip triggers (`on`):

| Trigger | When |
| --- | --- |
| `start` | your first decision of the game |
| `mulligan` | the opening-hand decision |
| `turn:<n>` | your turn number n |
| `cast:<Card>` | that card goes on the stack (either player) |
| `play:<Card>` | that card enters the battlefield (either player) |
| `opponentSpell` | an opponent's spell is on the stack and you can respond |
| `attack` | you declare attackers |
| `block` | you declare blockers |
| `life:<n>` | your life is n or less |
| `opponentLife:<n>` | an opponent's life is n or less |
| `graveyard:<n>` | your graveyard has n or more cards |

### Voice

The school speaks to the player in the second person, plainly, like the rest of Career: short sentences, no
jargon without a gloss the first time ("a fetchland, a land that finds another land"), no hype. Opponents keep
their own voices in `before` and `after`, one line each. Every lesson names what to do in this duel, not just a
fact about the format.

## Keeping the meta current

Act 4 (and Standard's whole school) goes stale. To refresh a school:

1. Look up the format's current top decks (MTGGoldfish, MTGTop8 or the format's own site) and pick three to five
   that the AI can pilot or that make good loaners.
2. Write each as `career-src/<id>/meta-<archetype>.txt` with a new `# season:` and the `# source:` URL. The deck
   import (Decks → Import) reads most deck sites and can export the names.
3. Run `CareerDeckTool build <id>`; fix any unknown card (XMage may not have a brand-new card yet; pick the
   closest replacement and note it in a comment).
4. Update the act 4 nodes' `deck`, lesson and tips if the archetypes changed, and play the final once.

## Calibration

`CareerCalibrationTest` with `-Dxmage.careerCalibration.schools=all` (or school ids) plays every one-on-one school
duel AI against AI: the node's loaner at the reference skill against the node's opponent at its skill. Commander and
Brawl duels and the pods aren't covered. See CALIBRATION.md for the command and the last findings.
