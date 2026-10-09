/**
 * Server text without internal object ids ("Ajani's Aid [cf6]"), for plain-text places like headings. Spaces the
 * server leaves before punctuation ("Pay Kicker {4} ?") go too.
 */
export function cleanText(text: string): string {
  return text.replace(/\s*\[[0-9a-f]{3,}\]/gi, '').replace(/\s+([?!,;:]|\.(?!\d))/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
