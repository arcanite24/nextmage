import { useQuery } from '@tanstack/react-query';
import { Eye, Layers, Package, Swords, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerType, TableView } from '../../protocol/generated/views';
import type { WebTournamentOptions } from '../../protocol/options';
import { api } from '../connection';
import { toWire } from '../decks/deckModel';
import { useServerState, useTables } from '../queries';
import { rosterOf, useDecks } from '../stores/decks';
import { useEvents } from '../stores/events';
import { useSession } from '../stores/session';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Zone } from '../ui/Zone';
import styles from './EventsScreen.module.css';

type EventKind = 'draft' | 'sealed' | 'constructed';

const KINDS: { value: EventKind; label: string; detail: string; icon: React.ReactNode }[] = [
  { value: 'draft', label: 'Booster draft', detail: 'Open three packs, pick a card, pass the rest.', icon: <Layers size={22} /> },
  { value: 'sealed', label: 'Sealed', detail: 'Open six packs and build from what you get.', icon: <Package size={22} /> },
  { value: 'constructed', label: 'Constructed', detail: 'Bring your own deck.', icon: <Swords size={22} /> },
];

const EMPTY_DECK = { cards: [], sideboard: [] };

/** Drafts, sealed and constructed events: join one, follow yours, or host a new one. */
export function EventsScreen() {
  const { data: tables = [] } = useTables();
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const tournaments = useEvents((state) => state.tournaments);
  const mine = useMemo(() => Object.values(tournaments).filter((tournament) => !tournament.over), [tournaments]);
  const navigate = useNavigate();
  const [hosting, setHosting] = useState<EventKind | null>(null);
  const events = tables.filter((table) => table.isTournament && table.tableState !== 'FINISHED');
  const open = events.filter((table) => table.tableState === 'WAITING');
  const running = events.filter((table) => table.tableState !== 'WAITING');

  async function join(table: TableView) {
    if (!roomId || !table.tableId) return;
    // limited events need no deck to join; constructed events take the selected deck
    let deck = EMPTY_DECK as Parameters<typeof api.roomJoinTournament>[5];
    if (!table.limited) {
      const selected = useDecks.getState().selectedId;
      if (!selected) {
        notify('Pick a deck first', 'Constructed events need a deck. Choose one on the Decks page.', 'error');
        return;
      }
      deck = toWire((await useDecks.getState().loadForPlay(selected)).deck);
    }
    const ok = await api.roomJoinTournament(roomId, table.tableId, userName, 'HUMAN', 1, deck).catch((error) => {
      notify("Couldn't join", error instanceof Error ? error.message : String(error), 'error');
      return null;
    });
    if (ok === false) notify("Couldn't join", 'The event did not accept your seat.', 'error');
    else if (ok) notify('Joined', `You're in ${table.tableName}. It starts when every seat is filled.`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Events</h1>
        <Button variant="decision" icon={<Trophy size={18} />} onClick={() => setHosting('draft')}>Host an event</Button>
      </header>

      {mine.length > 0 && (
        <Zone label="Your events" tone="filled">
          <div className={styles.list}>
            {mine.map((tournament) => (
              <button key={tournament.tournamentId} type="button" className={styles.mine} onClick={() => navigate(`/event/${tournament.tournamentId}`)}>
                <Trophy size={18} aria-hidden="true" />
                <span>{tournament.view?.tournamentName ?? 'Event'}</span>
                <small>{tournament.view?.runningInfo || tournament.view?.tournamentState || 'Open'}</small>
              </button>
            ))}
          </div>
        </Zone>
      )}

      {open.length === 0 && running.length === 0 ? (
        <Zone label="Start one" className={styles.starter}>
          <p className={styles.empty}>Nothing is running on the server. Host an event and the AI fills the empty seats, so you can start right away.</p>
          <div className={styles.kinds}>
            {KINDS.map((option) => (
              <button key={option.value} type="button" className={styles.kind} onClick={() => setHosting(option.value)}>
                {option.icon}
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </Zone>
      ) : (
      <div className={styles.columns}>
        <Zone label="Open to join" className={styles.zone}>
          {open.length === 0 ? (
            <p className={styles.empty}>No events are waiting for players. Host one and the AI can fill the empty seats.</p>
          ) : (
            <div className={styles.list}>
              {open.map((table) => (
                <EventRow key={table.tableId} table={table} action={<Button size="sm" variant="decision" onClick={() => void join(table)}>Join</Button>} />
              ))}
            </div>
          )}
        </Zone>
        <Zone label="Under way" className={styles.zone}>
          {running.length === 0 ? (
            <p className={styles.empty}>Nothing running right now.</p>
          ) : (
            <div className={styles.list}>
              {running.map((table) => (
                <EventRow
                  key={table.tableId}
                  table={table}
                  action={<Button size="sm" variant="quiet" icon={<Eye size={15} />} onClick={() => table.tableId && api.roomWatchTournament(table.tableId).catch(() => undefined)}>View</Button>}
                />
              ))}
            </div>
          )}
        </Zone>
      </div>
      )}

      {/* remounted per opening so it starts from the chosen format */}
      <HostDialog key={hosting ?? 'closed'} open={!!hosting} initialKind={hosting ?? 'draft'} onOpenChange={(open) => !open && setHosting(null)} />
    </div>
  );
}

function EventRow({ table, action }: { table: TableView; action: React.ReactNode }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <h3 className={styles.rowName}>{table.tableName}</h3>
        <p className={styles.rowMeta}>{table.gameType} · {table.additionalInfoShort || table.deckType}</p>
      </div>
      <span className={styles.rowState}>{table.seatsInfo}</span>
      <span className={styles.rowState}>{table.tableStateText}</span>
      {action}
    </article>
  );
}

function HostDialog({ open, initialKind, onOpenChange }: { open: boolean; initialKind: EventKind; onOpenChange(open: boolean): void }) {
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const server = useServerState();
  const sets = useQuery({
    queryKey: ['expansionSets'],
    queryFn: () => api.getExpansionSets(),
    staleTime: Infinity,
    enabled: open,
  });
  const boosterSets = useMemo(
    () => (sets.data ?? []).filter((set) => set.hasBoosters).sort((a, b) => (b.releaseDate ?? 0) - (a.releaseDate ?? 0)),
    [sets.data],
  );
  const decks = useDecks();
  const roster = useMemo(() => rosterOf(decks), [decks]);

  const [kind, setKind] = useState<EventKind>(initialKind);
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [seats, setSeats] = useState(initialKind === 'draft' ? 8 : 4);
  const [fillAi, setFillAi] = useState(true);
  const [swiss, setSwiss] = useState(true);
  const [rounds, setRounds] = useState(3);
  const [bestOf3, setBestOf3] = useState(false);
  const [format, setFormat] = useState('Constructed - Standard');
  const [deckId, setDeckId] = useState<string | null>(decks.selectedId);
  const [busy, setBusy] = useState(false);

  const chosenSet = setCode || boosterSets[0]?.setCode || '';
  const formats = (server.data?.deckTypes ?? []).filter((type) => type.startsWith('Constructed'));
  const limited = kind !== 'constructed';

  async function create() {
    if (!roomId) return;
    setBusy(true);
    try {
      const structure = swiss ? 'Swiss' : 'Elimination';
      const tournamentType = `${kind === 'draft' ? 'Booster Draft' : kind === 'sealed' ? 'Sealed' : 'Constructed'} ${structure}`;
      // the server's draft bot only drafts and concedes every game; this AI drafts, builds and plays
      const aiType: PlayerType = 'COMPUTER_MAD';
      const playerTypes: PlayerType[] = ['HUMAN', ...Array.from({ length: seats - 1 }, () => (fillAi ? aiType : 'HUMAN' as PlayerType))];
      const boosters = kind === 'draft' ? 3 : kind === 'sealed' ? 6 : 0;
      const options: WebTournamentOptions = {
        name: name.trim() || `${userName}'s ${kind === 'draft' ? 'draft' : kind === 'sealed' ? 'sealed' : 'event'}`,
        tournamentType,
        numberRounds: swiss ? rounds : 0,
        watchingAllowed: true,
        playerTypes,
        matchOptions: {
          gameType: 'Two Player Duel',
          deckType: limited ? 'Limited' : format,
          winsNeeded: bestOf3 ? 2 : 1,
          limited,
          spectatorsAllowed: true,
          skillLevel: 'CASUAL',
        },
        limitedOptions: limited
          ? { sets: Array.from({ length: boosters }, () => chosenSet), numberBoosters: boosters, constructionTime: 20 * 60, timing: 'REGULAR' }
          : { constructionTime: 0, numberBoosters: 0 },
      };
      const table = await api.roomCreateTournament(roomId, options);
      const tableId = table?.tableId;
      if (!tableId) throw new Error('The server did not create the event.');

      let deck = EMPTY_DECK as Parameters<typeof api.roomJoinTournament>[5];
      if (!limited) {
        if (!deckId) throw new Error('Pick a deck to play.');
        deck = toWire((await useDecks.getState().loadForPlay(deckId)).deck);
      }
      if (!await api.roomJoinTournament(roomId, tableId, userName, 'HUMAN', 1, deck)) throw new Error('Your seat was not accepted.');
      if (fillAi) {
        for (let seat = 1; seat < seats; seat++) {
          const joined = await api.roomJoinTournament(roomId, tableId, `Bot ${seat}`, playerTypes[seat], 4, deck);
          if (!joined) throw new Error('An AI player could not take its seat.');
        }
        if (!await api.tournamentStart(roomId, tableId)) throw new Error('The event could not start.');
      }
      notify(fillAi ? 'Event starting' : 'Event open', fillAi ? 'Seats filled with AI players.' : 'It starts when every seat is taken.');
      onOpenChange(false);
    } catch (error) {
      notify("Couldn't host the event", error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Host an event"
      width="lg"
      footer={(
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="decision" busy={busy} disabled={(limited && !chosenSet) || (!limited && !deckId)} onClick={() => void create()}>
            {fillAi ? 'Start event' : 'Open event'}
          </Button>
        </>
      )}
    >
      <div className={styles.form}>
        <div className={styles.kinds} role="radiogroup" aria-label="Event type">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              className={[styles.kind, kind === option.value ? styles.kindOn : ''].join(' ')}
              onClick={() => {
                setKind(option.value);
                setSeats(option.value === 'draft' ? 8 : 4);
              }}
            >
              {option.icon}
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder={`${userName}'s ${kind}`} maxLength={40} />
          {limited ? (
            <label className={styles.control}>
              <span>Set</span>
              <select value={chosenSet} onChange={(event) => setSetCode(event.target.value)} disabled={sets.isPending}>
                {boosterSets.map((set) => <option key={set.setCode} value={set.setCode}>{set.name} ({set.setCode})</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className={styles.control}>
                <span>Format</span>
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  {(formats.length ? formats : [format]).map((type) => <option key={type} value={type}>{type.replace(/^Constructed - /, '')}</option>)}
                </select>
              </label>
              <label className={styles.control}>
                <span>Your deck</span>
                <select value={deckId ?? ''} onChange={(event) => setDeckId(event.target.value || null)}>
                  {roster.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
                </select>
              </label>
            </>
          )}
          <label className={styles.control}>
            <span>Players</span>
            <select value={seats} onChange={(event) => setSeats(Number(event.target.value))}>
              {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label className={styles.control}>
            <span>Structure</span>
            <select value={swiss ? 'swiss' : 'elimination'} onChange={(event) => setSwiss(event.target.value === 'swiss')}>
              <option value="swiss">Swiss</option>
              <option value="elimination">Single elimination</option>
            </select>
          </label>
          {swiss && (
            <label className={styles.control}>
              <span>Rounds</span>
              <select value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
          )}
          <label className={styles.control}>
            <span>Matches</span>
            <select value={bestOf3 ? '3' : '1'} onChange={(event) => setBestOf3(event.target.value === '3')}>
              <option value="1">Best of one</option>
              <option value="3">Best of three</option>
            </select>
          </label>
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={fillAi} onChange={(event) => setFillAi(event.target.checked)} />
          <span>Fill the other seats with AI players and start now</span>
        </label>
      </div>
    </Dialog>
  );
}
