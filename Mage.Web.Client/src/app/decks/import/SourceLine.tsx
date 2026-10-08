import { siteById } from '../../../core/deckImport/sites';
import type { DeckImportSource } from '../../../core/decks/types';
import { SiteMark } from './SiteMark';
import { timeAgo } from './text';
import styles from './SourceLine.module.css';

/** "From Archidekt · updated 3 days ago", with a link to the deck on its site. */
export function SourceLine({ source, className }: { source: DeckImportSource; className?: string }) {
  const site = siteById(source.site);
  if (!site) return null;
  const changed = source.remoteUpdatedAt ?? source.importedAt;
  return (
    <p className={[styles.line, className ?? ''].join(' ')}>
      <SiteMark site={site} size="sm" />
      <span>
        From <a href={source.url} target="_blank" rel="noopener noreferrer">{site.name}</a>
        {' · '}
        {source.remoteUpdatedAt ? `updated ${timeAgo(changed)}` : `imported ${timeAgo(source.importedAt)}`}
      </span>
    </p>
  );
}
