---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface brief: app shell (login, Home/Play, Decks, Events, Settings) and the visual world

Scope: the new web app under src/app — every screen outside the match first, then the match stage (Phase 4) inherits this world.
Mode: Operate. The player's task: get from intent to a game in a few clicks, manage decks, find events; never fight the UI.
Audience and constraints: see PRODUCT.md. Desktop first (1280x720 up), tablet later. Keyboard reachable. No WotC assets.

## Direction contract

THESIS: The app is the player's own playmat. Screens are zones screen-printed on dyed neoprene, cut by a stitched edge, with the player's deck art printed into the mat. It refuses the category default: dark-fantasy navy with gold trim over blurred art, and floating glass panels.

OWN-WORLD: Bottle-green neoprene ground (#0f1714 to #1c2d27) with a fine printed grain; zone outlines and labels in slightly translucent screen-print ivory ink (#e9e4d6) set in Barlow Condensed caps; a 2px dashed thread stitch around the viewport; Barlow for UI text. Mat art is a duotone print of a real card's art crop into the mat green. One amber (#f0b13d) is reserved for "your decision now" and nothing else. Oxblood (#8a2f2a) for damage and destructive actions. Cards are sleeved: a matte sleeve border in the deck's sleeve color. Decks are a finite roster of sleeved deck boxes with name plates and a one-line note. State is marked, not only colored: printed tick, outline weight, engraved labels. Outside the mat area, one neutral scale tinted green.

STORY: The player sees their own deck on their own mat, understands immediately what they can do (play, build, join an event), and is in a game against the AI or a friend in one or two clicks. Every XMage option stays reachable behind "more" on the play zone.

FIRST VIEWPORT: Full-bleed mat, stitched edge inset 10px. Top: a thin printed rail with the product mark at left and Play, Decks, Events, Tables as printed labels, profile and settings at right. Left third: the deck roster, a vertical column of sleeved deck boxes, selected one lifted. Right two thirds: the selected deck's art printed large into the mat; over it a screen-printed PLAY zone outline (card-zone proportions) holding the mode choice (vs AI, vs a friend, open table, event) and the amber Play button at its lower right, the largest control on screen.

FORM: Playmat (printed neoprene, stitched edge, screen-printed zones), position 1 on the grounded list; picked over the roll. Raises kept: one decision hue (wayfinding), zones on a visible grid (grid specimen), state as marks (reference setting), decks as roster with name plates (character roster), neutral scale off the mat (monochrome). Seed key f668a737.
Signature interaction: choosing a deck re-prints the mat: its art comes in as a three-pass screen print (separations sliding into register, ~600 ms, reduced-motion: crossfade). Motion grammar: things are placed onto the mat and settle; nothing floats.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
