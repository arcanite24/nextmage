import { useEffect, useState } from 'react';
import { applyUpdate, diffDecks, type DeckDiffRow } from '../../../core/deckImport/diff';
import { issuesOf, startDraft, toDeck } from '../../../core/deckImport/draft';
import { describeFailure, readingFromServer } from '../../../core/deckImport/remote';
import { browserFixStore } from '../../../core/deckImport/resolve';
import { siteById, type DeckSiteId } from '../../../core/deckImport/sites';
import type { CardView } from '../../../protocol/generated/views';
import { deckStorage } from '../../../services/DeckStorageService';
import type { DeckCardLists } from '../../../types/models';
import { api } from '../../connection';
import { useDecks } from '../../stores/decks';
import { notify } from '../../stores/toasts';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useCardInfoStore } from '../cardInfo';
import { entryKey, finalizeDeck, printingOf } from '../deckModel';
import { cardLookup } from './useImportFlow';
import styles from './UpdateDialog.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; saved: DeckCardLists; next: DeckCardLists; rows: DeckDiffRow[]; unmatched: number };

/** "Update from Archidekt": fetch the deck again and show what changed before replacing the cards. */
export function UpdateDialog({ deckId, onClose }: { deckId: string | null; onClose(): void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const saved = await deckStorage.loadDeck(deckId);
      const source = saved?.source;
      if (!saved || !source) throw new Error('This deck has no site to update from.');
      const site = source.site as DeckSiteId;
      let reading;
      try {
        reading = readingFromServer(await api.deckImportFromUrl(source.url), site, source.url);
      } catch (error) {
        if (!cancelled) setState({ kind: 'failed', message: describeFailure(error, site).message });
        return;
      }
      const draft = await startDraft(reading, cardLookup, { fixes: browserFixStore() });
      const info = new Map<string, CardView>();
      for (const card of draft.cards.values()) if (card) info.set(entryKey(printingOf(card)), card);
      useCardInfoStore.getState().remember([...info.values()]);
      const next = applyUpdate(saved, finalizeDeck({ ...toDeck(draft).deck, coverCard: undefined }, info));
      const unmatched = issuesOf(draft).reduce((sum, issue) => sum + issue.amount, 0);
      if (!cancelled) setState({ kind: 'ready', saved, next: { ...next, id: deckId }, rows: diffDecks(saved, next), unmatched });
    })().catch((reason) => !cancelled && setState({ kind: 'failed', message: reason instanceof Error ? reason.message : String(reason) }));
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const ready = state.kind === 'ready' ? state : null;
  const siteName = siteById(ready?.saved.source?.site)?.name ?? 'the site';

  return (
    <Dialog
      open={!!deckId}
      onOpenChange={(open) => !open && onClose()}
      title={ready ? `Update from ${siteName}` : 'Update deck'}
      width="md"
      description={state.kind === 'loading' ? 'Reading the deck again…' : state.kind === 'failed' ? state.message
        : ready!.rows.length === 0 ? `Nothing changed on ${siteName} since you imported it.` : `${ready!.rows.length} ${ready!.rows.length === 1 ? 'change' : 'changes'} on ${siteName}. Your name, cover and sleeve stay.`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>{ready && ready.rows.length > 0 ? 'Keep mine' : 'Close'}</Button>
          {ready && ready.rows.length > 0 && (
            <Button
              variant="decision"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await useDecks.getState().saveUpdated(ready.next);
                  notify('Deck updated', `${ready.next.name} matches ${siteName} again.`);
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Update deck
            </Button>
          )}
        </>
      }
    >
      {ready && ready.rows.length > 0 ? (
        <>
          <ul className={styles.rows}>
            {ready.rows.map((row) => (
              <li key={`${row.zone}:${row.cardName}`} className={row.before === 0 ? styles.added : row.after === 0 ? styles.removed : styles.changed}>
                <span className={styles.delta}>{row.after > row.before ? `+${row.after - row.before}` : `−${row.before - row.after}`}</span>
                <span className={styles.name}>{row.cardName}</span>
                {row.zone === 'side' && <span className={styles.zone}>Sideboard</span>}
                <span className={styles.total}>{row.before} → {row.after}</span>
              </li>
            ))}
          </ul>
          {ready.unmatched > 0 && <p className={styles.note}>{ready.unmatched} new {ready.unmatched === 1 ? 'card isn’t' : 'cards aren’t'} in the card database yet and will be left out.</p>}
        </>
      ) : (
        <span />
      )}
    </Dialog>
  );
}
