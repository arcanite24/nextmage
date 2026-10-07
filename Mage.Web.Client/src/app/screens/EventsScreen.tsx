import { Trophy } from 'lucide-react';
import { api } from '../connection';
import { useTables } from '../queries';
import { useSession } from '../stores/session';
import { notify } from '../stores/toasts';
import type { TableView } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { Zone } from '../ui/Zone';
import styles from './TablesScreen.module.css';

/** Tournaments, drafts and sealed events on the server. */
export function EventsScreen() {
  const { data: tables = [] } = useTables();
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const events = tables.filter((table) => table.isTournament && table.tableState !== 'FINISHED');

  async function join(table: TableView) {
    if (!roomId || !table.tableId) return;
    // limited events need no deck to join; constructed events get the deck at construction time
    const ok = await api.roomJoinTournament(roomId, table.tableId, userName, 'HUMAN', 1, { cards: [], sideboard: [] }).catch((error) => {
      notify("Couldn't join", error instanceof Error ? error.message : String(error), 'error');
      return false;
    });
    if (!ok) notify("Couldn't join", 'The event did not accept your seat.', 'error');
  }

  return (
    <Zone label="Events" className={styles.list}>
      {events.length === 0 && (
        <p className={styles.empty}>
          No drafts or tournaments are open. Hosting events from this screen arrives with the new event pages.
        </p>
      )}
      <div className={styles.group}>
        {events.map((table) => (
          <article key={table.tableId} className={styles.row}>
            <div className={styles.rowMain}>
              <h3 className={styles.tableName}><Trophy size={16} aria-hidden="true" /> {table.tableName}</h3>
              <p className={styles.tableMeta}>{table.gameType} · {table.deckType} · {table.additionalInfoShort}</p>
            </div>
            <span className={styles.state}>{table.seatsInfo}</span>
            <span className={styles.state}>{table.tableStateText}</span>
            <div className={styles.rowActions}>
              {table.tableState === 'WAITING' && <Button size="sm" onClick={() => void join(table)}>Join</Button>}
            </div>
          </article>
        ))}
      </div>
    </Zone>
  );
}
