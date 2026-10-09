import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Eye, Layers, Package, Shuffle, Swords, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCubeFromDeck, maxPoolSets, PACK_SOURCES, planEvent, TIMINGS, type EventChoice, type EventKind, type PackSource } from '../../core/events/eventPlan';
import type { ExpansionSetInfo, PlayerType, TableView, TimingOption } from '../../protocol/generated/views';
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

const KINDS: { value: EventKind; label: string; detail: string; icon: React.ReactNode }[] = [
  { value: 'draft', label: 'Booster draft', detail: 'Open three packs, pick a card, pass the rest.', icon: <Layers size={22} /> },
  { value: 'sealed', label: 'Sealed', detail: 'Open six packs and build from what you get.', icon: <Package size={22} /> },
  { value: 'jumpstart', label: 'Jumpstart', detail: 'Shuffle two themed half-decks together and play.', icon: <Shuffle size={22} /> },
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
        <Button variant="print" icon={<Trophy size={18} />} onClick={() => setHosting('draft')}>Host an event</Button>
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
          <p className={styles.empty}>Nothing is running on the server. Empty seats can be filled with AI players.</p>
          <ul className={styles.starts}>
            {KINDS.map((option) => (
              <li key={option.value}>
                <button type="button" className={styles.start} onClick={() => setHosting(option.value)}>
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Zone>
      ) : (
      <div className={styles.columns}>
        <Zone label="Open to join" className={styles.zone}>
          {open.length === 0 ? (
            <p className={styles.empty}>No events are waiting for players. Host one and the AI can fill the empty seats.</p>
          ) : (
            <div className={styles.list}>
              {open.map((table) => (
                <EventRow key={table.tableId} table={table} action={<Button size="sm" variant="print" onClick={() => void join(table)}>Join</Button>} />
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
  const cubes = useMemo(() => [...(server.data?.draftCubes ?? [])].sort((a, b) => a.localeCompare(b)), [server.data?.draftCubes]);
  const types = useMemo(() => server.data?.tournamentTypes ?? [], [server.data?.tournamentTypes]);

  const [kind, setKind] = useState<EventKind>(initialKind);
  const [source, setSource] = useState<PackSource>('set');
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [pool, setPool] = useState<string[] | null>(null);
  const [cubeName, setCubeName] = useState('');
  const [cubeDeckId, setCubeDeckId] = useState<string>('');
  const [jumpstartPacks, setJumpstartPacks] = useState<{ name: string; text: string } | null>(null);
  const [seats, setSeats] = useState(initialKind === 'draft' ? 8 : 4);
  const [fillAi, setFillAi] = useState(true);
  const [swiss, setSwiss] = useState(true);
  const [rounds, setRounds] = useState(3);
  const [bestOf3, setBestOf3] = useState(false);
  const [constructionMinutes, setConstructionMinutes] = useState(20);
  const [timing, setTiming] = useState<TimingOption>('REGULAR');
  const [format, setFormat] = useState('Constructed - Standard');
  const [deckId, setDeckId] = useState<string | null>(decks.selectedId);
  const [busy, setBusy] = useState(false);

  const chosenSet = setCode || boosterSets[0]?.setCode || '';
  // the six newest sets until the host picks a pool
  const chosenPool = pool ?? boosterSets.slice(0, 6).map((set) => set.setCode ?? '');
  const chosenCube = cubeName || cubes.find((cube) => !isCubeFromDeck(cube)) || '';
  const formats = (server.data?.deckTypes ?? []).filter((type) => type.startsWith('Constructed'));
  const limited = kind !== 'constructed';
  const sources = kind === 'constructed' ? [] : PACK_SOURCES[kind];
  const usesCube = source === 'cube' || source === 'richManCube';
  const usesPool = source === 'random' || source === 'reshuffled' || source === 'richMan';
  // custom jumpstart only comes as single elimination
  const structureFixed = kind === 'jumpstart' && source === 'custom';

  const choice: EventChoice = {
    kind,
    swiss: swiss && !structureFixed,
    source,
    players: seats,
    setCode: chosenSet,
    pool: chosenPool,
    cubeName: chosenCube,
    cubeFromDeck: cubeDeckId ? { pending: cubeDeckId } : undefined,
    jumpstartPacks: jumpstartPacks?.text,
    constructionMinutes,
    timing,
  };
  const check = sets.isPending || server.isPending ? 'Loading…' : planEvent(choice, types);
  const problem = typeof check === 'string' ? check : null;

  function chooseKind(next: EventKind) {
    setKind(next);
    setSource('set');
    setSeats(next === 'draft' ? 8 : 4);
  }

  async function readPacks(file: File | undefined) {
    if (!file) return;
    if (file.size > 300_000) {
      notify('File too big', 'Jumpstart pack files can be at most 300 KB.', 'error');
      return;
    }
    setJumpstartPacks({ name: file.name, text: await file.text() });
  }

  async function create() {
    if (!roomId) return;
    setBusy(true);
    try {
      const cubeFromDeck = usesCube && isCubeFromDeck(chosenCube) && cubeDeckId
        ? toWire((await useDecks.getState().loadForPlay(cubeDeckId)).deck)
        : undefined;
      const plan = planEvent({ ...choice, cubeFromDeck }, types);
      if (typeof plan === 'string') throw new Error(plan);
      // the server's draft bot only drafts and concedes every game; this AI drafts, builds and plays
      const aiType: PlayerType = 'COMPUTER_MAD';
      const playerTypes: PlayerType[] = ['HUMAN', ...Array.from({ length: seats - 1 }, () => (fillAi ? aiType : 'HUMAN' as PlayerType))];
      const options: WebTournamentOptions = {
        name: name.trim() || `${userName}'s ${kind === 'constructed' ? 'event' : kind}`,
        tournamentType: plan.tournamentType,
        numberRounds: choice.swiss ? rounds : 0,
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
        limitedOptions: plan.limitedOptions,
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
          {problem && problem !== 'Loading…' && <p className={styles.problem} role="status">{problem}</p>}
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="decision" busy={busy} disabled={!!problem || (!limited && !deckId)} onClick={() => void create()}>
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
              onClick={() => chooseKind(option.value)}
            >
              {option.icon}
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>

        {sources.length > 1 && (
          <div className={styles.sources} role="radiogroup" aria-label="Packs">
            {sources.map((option) => (
              <label key={option.value} className={[styles.source, source === option.value ? styles.sourceOn : ''].join(' ')}>
                <input type="radio" name="source" value={option.value} checked={source === option.value} onChange={() => setSource(option.value)} />
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </label>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder={`${userName}'s ${kind}`} maxLength={40} />
          {limited && kind !== 'jumpstart' && source === 'set' && (
            <label className={styles.control}>
              <span>Set</span>
              <select value={chosenSet} onChange={(event) => setSetCode(event.target.value)} disabled={sets.isPending}>
                {boosterSets.map((set) => <option key={set.setCode} value={set.setCode}>{set.name} ({set.setCode})</option>)}
              </select>
            </label>
          )}
          {usesCube && (
            <label className={styles.control}>
              <span>Cube</span>
              <select value={chosenCube} onChange={(event) => setCubeName(event.target.value)}>
                {cubes.map((cube) => <option key={cube} value={cube}>{isCubeFromDeck(cube) ? 'Your own cube (a saved deck)' : cube}</option>)}
              </select>
            </label>
          )}
          {usesCube && isCubeFromDeck(chosenCube) && (
            <label className={styles.control}>
              <span>Cube list</span>
              <select value={cubeDeckId} onChange={(event) => setCubeDeckId(event.target.value)}>
                <option value="">Pick a deck…</option>
                {roster.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
              </select>
            </label>
          )}
          {!limited && (
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
          {!structureFixed && (
            <label className={styles.control}>
              <span>Structure</span>
              <select value={swiss ? 'swiss' : 'elimination'} onChange={(event) => setSwiss(event.target.value === 'swiss')}>
                <option value="swiss">Swiss</option>
                <option value="elimination">Single elimination</option>
              </select>
            </label>
          )}
          {choice.swiss && (
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
          {kind === 'draft' && (
            <label className={styles.control}>
              <span>Pick timer</span>
              <select value={timing} onChange={(event) => setTiming(event.target.value as TimingOption)}>
                {TIMINGS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
          {limited && (
            <label className={styles.control}>
              <span>Deck building</span>
              <select value={constructionMinutes} onChange={(event) => setConstructionMinutes(Number(event.target.value))}>
                {[10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          )}
        </div>

        {usesPool && (
          <SetPool
            sets={boosterSets}
            pool={chosenPool}
            onChange={setPool}
            limit={source === 'reshuffled' ? undefined : maxPoolSets(source, seats)}
          />
        )}

        {kind === 'jumpstart' && source === 'custom' && (
          <label className={styles.upload}>
            <span>Packs file</span>
            <input type="file" accept=".txt,.dck,text/plain" onChange={(event) => void readPacks(event.target.files?.[0])} />
            <small>{jumpstartPacks ? `${jumpstartPacks.name} · ${jumpstartPacks.text.length.toLocaleString()} characters` : 'A text file of half-decks, in the desktop client\'s jumpstart format.'}</small>
          </label>
        )}

        {usesCube && isCubeFromDeck(chosenCube) && (
          <p className={styles.hint}>Import your cube list on the Decks page like any deck (for example from CubeCobra as text), then pick it here.</p>
        )}

        <label className={styles.check}>
          <input type="checkbox" checked={fillAi} onChange={(event) => setFillAi(event.target.checked)} />
          <span>Fill the other seats with AI players and start now</span>
        </label>
      </div>
    </Dialog>
  );
}

/** The sets random, reshuffled and rich man drafts open packs from. */
function SetPool({ sets, pool, onChange, limit }: {
  sets: ExpansionSetInfo[];
  pool: string[];
  onChange(pool: string[]): void;
  limit?: number;
}) {
  const [filter, setFilter] = useState('');
  const chosen = new Set(pool);
  const needle = filter.trim().toLowerCase();
  const shown = sets.filter((set) => !needle || set.name?.toLowerCase().includes(needle) || set.setCode?.toLowerCase().includes(needle));
  function toggle(code: string) {
    onChange(chosen.has(code) ? pool.filter((entry) => entry !== code) : [...pool, code]);
  }
  return (
    <fieldset className={styles.pool}>
      <legend>Set pool · {pool.length} chosen{limit && pool.length > limit ? ` (${limit} are used, picked at random)` : ''}</legend>
      <div className={styles.poolTools}>
        <Field label="Find a set" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <Button size="sm" variant="quiet" onClick={() => onChange([])}>Clear</Button>
      </div>
      <ul className={styles.poolList}>
        {shown.map((set) => (
          <li key={set.setCode}>
            <label>
              <input type="checkbox" checked={chosen.has(set.setCode ?? '')} onChange={() => toggle(set.setCode ?? '')} />
              {set.name} <small>{set.setCode}</small>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
