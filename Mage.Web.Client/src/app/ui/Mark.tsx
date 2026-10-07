/**
 * Product mark: a hand of three cards, fanned, the front one ticked in decision amber.
 * Drawn from the Codex-generated direction in .impeccable/logos (logo-2-fan.png). Name-agnostic, so it survives
 * a rename.
 */
export function Mark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="var(--mat-900, #16231e)" stroke="var(--ink-strong, #e9e4d6)" strokeWidth="3.4" strokeLinejoin="round">
        <rect x="11" y="16" width="24" height="34" rx="3.5" transform="rotate(-16 23 33)" />
        <rect x="17.5" y="14" width="24" height="34" rx="3.5" transform="rotate(-8 29.5 31)" />
        <rect x="25" y="12" width="25" height="36" rx="3.5" transform="rotate(6 37.5 30)" />
      </g>
      {/* the card under consideration */}
      <path d="M41.4 14.9 L47.4 15.5 L46.8 21.6 Z" fill="var(--decision, #f0b13d)" transform="rotate(6 37.5 30)" />
    </svg>
  );
}
