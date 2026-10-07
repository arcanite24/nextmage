/** Product mark: a stitched mat with one card zone printed on it. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="4.5" width="29" height="23" rx="5" fill="var(--mat-500)" />
      <rect x="3.5" y="6.5" width="25" height="19" rx="3.5" fill="none" stroke="var(--thread)" strokeWidth="1.2" strokeDasharray="2.2 1.6" opacity="0.8" />
      <rect x="12" y="9.5" width="9" height="13" rx="1.6" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <circle cx="16.5" cy="16" r="1.8" fill="var(--decision)" />
    </svg>
  );
}
