# Accessibility Coverage

This document tracks the automated accessibility checks that guard the web client (`npm run test:a11y`, part of `npm test`).

## Keyboard-only play

Interactive controls must remain reachable without a mouse. The coverage script checks that the shared Dialog is built on Radix (focus trap and return), and `e2e/app-accessibility.spec.ts` runs axe over every screen and a live game; add assertions there for new command surfaces.

## Focus traps

The shared `Dialog` (`src/app/ui/Dialog.tsx`, on Radix Dialog) owns dialog semantics, Tab trapping, Escape handling, initial focus, and focus restoration. New modal-like surfaces should reuse it or provide equivalent behavior before landing.

## Readable contrast

The ink and status tokens in `src/app/styles/tokens.css` (ink, strong, soft and dim ink, danger, sage at 4.5:1; the decision amber at 3:1) are checked against the four darkest mat surfaces, with translucent inks blended over each. New colors should use existing tokens or keep the same contrast floor.

## Reduced motion

CSS must keep a `prefers-reduced-motion: reduce` block available so animation-heavy Arena-style polish can be softened for users who request it.

## Screen-reader names

Buttons need visible text, an ARIA label, a title, or documented dynamic text. Icon-only controls should expose a stable accessible name.

## High-scale text

Font sizing should not depend on viewport units. Responsive layouts should use container spacing, wrapping, and fixed-format control constraints instead of scaling text with viewport width.
