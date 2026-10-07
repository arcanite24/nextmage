import { Bot, Eye, Lock, Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../connection';
import { toWire } from '../decks/deckModel';
import { useServerState, useTables, queryClient } from '../queries';
import { rosterOf, useDecks } from '../stores/decks';
import { useSession } from '../stores/session';
import { notify } from '../stores/toasts';
import type { TableView } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Zone } from '../ui/Zone';
import styles from './TablesScreen.module.css';

const STATE_LABEL: Record<string, string> = {
  WAITING: 'Waiting for players',
  READY_TO_START: 'Ready to start',
  STARTING: 'Starting',
  DRAFTING: 'Drafting',
  CONSTRUCTING: 'Building decks',
  DUELING: 'Playing',
  SIDEBOARDING: 'Sideboarding',
  FINISHED: 'Finished',
};

/** Every table on the server: join one with your selected deck, watch a game, or host your own. */
export function TablesScreen() {
  const location = useLocation();
  const { data: tables = [], isLoading } = useTables();
  const userName = useSession((state) => state.userName);
  const roomId = useSession((state) => state.roomId);
  const decks = useDecks();
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const selectedDeck = roster.find((deck) => deck.id === decks.selectedId) ?? roster[0] ?? null;
  const [hostOpen, setHostOpen] = useState(!!(location.state as { host?: string } | null)?.host);
  const [busyTable, setBusyTable] = useState<string | null>(null);
  // a passworded table asks for the password in a dialog before joining
  const [locked, setLocked] = useState<TableView | null>(null);
  const [tablePassword, setTablePassword] = useState('');

  useEffect(() => {
    if (!decks.loaded) void decks.refresh();
  }, [decks]);

  const games = tables.filter((table) => !table.isTournament);
  const mine = games.filter((table) => table.seats?.some((seat) => seat.playerName === userName) && table.tableState !== 'FINISHED');
  const open = games.filter((table) => table.tableState === 'WAITING' && !mine.includes(table));
  const running = games.filter((table) => table.tableState !== 'WAITING' && table.tableState !== 'FINISHED' && !mine.includes(table));

  async function join(table: TableView, password?: string) {
    if (!roomId || !table.tableId || !selectedDeck) return;
    if (table.passworded && password === undefined) {
      setTablePassword('');
      setLocked(table);
      return;
    }
    setBusyTable(table.tableId);
    try {
      const { deck } = await decks.loadForPlay(selectedDeck.id);
      const joined = await api.roomJoinTable(roomId, table.tableId, userName, 'HUMAN', 1, toWire(deck), password ?? '');
      if (!joined) notify("Couldn't join", table.passworded ? 'Wrong password, or the table did not accept your deck.' : 'The table did not accept your seat or deck.', 'error');
      await queryClient.invalidateQueries({ queryKey: ['tables'] });
    } catch (error) {
      notify("Couldn't join", error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setBusyTable(null);
    }
  }

  async function watch(table: TableView) {
    if (!roomId || !table.tableId) return;
    const ok = await api.roomWatchTable(roomId, table.tableId).catch(() => false);
    if (!ok) notify("Can't watch this game", 'The table does not allow spectators.', 'error');
  }

  return (
    <div className={styles.page}>
      <div className={styles.columns}>
        <Zone
          label="Open tables"
          aside={<Button size="sm" variant="print" icon={<Plus size={16} />} onClick={() => setHostOpen(true)}>Host a table</Button>}
          className={styles.list}
        >
          {mine.length > 0 && (
            <div className={styles.group}>
              <h3 className={styles.groupLabel}>Your tables</h3>
              {mine.map((table) => (
                <MyTable key={table.tableId} table={table} />
              ))}
            </div>
          )}
          <div className={styles.group}>
            {open.length === 0 && !isLoading && (
              <p className={styles.empty}>No one is waiting right now. Host a table and invite a friend, or play the AI from Home.</p>
            )}
            {open.map((table) => (
              <TableRow key={table.tableId} table={table}>
                <Button size="sm" busy={busyTable === table.tableId} disabled={!selectedDeck} onClick={() => void join(table)}>
                  Join
                </Button>
              </TableRow>
            ))}
          </div>
        </Zone>

        <Zone label="Games in progress" className={styles.list}>
          {running.length === 0 && <p className={styles.empty}>No games are being played.</p>}
          {running.map((table) => (
            <TableRow key={table.tableId} table={table}>
              {table.spectatorsAllowed && (
                <Button size="sm" variant="quiet" icon={<Eye size={16} />} onClick={() => void watch(table)}>Watch</Button>
              )}
            </TableRow>
          ))}
        </Zone>
      </div>
      <p className={styles.deckNote}>
        Joining with <strong>{selectedDeck?.name ?? 'no deck'}</strong>. Change it on the Play screen.
      </p>
      <Dialog
        open={!!locked}
        onOpenChange={(open) => !open && setLocked(null)}
        title="Table password"
        description={locked ? `${locked.tableName} is private. Ask the host for its password.` : undefined}
        width="sm"
        footer={(
          <>
            <Button variant="quiet" onClick={() => setLocked(null)}>Cancel</Button>
            <Button
              variant="decision"
              disabled={!tablePassword}
              onClick={() => {
                const table = locked!;
                setLocked(null);
                void join(table, tablePassword);
              }}
            >
              Join
            </Button>
          </>
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked || !tablePassword) return;
            const table = locked;
            setLocked(null);
            void join(table, tablePassword);
          }}
        >
          <Field label="Password" type="password" value={tablePassword} onChange={(event) => setTablePassword(event.target.value)} autoFocus />
        </form>
      </Dialog>
      <HostDialog open={hostOpen} onOpenChange={setHostOpen} deckId={selectedDeck?.id ?? null} />
    </div>
  );
}

function TableRow({ table, children }: { table: TableView; children?: React.ReactNode }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <h3 className={styles.tableName}>
          {table.passworded && <Lock size={14} aria-label="Password required" />}
          {table.tableName}
        </h3>
        <p className={styles.tableMeta}>
          {table.gameType} · {(table.deckType ?? '').replace(/^Constructed - /, '')} · {table.controllerName}
        </p>
      </div>
      <ul className={styles.seats} aria-label="Seats">
        {(table.seats ?? []).map((seat, index) => (
          <li key={index} className={seat.playerName ? styles.seatTaken : styles.seatOpen} title={seat.playerName || 'Open seat'}>
            {seat.playerType && seat.playerType !== 'HUMAN' ? <Bot size={14} aria-hidden="true" /> : <UserRound size={14} aria-hidden="true" />}
            <span>{seat.playerName || 'Open'}</span>
          </li>
        ))}
      </ul>
      <span className={styles.state}>{STATE_LABEL[table.tableState ?? ''] ?? table.tableStateText}</span>
      <div className={styles.rowActions}>{children}</div>
    </article>
  );
}

function MyTable({ table }: { table: TableView }) {
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const isOwner = table.controllerName === userName;
  const ready = table.tableState === 'READY_TO_START';
  return (
    <TableRow table={table}>
      {isOwner && table.tableState !== 'DUELING' && (
        <>
          <Button size="sm" variant="quiet" onClick={() => roomId && table.tableId && void api.tableRemove(roomId, table.tableId)}>Close</Button>
          <Button size="sm" variant={ready ? 'decision' : 'print'} disabled={!ready} onClick={() => roomId && table.tableId && void api.matchStart(roomId, table.tableId)}>
            Start
          </Button>
        </>
      )}
      {!isOwner && table.tableState === 'WAITING' && (
        <Button size="sm" variant="quiet" onClick={() => roomId && table.tableId && void api.roomLeaveTableOrTournament(roomId, table.tableId)}>Leave</Button>
      )}
    </TableRow>
  );
}

function HostDialog({ open, onOpenChange, deckId }: { open: boolean; onOpenChange(open: boolean): void; deckId: string | null }) {
  const { data: serverState } = useServerState();
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const loadForPlay = useDecks((state) => state.loadForPlay);
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState('Two Player Duel');
  const [deckType, setDeckType] = useState('Constructed - Freeform');
  const [wins, setWins] = useState(2);
  const [aiSeats, setAiSeats] = useState(0);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameTypes = serverState?.gameTypes ?? [];
  const type = gameTypes.find((item) => item.name === gameType);
  const seats = type?.minPlayers ?? 2;

  async function host() {
    if (!roomId || !deckId) return;
    setBusy(true);
    setError(null);
    try {
      const { deck } = await loadForPlay(deckId);
      const playerTypes = Array.from({ length: seats }, (_, index) => (index > 0 && index <= aiSeats ? 'COMPUTER_MAD' : 'HUMAN'));
      const table = await api.roomCreateTable(roomId, {
        name: name.trim() || `${userName}'s table`,
        gameType,
        deckType,
        winsNeeded: wins,
        password: password || undefined,
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        playerTypes,
      });
      if (!table.tableId) throw new Error('The server did not create the table.');
      const wire = toWire(deck);
      if (!await api.roomJoinTable(roomId, table.tableId, userName, 'HUMAN', 1, wire, password)) {
        throw new Error('Your deck is not legal for this format.');
      }
      for (let seat = 1; seat <= aiSeats; seat++) {
        await api.roomJoinTable(roomId, table.tableId, `AI ${seat}`, 'COMPUTER_MAD', 4, wire, password);
      }
      await queryClient.invalidateQueries({ queryKey: ['tables'] });
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Host a table"
      description="Friends on this server will see it under Open tables."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="decision" busy={busy} disabled={!deckId} onClick={() => void host()}>Host</Button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Table name" value={name} placeholder={`${userName}'s table`} onChange={(event) => setName(event.target.value)} />
        <label className={styles.selectField}>
          <span>Game</span>
          <select value={gameType} onChange={(event) => setGameType(event.target.value)}>
            {gameTypes.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        <label className={styles.selectField}>
          <span>Format</span>
          <select value={deckType} onChange={(event) => setDeckType(event.target.value)}>
            {(serverState?.deckTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.selectField}>
          <span>Games to win</span>
          <select value={wins} onChange={(event) => setWins(Number(event.target.value))}>
            <option value={1}>1 (single game)</option>
            <option value={2}>2 (best of three)</option>
            <option value={3}>3 (best of five)</option>
          </select>
        </label>
        {seats > 2 && (
          <label className={styles.selectField}>
            <span>AI players</span>
            <select value={aiSeats} onChange={(event) => setAiSeats(Number(event.target.value))}>
              {Array.from({ length: seats }, (_, index) => <option key={index} value={index}>{index}</option>)}
            </select>
          </label>
        )}
        <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} hint="Leave empty for an open table." />
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
