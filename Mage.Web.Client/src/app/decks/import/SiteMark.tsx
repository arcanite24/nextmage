import type { DeckSite } from '../../../core/deckImport/sites';
import styles from './ImportSheet.module.css';

/** A site's printed mark: its two letters in ivory ink, never its logo. */
export function SiteMark({ site, size = 'md' }: { site: DeckSite; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={[styles.mark, styles[`mark_${size}`]].join(' ')} aria-hidden="true">{site.monogram}</span>;
}
