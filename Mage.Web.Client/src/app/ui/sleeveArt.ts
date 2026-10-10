/**
 * Career sleeves: matte dyes like the free ones, so they read the same around card art, each with a painted card back
 * from the art pipeline (art/specs/sleeve.json). Decks store a sleeve as its colour, so the back is found by colour.
 */
export const CAREER_SLEEVES: Record<string, string> = {
  copper: '#6e3f24',
  silver: '#5b6168',
  gold: '#7a5f1c',
  obsidian: '#121014',
  foil: '#4a3d78',
  // a school's graduates
  'school-pauper': '#3d5a36',
  'school-commander': '#4b2a5e',
  'school-limited': '#66583c',
  'school-pioneer': '#2c4a66',
  'school-standard': '#22605b',
  'school-modern': '#6a2a2c',
  'school-legacy': '#25305e',
  'school-vintage': '#4f4a1e',
  'school-brawl': '#7b3550',
};

/** The Career sleeve a color belongs to, if it's one. */
export function careerSleeveOf(color: string | undefined): string | null {
  if (!color) return null;
  const lower = color.toLowerCase();
  return Object.keys(CAREER_SLEEVES).find((id) => CAREER_SLEEVES[id] === lower) ?? null;
}

/** The painted back of a sleeve colour, when it's a Career sleeve. */
export function sleeveBackOf(color: string | undefined): string | null {
  const id = careerSleeveOf(color);
  return id ? `/career-art/sleeve/${id}.webp` : null;
}
