import { useQuery } from '@tanstack/react-query';
import type { DeckCardInfo } from '../../protocol/generated/views';
import { api } from '../connection';
import { useT } from '../i18n';
import { Dialog } from '../ui/Dialog';
import { mergeByName } from './careerModesModel';
import styles from './CareerModes.module.css';

function rows(cards: readonly DeckCardInfo[] | undefined) {
  return mergeByName((cards ?? []).map((card) => ({ name: card.cardName, amount: card.amount }))).sort((a, b) => a.name.localeCompare(b.name));
}

/** The list of the deck a campaign duel hands you, to study before you sit down. */
export function DeckListDialog({ campaignId, nodeId, name, onClose }: { campaignId: string; nodeId: string; name: string; onClose(): void }) {
  const t = useT();
  const deck = useQuery({ queryKey: ['career', 'campaignDeck', campaignId, nodeId], queryFn: () => api.careerCampaignDeck(campaignId, nodeId), staleTime: Infinity });
  const main = rows(deck.data?.cards);
  const side = rows(deck.data?.sideboard);
  const count = main.reduce((sum, row) => sum + row.amount, 0);
  // a Commander or Brawl deck keeps its commander in the sideboard
  const commander = side.length > 0 && side.length <= 2 && (count === 99 || count === 98 || count === 59 || count === 58);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={name} description={t('career.deckList.count', { count })} width="md">
      {deck.isPending && <p className={styles.note}>{t('career.loading')}</p>}
      {deck.isError && <p className={styles.error} role="alert">{t('career.failed')}</p>}
      {deck.data && (
        <div className={styles.deckDialog}>
          {side.length > 0 && commander && (
            <section>
              <h4 className={styles.subhead}>{t('career.deckList.commander')}</h4>
              <ul>{side.map((row) => <li key={row.name}>{row.name}</li>)}</ul>
            </section>
          )}
          <section>
            <h4 className={styles.subhead}>{t('career.deckList.main')}</h4>
            <ul>{main.map((row) => <li key={row.name}><b>{row.amount}</b> {row.name}</li>)}</ul>
          </section>
          {side.length > 0 && !commander && (
            <section>
              <h4 className={styles.subhead}>{t('career.deckList.sideboard')}</h4>
              <ul>{side.map((row) => <li key={row.name}><b>{row.amount}</b> {row.name}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
