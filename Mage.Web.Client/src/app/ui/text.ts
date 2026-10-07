/** Server text without internal object ids ("Ajani's Aid [cf6]"), for plain-text places like headings. */
export function cleanText(text: string): string {
  return text.replace(/\s*\[[0-9a-f]{3,}\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}
