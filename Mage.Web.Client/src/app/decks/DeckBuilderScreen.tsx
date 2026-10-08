import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowLeftRight, Check, ChevronLeft, ClipboardCopy, ClipboardPaste, ListPlus, Minus, Plus, Replace, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CardView } from '../../protocol/generated/views';
import { appendDeckCardLists } from '../../core/decks/merge';
import { deckStorage } from '../../core/decks/DeckStorageService';
import { DeckSerializer } from '../../core/decks/DeckSerializer';
import type { DeckCardLists } from '../../core/decks/types';
import { useServerState } from '../queries';
import { STARTER_PREFIX, useDecks } from '../stores/decks';
import { openImport, type ImportTarget } from '../stores/importSheet';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { ManaCost } from '../ui/ManaCost';
import { useCardInfo, useCardInfoStore } from './cardInfo';
import { Collection } from './Collection';
import { ManaCurve } from './ManaCurve';
import { SourceLine } from './import/SourceLine';
import { useImportPaste } from './import/useImportShortcuts';
import { useValidation } from './useValidation';
import {
  addCard, copiesByName, copyLimit, countZone, entryKey, finalizeDeck, groupDeck, manaCurve, moveCard,
  printingOf, removeCard, type DeckZone,
} from './deckModel';
import styles from './DeckBuilder.module.css';

const DEFAULT_FORMAT = 'Constructed - Freeform';

/** Opens the deck named in the URL: starter decks are copied into the library first, "new" makes an empty deck. */
export function DeckBuilderScreen() {
  const { deckId = '' } = useParams();
  return <DeckLoader key={deckId} deckId={deckId} />;
}

function DeckLoader({ deckId }: { deckId: string }) {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckCardLists | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (deckId === 'new') {
        const id = await deckStorage.saveDeck({ name: 'New deck', format: DEFAULT_FORMAT, cards: [], sideboard: [] }, { forceNew: true });
        await useDecks.getState().refresh();
        useDecks.getState().select(id);
        if (!cancelled) navigate(`/decks/${id}`, { replace: true });
        return;
      }
      if (deckId.startsWith(STARTER_PREFIX)) {
        if (!useDecks.getState().loaded) await useDecks.getState().refresh();
        const { id } = await useDecks.getState().loadForPlay(deckId);
        if (!cancelled) navigate(`/decks/${id}`, { replace: true });
        return;
      }
      const loaded = await deckStorage.loadDeck(deckId);
      if (cancelled) return;
      if (!loaded) setError('This deck is no longer saved in this browser.');
      else setDeck({ ...loaded, id: deckId, format: loaded.format || DEFAULT_FORMAT });
    })().catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      cancelled = true;
    };
  }, [deckId, navigate]);

  if (error) {
    return (
      <div className={styles.missing}>
        <h1>Deck not found</h1>
        <p>{error}</p>
        <Button variant="print" onClick={() => navigate('/decks')}>Back to decks</Button>
      </div>
    );
  }
  if (!deck) return <div className={styles.missing}><p>Opening the deck…</p></div>;
  return <DeckBuilder key={deck.id} initial={deck} />;
}

function DeckBuilder({ initial }: { initial: DeckCardLists }) {
  const navigate = useNavigate();
  const [deck, setDeck] = useState(initial);
  const [zone, setZone] = useState<DeckZone>('cards');
  const [preview, setPreview] = useState<{ card: CardView; anchor: DOMRect; side: 'auto' | 'left' } | null>(null);
  // a deck pasted here becomes its own deck; "From a list…" brings cards into this one
  useImportPaste();
  const allEntries = useMemo(() => [...deck.cards, ...deck.sideboard], [deck.cards, deck.sideboard]);
  const info = useCardInfo(allEntries);
  const format = deck.format || DEFAULT_FORMAT;
  const server = useServerState();
  const formats = useMemo(() => (server.data?.deckTypes ?? [DEFAULT_FORMAT]).filter((type) => !/^Variant|Limited/.test(type) || type === 'Limited'), [server.data]);

  // autosave: the deck in storage always matches the screen, a moment later
  const [savedDeck, setSavedDeck] = useState(initial);
  const saving = deck !== savedDeck;
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      void deckStorage.saveDeck(finalizeDeck(deck, useCardInfoStore.getState().info))
        .then(() => setSavedDeck(deck))
        .catch((reason) => notify("Couldn't save the deck", String(reason), 'error'));
    }, 500);
    return () => clearTimeout(timer);
  }, [deck, saving]);
  useEffect(() => () => {
    void useDecks.getState().refresh();
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of allEntries) map.set(entry.cardName.toLowerCase(), (map.get(entry.cardName.toLowerCase()) ?? 0) + entry.amount);
    return map;
  }, [allEntries]);
  const limitOf = useCallback((card: CardView) => (format === 'Limited' ? Infinity : copyLimit(card, card.name ?? '')), [format]);

  const add = useCallback((card: CardView) => {
    const limit = limitOf(card);
    if (copiesByName(deck, card.name ?? '') >= limit) {
      notify(`${limit} copies at most`, `${card.name} is already at its limit.`);
      return;
    }
    setDeck((current) => (copiesByName(current, card.name ?? '') >= limit ? current : addCard(current, zone, printingOf(card))));
  }, [deck, zone, limitOf]);
  const removeOne = useCallback((card: CardView) => {
    setDeck((current) => {
      const name = (card.name ?? '').toLowerCase();
      // prefer the zone being edited, then the other one
      for (const from of [zone, zone === 'cards' ? 'sideboard' : 'cards'] as DeckZone[]) {
        const entry = current[from].find((candidate) => candidate.cardName.toLowerCase() === name);
        if (entry) return removeCard(current, from, entryKey(entry));
      }
      return current;
    });
  }, [zone]);
  // collection cards preview beside the card; deck rows preview to the left of the deck list
  const onPreview = useCallback((card: CardView | null, anchor?: DOMRect) => setPreview(card && anchor ? { card, anchor, side: 'auto' } : null), []);
  const onRowPreview = useCallback((card: CardView | null, anchor?: DOMRect) => setPreview(card && anchor ? { card, anchor, side: 'left' } : null), []);

  return (
    <div className={styles.page}>
      <Collection format={format === 'Limited' ? '' : format} counts={counts} limitOf={limitOf} onAdd={add} onRemove={removeOne} onPreview={onPreview} />
      <DeckPanel
        deck={deck}
        zone={zone}
        info={info}
        formats={formats}
        saving={saving}
        onZone={setZone}
        onChange={setDeck}
        onPreview={onRowPreview}
        onDone={() => navigate('/decks')}
        onPlay={() => {
          useDecks.getState().select(deck.id!);
          navigate('/');
        }}
      />
      {preview && <Preview {...preview} />}
    </div>
  );
}

function DeckPanel({ deck, zone, info, formats, saving, onZone, onChange, onPreview, onDone, onPlay }: {
  deck: DeckCardLists;
  zone: DeckZone;
  info: ReadonlyMap<string, CardView>;
  formats: string[];
  saving: boolean;
  onZone(zone: DeckZone): void;
  onChange(update: (deck: DeckCardLists) => DeckCardLists): void;
  onPreview(card: CardView | null, anchor?: DOMRect): void;
  onDone(): void;
  onPlay(): void;
}) {
  const format = deck.format || DEFAULT_FORMAT;
  const groups = useMemo(() => groupDeck(deck[zone], info), [deck, zone, info]);
  const curve = useMemo(() => manaCurve(deck.cards, info), [deck.cards, info]);
  const mainCount = countZone(deck, 'cards');
  const sideCount = countZone(deck, 'sideboard');
  const validation = useValidation(deck, format);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const problems = validation.data?.errors ?? [];

  /** where the import sheet puts a list for this deck: in place of its cards, or added to them */
  function intoDeck(mode: 'replace' | 'add'): ImportTarget {
    return {
      kind: 'into',
      mode,
      deckName: deck.name || 'this deck',
      apply: (fresh) => onChange((current) => (mode === 'replace'
        ? { ...current, cards: fresh.cards, sideboard: fresh.sideboard, format: fresh.format || current.format, source: fresh.source ?? current.source }
        : appendDeckCardLists(current, fresh))),
    };
  }

  return (
    <aside className={styles.deck} aria-label="Deck">
      <header className={styles.deckHead}>
        <input
          className={styles.deckName}
          value={deck.name ?? ''}
          onChange={(event) => {
            const name = event.target.value;
            onChange((current) => ({ ...current, name }));
          }}
          aria-label="Deck name"
          maxLength={60}
        />
        <select
          className={styles.select}
          value={format}
          onChange={(event) => {
            const value = event.target.value;
            onChange((current) => ({ ...current, format: value }));
          }}
          aria-label="Format"
        >
          {(formats.includes(format) ? formats : [format, ...formats]).map((type) => (
            <option key={type} value={type}>{type.replace(/^Constructed - /, '')}</option>
          ))}
        </select>
      </header>

      <div className={styles.status}>
        <span className={styles.total}>{mainCount}<small> cards</small></span>
        {validation.data && (validation.data.valid ? (
          <span className={[styles.chip, styles.chipOk].join(' ')}><Check size={15} aria-hidden="true" /> Legal</span>
        ) : (
          <button type="button" className={[styles.chip, styles.chipBad].join(' ')} onClick={() => setProblemsOpen((open) => !open)} aria-expanded={problemsOpen}>
            <TriangleAlert size={15} aria-hidden="true" /> {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
          </button>
        ))}
        <span className={styles.saved} aria-live="polite">{saving ? 'Saving…' : 'Saved'}</span>
      </div>
      {problemsOpen && problems.length > 0 && (
        <ul className={styles.problems}>
          {problems.slice(0, 12).map((problem, index) => (
            <li key={index}><b>{problem.group}</b> {problem.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Deck zone">
        <button type="button" role="tab" aria-selected={zone === 'cards'} className={zone === 'cards' ? styles.tabOn : styles.tab} onClick={() => onZone('cards')}>Deck {mainCount}</button>
        <button type="button" role="tab" aria-selected={zone === 'sideboard'} className={zone === 'sideboard' ? styles.tabOn : styles.tab} onClick={() => onZone('sideboard')}>Sideboard {sideCount}</button>
      </div>

      <div className={styles.list} role="tabpanel">
        {groups.length === 0 && (
          <p className={styles.note}>{zone === 'cards' ? 'Click cards on the left to add them.' : 'Cards added while this tab is open go to the sideboard.'}</p>
        )}
        {groups.map((group) => (
          <section key={group.key} className={styles.group}>
            <h3 className={styles.groupHead}>{group.label}<span>{group.count}</span></h3>
            <ul>
              {group.rows.map((row) => (
                <li
                  key={row.key}
                  className={styles.row}
                  onPointerEnter={(event) => row.card && onPreview(row.card, event.currentTarget.closest('aside')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect())}
                  onPointerLeave={() => onPreview(null)}
                >
                  <span className={styles.rowCount}>{row.entry.amount}</span>
                  <span className={styles.rowName}>{row.entry.cardName}</span>
                  {row.card && <ManaCost cost={row.card.manaCostLeftStr} size="sm" />}
                  <span className={styles.rowActions}>
                    <button type="button" aria-label={`One less ${row.entry.cardName}`} onClick={() => onChange((current) => removeCard(current, zone, row.key))}><Minus size={14} /></button>
                    <button
                      type="button"
                      aria-label={`One more ${row.entry.cardName}`}
                      onClick={() => onChange((current) => {
                        const limit = format === 'Limited' ? Infinity : copyLimit(row.card, row.entry.cardName);
                        return copiesByName(current, row.entry.cardName) >= limit ? current : addCard(current, zone, { cardName: row.entry.cardName, setCode: row.entry.setCode ?? '', cardNumber: row.entry.cardNumber ?? '' });
                      })}
                    >
                      <Plus size={14} />
                    </button>
                    <button type="button" aria-label={zone === 'cards' ? 'Move one to sideboard' : 'Move one to deck'} title={zone === 'cards' ? 'To sideboard' : 'To deck'} onClick={() => onChange((current) => moveCard(current, zone, row.key))}>
                      <ArrowLeftRight size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ManaCurve curve={curve} className={styles.curve} />

      <BasicLands deck={deck} onChange={onChange} />

      {deck.source && <SourceLine source={deck.source} className={styles.source} />}

      <footer className={styles.deckFoot}>
        <Button variant="quiet" size="sm" icon={<ChevronLeft size={16} />} onClick={onDone}>Decks</Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="print" size="sm" icon={<ClipboardPaste size={16} />}>From a list…</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} side="top" align="start" sideOffset={6} onCloseAutoFocus={(event) => event.preventDefault()}>
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => openImport(null, intoDeck('replace'))}>
                <Replace size={16} aria-hidden="true" /> Replace deck
              </DropdownMenu.Item>
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => openImport(null, intoDeck('add'))}>
                <ListPlus size={16} aria-hidden="true" /> Add to deck
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <Button
          variant="print"
          size="sm"
          icon={<ClipboardCopy size={16} />}
          onClick={() => {
            void navigator.clipboard.writeText(DeckSerializer.exportDeck(deck))
              .then(() => notify('Deck list copied', 'Paste it anywhere that reads deck lists.'))
              .catch(() => notify("Couldn't copy", 'The browser blocked the clipboard.', 'error'));
          }}
        >
          Copy list
        </Button>
        <Button variant="decision" onClick={onPlay} disabled={mainCount === 0}>Play this deck</Button>
      </footer>
    </aside>
  );
}

const BASICS: { name: string; symbol: string }[] = [
  { name: 'Plains', symbol: 'w' },
  { name: 'Island', symbol: 'u' },
  { name: 'Swamp', symbol: 'b' },
  { name: 'Mountain', symbol: 'r' },
  { name: 'Forest', symbol: 'g' },
];

/** Basic lands without searching: steppers for the five basics. */
function BasicLands({ deck, onChange }: { deck: DeckCardLists; onChange(update: (deck: DeckCardLists) => DeckCardLists): void }) {
  return (
    <div className={styles.basics} aria-label="Basic lands">
      {BASICS.map((basic) => {
        const entry = deck.cards.find((candidate) => candidate.cardName === basic.name);
        const count = deck.cards.filter((candidate) => candidate.cardName === basic.name).reduce((sum, candidate) => sum + candidate.amount, 0);
        return (
          <div key={basic.name} className={styles.basic}>
            <i className={`ms ms-cost ms-${basic.symbol}`} aria-hidden="true" />
            <button type="button" aria-label={`One less ${basic.name}`} disabled={!entry} onClick={() => entry && onChange((current) => removeCard(current, 'cards', entryKey(entry)))}><Minus size={13} /></button>
            <b aria-label={`${count} ${basic.name}`}>{count}</b>
            <button
              type="button"
              aria-label={`One more ${basic.name}`}
              onClick={() => onChange((current) => addCard(current, 'cards', entry
                ? { cardName: entry.cardName, setCode: entry.setCode ?? '', cardNumber: entry.cardNumber ?? '' }
                : { cardName: basic.name, setCode: '', cardNumber: '' }))}
            >
              <Plus size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Preview({ card, anchor, side }: { card: CardView; anchor: DOMRect; side: 'auto' | 'left' }) {
  const width = 300;
  const height = width * (88 / 63);
  const gap = 16;
  // beside the hovered card, on whichever side has room; never over the deck list on the right
  const deckEdge = window.innerWidth - 400;
  const fitsRight = side === 'auto' && anchor.right + gap + width <= deckEdge;
  const left = fitsRight ? anchor.right + gap : Math.max(gap, anchor.left - gap - width);
  const top = Math.max(12, Math.min(window.innerHeight - height - 12, anchor.top + anchor.height / 2 - height / 2));
  return (
    <div className={styles.preview} style={{ left, top, width }} aria-hidden="true">
      <CardFace card={card} size="large" />
    </div>
  );
}
