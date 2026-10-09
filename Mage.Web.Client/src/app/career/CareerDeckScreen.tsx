import { Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { CardView } from '../../protocol/generated/views';
import type { DeckCardInfo, DeckCardLists } from '../../core/decks/types';
import { useCardInfo } from '../decks/cardInfo';
import { entryKey } from '../decks/deckModel';
import { DeckBuilder, type BinderProps, type BuilderMode } from '../decks/DeckBuilderScreen';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { useSession } from '../stores/session';
import { CardFace } from '../ui/CardFace';
import { ensureCareerDeck, saveCareerDeck } from './careerDeck';
import { useCareerCollection, useCareerState } from './careerData';
import { careerLimit, ownedByName } from './careerModel';
import builder from '../decks/DeckBuilder.module.css';
import styles from './Career.module.css';

registerMessages(messages);

/** The Career deck in the deck builder: only owned cards, as many as owned; basic lands are free. */
export function CareerDeckScreen() {
  const t = useT();
  const navigate = useNavigate();
  const user = useSession((state) => state.userName);
  const state = useCareerState();
  const profile = state.data?.profile;
  const collection = useCareerCollection(!!profile);
  const [deck, setDeck] = useState<DeckCardLists | null>(null);

  const opened = !!profile;
  const starter = profile?.starter;
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    void ensureCareerDeck(user, starter).then((loaded) => !cancelled && setDeck(loaded));
    return () => {
      cancelled = true;
    };
  }, [user, opened, starter]);

  const owned = useMemo(() => ownedByName(collection.data ?? []), [collection.data]);
  const mode = useMemo<BuilderMode>(() => ({
    Binder: OwnedBinder,
    allowance: (name) => careerLimit(name, owned),
    save: (next) => saveCareerDeck(user, next),
    doneLabel: t('career.title'),
    onDone: () => navigate('/career'),
    onPlay: () => navigate('/career'),
  }), [owned, user, navigate, t]);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  if (!deck || collection.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  return <DeckBuilder initial={deck} mode={mode} />;
}

/** The binder: every card the Career owns, one tile per card name. */
function OwnedBinder({ counts, limitOf, onAdd, onRemove, onPreview }: BinderProps) {
  const t = useT();
  const collection = useCareerCollection(true);
  const [text, setText] = useState('');
  // one printing per name, as deck entries
  const entries = useMemo<DeckCardInfo[]>(() => {
    const seen = new Map<string, DeckCardInfo>();
    for (const card of collection.data ?? []) {
      const key = (card.name ?? '').toLowerCase();
      if (key && !seen.has(key)) seen.set(key, { cardName: card.name!, setCode: card.setCode, cardNumber: card.cardNumber, amount: 1 });
    }
    return [...seen.values()].sort((a, b) => a.cardName.localeCompare(b.cardName));
  }, [collection.data]);
  const info = useCardInfo(entries);
  const cards = useMemo<CardView[]>(() => entries.map((entry) => info.get(entryKey(entry))
    ?? { name: entry.cardName, expansionSetCode: entry.setCode ?? undefined, cardNumber: entry.cardNumber ?? undefined }), [entries, info]);
  const needle = text.trim().toLowerCase();
  const shown = useMemo(() => (needle
    ? cards.filter((card) => (card.name ?? '').toLowerCase().includes(needle) || (card.cardTypes ?? []).some((type) => type.toLowerCase().includes(needle)) || (card.subTypes ?? []).some((type) => type.toLowerCase().includes(needle)))
    : cards), [cards, needle]);

  return (
    <section className={builder.collection} aria-label={t('career.nav.collection')}>
      <div className={builder.filters}>
        <label className={builder.search}>
          <Search size={18} aria-hidden="true" />
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder={t('career.collection.search')} aria-label={t('career.collection.search')} />
          {text && <button type="button" className={builder.clearText} onClick={() => setText('')} aria-label={t('ui.close')}><X size={16} /></button>}
        </label>
      </div>
      <div className={builder.results}>
        {collection.isPending ? (
          <p className={builder.note}>{t('career.loading')}</p>
        ) : shown.length === 0 ? (
          <p className={builder.note}>{t('career.collection.empty')}</p>
        ) : (
          <div className={builder.grid}>
            {shown.map((card) => (
              <BinderCard
                key={(card.name ?? '').toLowerCase()}
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
      </div>
    </section>
  );
}

const BinderCard = memo(function BinderCard({ card, count, limit, onAdd, onRemove, onPreview }: {
  card: CardView;
  count: number;
  limit: number;
  onAdd(card: CardView): void;
  onRemove(card: CardView): void;
  onPreview(card: CardView | null, anchor?: DOMRect): void;
}) {
  return (
    <button
      type="button"
      className={[builder.tile, count >= limit ? builder.tileFull : ''].join(' ')}
      onClick={() => onAdd(card)}
      onContextMenu={(event) => {
        event.preventDefault();
        if (count > 0) onRemove(card);
      }}
      onPointerEnter={(event) => onPreview(card, event.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => onPreview(null)}
      aria-label={`${card.name}, ${count} / ${limit}`}
    >
      <CardFace card={card} size="normal" />
      <span className={builder.copies} aria-hidden="true">
        {Number.isFinite(limit) && limit <= 4
          ? Array.from({ length: limit }, (_, i) => <i key={i} className={i < count ? builder.copyOn : builder.copyOff} />)
          : <b>×{count}</b>}
      </span>
    </button>
  );
});
