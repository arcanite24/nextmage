import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CardCriteria, CardType, CardView, Rarity } from '../../protocol/generated/views';
import { api } from '../connection';
import { CardFace } from '../ui/CardFace';
import { useCardInfoStore } from './cardInfo';
import styles from './DeckBuilder.module.css';

interface CollectionFilters {
  text: string;
  /** search rules text and types too, not just names */
  anyText: boolean;
  colors: string[];
  /** 0-6 exact, 7 means 7 or more */
  manaValue: number | null;
  type: CardType | '';
  rarity: Rarity | '';
  /** one set's code, or '' for every set */
  set: string;
}

const EMPTY_FILTERS: CollectionFilters = { text: '', anyText: false, colors: [], manaValue: null, type: '', rarity: '', set: '' };

const PAGE = 60;

const COLORS: { key: string; symbol: string; label: string }[] = [
  { key: 'white', symbol: 'w', label: 'White' },
  { key: 'blue', symbol: 'u', label: 'Blue' },
  { key: 'black', symbol: 'b', label: 'Black' },
  { key: 'red', symbol: 'r', label: 'Red' },
  { key: 'green', symbol: 'g', label: 'Green' },
  { key: 'colorless', symbol: 'c', label: 'Colorless' },
];

const TYPES: { value: CardType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'CREATURE', label: 'Creatures' },
  { value: 'INSTANT', label: 'Instants' },
  { value: 'SORCERY', label: 'Sorceries' },
  { value: 'ARTIFACT', label: 'Artifacts' },
  { value: 'ENCHANTMENT', label: 'Enchantments' },
  { value: 'PLANESWALKER', label: 'Planeswalkers' },
  { value: 'LAND', label: 'Lands' },
  { value: 'BATTLE', label: 'Battles' },
];

const RARITIES: { value: Rarity | ''; label: string }[] = [
  { value: '', label: 'Any rarity' },
  { value: 'COMMON', label: 'Common' },
  { value: 'UNCOMMON', label: 'Uncommon' },
  { value: 'RARE', label: 'Rare' },
  { value: 'MYTHIC', label: 'Mythic' },
];

/** Sets most players don't build with: joke sets, unofficial sets, and Arena-only digital cards. */
const SIDELINED_SET_TYPES = new Set(['JOKE_SET', 'CUSTOM_SET', 'MAGIC_ARENA']);

function toCriteria(filters: CollectionFilters, format: string, start: number, ignoreSets: string[]): CardCriteria {
  const text = filters.text.trim();
  return {
    ignoreSetCodes: ignoreSets,
    nameContains: text && !filters.anyText ? text : undefined,
    searchText: text && filters.anyText ? text : undefined,
    searchNames: true,
    searchTypes: true,
    searchRules: true,
    webColors: filters.colors,
    colorMatch: 'any',
    types: filters.type ? [filters.type] : [],
    setCodes: filters.set ? [filters.set] : undefined,
    rarities: filters.rarity ? [filters.rarity] : [],
    manaValue: filters.manaValue ?? undefined,
    manaValueOperator: filters.manaValue === 7 ? 'gte' : filters.manaValue !== null ? 'eq' : undefined,
    format: format || undefined,
    uniqueNames: true,
    sortBy: 'name',
    start,
    count: PAGE,
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Every card the format allows, filterable; click a card to add it. */
export function Collection({ format, identity, counts, limitOf, onAdd, onRemove, onPreview }: {
  format: string;
  /** a commander deck's color identity (WUBRG letters): only cards it allows are shown; null shows every color */
  identity: string[] | null;
  /** copies already in the deck, by card name */
  counts: ReadonlyMap<string, number>;
  limitOf(card: CardView): number;
  onAdd(card: CardView): void;
  onRemove(card: CardView): void;
  onPreview(card: CardView | null, anchor?: DOMRect): void;
}) {
  const [filters, setFilters] = useState<CollectionFilters>(EMPTY_FILTERS);
  const [allSets, setAllSets] = useState(false);
  // a commander deck shows what its commander allows, unless the player asks for everything
  const [anyIdentity, setAnyIdentity] = useState(false);
  const colorIdentity = identity && !anyIdentity ? identity.join('') : null;
  const query = useDebounced(filters, 250);
  const remember = useCardInfoStore((state) => state.remember);
  const sets = useQuery({ queryKey: ['expansionSets'], queryFn: () => api.getExpansionSets(), staleTime: Infinity });
  const ignoreSets = useMemo(
    () => (allSets ? [] : (sets.data ?? []).filter((set) => SIDELINED_SET_TYPES.has(set.type ?? '')).map((set) => set.setCode!).filter(Boolean)),
    [allSets, sets.data],
  );
  const results = useInfiniteQuery({
    queryKey: ['collection', query, format, ignoreSets, colorIdentity],
    queryFn: ({ pageParam }) => api.searchCards(toCriteria(query, format, pageParam, ignoreSets), colorIdentity === null ? null : { colorIdentity }),
    // wait for the set list so the first page already leaves the sidelined sets out
    enabled: allSets || !sets.isPending,
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length * PAGE),
    staleTime: 5 * 60_000,
  });
  const cards = useMemo(() => (results.data?.pages ?? []).flat().filter(Boolean), [results.data]);
  useEffect(() => remember(cards), [cards, remember]);

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = results;
  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver((items) => {
      if (items.some((item) => item.isIntersecting) && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '600px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const set = (patch: Partial<CollectionFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const filtered = filters.colors.length > 0 || filters.manaValue !== null || filters.type || filters.rarity || filters.text || filters.set;
  // newest sets first; the sidelined kinds only when they are shown
  const setOptions = useMemo(
    () => [...(sets.data ?? [])]
      .filter((item) => item.setCode && (allSets || !SIDELINED_SET_TYPES.has(item.type ?? '')))
      .sort((a, b) => (b.releaseDate ?? 0) - (a.releaseDate ?? 0)),
    [sets.data, allSets],
  );

  return (
    <section className={styles.collection} aria-label="Collection">
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            value={filters.text}
            onChange={(event) => set({ text: event.target.value })}
            placeholder={filters.anyText ? 'Name, type or rules text' : 'Card name'}
            aria-label="Search cards"
          />
          {filters.text && (
            <button type="button" className={styles.clearText} onClick={() => set({ text: '' })} aria-label="Clear search"><X size={16} /></button>
          )}
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={filters.anyText} onChange={(event) => set({ anyText: event.target.checked })} />
          Rules text
        </label>
        {identity && (
          <label className={styles.toggle} title="Only cards your commander's color identity allows">
            <input type="checkbox" checked={!anyIdentity} onChange={(event) => setAnyIdentity(!event.target.checked)} />
            Commander&rsquo;s colors
            {identity.length === 0
              ? <i className="ms ms-cost ms-c" aria-label="colorless" />
              : identity.map((letter) => <i key={letter} className={`ms ms-cost ms-${letter.toLowerCase()}`} aria-hidden="true" />)}
          </label>
        )}
        <label className={styles.toggle} title="Joke sets, unofficial sets and Arena-only cards">
          <input type="checkbox" checked={allSets} onChange={(event) => setAllSets(event.target.checked)} />
          Joke &amp; digital sets
        </label>
        <div className={styles.pips} role="group" aria-label="Colors">
          {COLORS.map((color) => {
            const on = filters.colors.includes(color.key);
            return (
              <button
                key={color.key}
                type="button"
                className={[styles.pip, on ? styles.pipOn : ''].join(' ')}
                aria-pressed={on}
                aria-label={color.label}
                title={color.label}
                onClick={() => set({ colors: on ? filters.colors.filter((key) => key !== color.key) : [...filters.colors, color.key] })}
              >
                <i className={`ms ms-cost ms-${color.symbol}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <div className={styles.costs} role="group" aria-label="Mana value">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((value) => {
            const on = filters.manaValue === value;
            return (
              <button
                key={value}
                type="button"
                className={[styles.cost, on ? styles.costOn : ''].join(' ')}
                aria-pressed={on}
                aria-label={value === 7 ? 'Mana value 7 or more' : `Mana value ${value}`}
                onClick={() => set({ manaValue: on ? null : value })}
              >
                {value === 7 ? '7+' : value}
              </button>
            );
          })}
        </div>
        <select className={styles.select} value={filters.type} onChange={(event) => set({ type: event.target.value as CardType | '' })} aria-label="Card type">
          {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <select className={styles.select} value={filters.rarity} onChange={(event) => set({ rarity: event.target.value as Rarity | '' })} aria-label="Rarity">
          {RARITIES.map((rarity) => <option key={rarity.value} value={rarity.value}>{rarity.label}</option>)}
        </select>
        <select className={[styles.select, styles.setSelect].join(' ')} value={filters.set} onChange={(event) => set({ set: event.target.value })} aria-label="Set">
          <option value="">All sets</option>
          {setOptions.map((item) => <option key={item.setCode} value={item.setCode}>{item.name} ({item.setCode})</option>)}
        </select>
        {filtered && <button type="button" className={styles.reset} onClick={() => setFilters(EMPTY_FILTERS)}>Reset</button>}
      </div>

      <div className={styles.results}>
        {results.isPending ? (
          <p className={styles.note}>Opening the binder…</p>
        ) : results.isError ? (
          <p className={styles.note}>The card search failed. {results.error instanceof Error ? results.error.message : ''}</p>
        ) : cards.length === 0 ? (
          <p className={styles.note}>No cards match. Loosen a filter or check the spelling.</p>
        ) : (
          <div className={styles.grid}>
            {cards.map((card) => (
              <CollectionCard
                key={`${card.expansionSetCode}:${card.cardNumber}`}
                card={card}
                count={counts.get((card.name ?? '').toLowerCase()) ?? 0}
                limit={limitOf(card)}
                onAdd={onAdd}
                onRemove={onRemove}
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
        <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
        {isFetchingNextPage && <p className={styles.note}>More cards…</p>}
      </div>
    </section>
  );
}

const CollectionCard = memo(function CollectionCard({ card, count, limit, onAdd, onRemove, onPreview }: {
  card: CardView;
  count: number;
  limit: number;
  onAdd(card: CardView): void;
  onRemove(card: CardView): void;
  onPreview(card: CardView | null, anchor?: DOMRect): void;
}) {
  const full = count >= limit;
  return (
    <button
      type="button"
      className={[styles.tile, full ? styles.tileFull : ''].join(' ')}
      onClick={() => onAdd(card)}
      onContextMenu={(event) => {
        event.preventDefault();
        if (count > 0) onRemove(card);
      }}
      onPointerEnter={(event) => onPreview(card, event.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => onPreview(null)}
      aria-label={`${card.name}${count > 0 ? `, ${count} in deck` : ''}. Click to add, right-click to remove.`}
    >
      <CardFace card={card} size="normal" />
      {count > 0 && (
        <span className={styles.copies} aria-hidden="true">
          {Number.isFinite(limit) && limit <= 4
            ? Array.from({ length: limit }, (_, i) => <i key={i} className={i < count ? styles.copyOn : styles.copyOff} />)
            : <b>×{count}</b>}
        </span>
      )}
    </button>
  );
});
