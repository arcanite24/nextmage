# Accessibility Coverage

This document tracks the automated accessibility checks that guard the web client while the Java-client parity work continues.

## Keyboard-only play

Interactive controls must remain reachable without a mouse. The coverage script checks shared modal focus behavior, and visual/local-server promotion specs should add stable assertions for new command surfaces before they become required gates.

## Focus traps

The shared `Modal` component owns dialog semantics, Tab trapping, Escape handling, initial focus, and focus restoration. New modal-like surfaces should reuse it or provide equivalent behavior before landing.

## Readable contrast

The base theme color tokens are checked against dark surfaces for primary, secondary, warning, and danger text. New component-specific colors should use existing tokens or maintain the same contrast floor.

## Reduced motion

CSS must keep a `prefers-reduced-motion: reduce` block available so animation-heavy Arena-style polish can be softened for users who request it.

## Screen-reader names

Buttons need visible text, an ARIA label, a title, or documented dynamic text. Icon-only controls should expose a stable accessible name.

## High-scale text

Font sizing should not depend on viewport units. Responsive layouts should use container spacing, wrapping, and fixed-format control constraints instead of scaling text with viewport width.
