import React from 'react';
import { cardImageService, wsService } from '../../services';
import type { CardSearchCriteria, SearchCardView } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { CardView } from '../deck/CardView';
import { CardPreviewModal } from '../game/CardPreviewModal';
import './CardViewerActivity.css';

type CardViewerKind = 'cards' | 'tokens' | 'emblems' | 'planes';
type CardViewerLayout = '3x3' | '4x4';

const KIND_OPTIONS: Array<{ value: CardViewerKind; label: string }> = [
  { value: 'cards', label: 'Cards' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'emblems', label: 'Emblems' },
  { value: 'planes', label: 'Planes' },
];

const LAYOUT_OPTIONS: Array<{ value: CardViewerLayout; label: string; pageSize: number }> = [
  { value: '3x3', label: '3 x 3', pageSize: 9 },
  { value: '4x4', label: '4 x 4', pageSize: 16 },
];

const PLANE_SET_CODES = new Set(['HOP', 'OPCA', 'PCA', 'PC2']);

function cardText(card: SearchCardView): string {
  return [
    card.name,
    card.displayName,
    card.cardTypes?.join(' '),
    card.subTypes?.join(' '),
    card.superTypes?.join(' '),
    card.expansionSetCode,
    card.cardNumber,
  ].filter(Boolean).join(' ').toLowerCase();
}

function isPlane(card: SearchCardView): boolean {
  return PLANE_SET_CODES.has(String(card.expansionSetCode || '').toUpperCase())
    || cardText(card).includes('plane ');
}

function isEmblem(card: SearchCardView): boolean {
  return cardText(card).includes('emblem');
}

function isToken(card: SearchCardView): boolean {
  return !isEmblem(card) && cardText(card).includes('token');
}

function matchesKind(card: SearchCardView, kind: CardViewerKind): boolean {
  switch (kind) {
    case 'tokens':
      return isToken(card);
    case 'emblems':
      return isEmblem(card);
    case 'planes':
      return isPlane(card);
    case 'cards':
    default:
      return !isToken(card) && !isEmblem(card) && !isPlane(card);
  }
}

function criteriaFor(kind: CardViewerKind, format: string, query: string): CardSearchCriteria {
  const trimmedQuery = query.trim();
  const criteria: CardSearchCriteria = {
    count: 320,
    sortBy: 'name',
  };

  if (format) criteria.format = format;
  if (trimmedQuery) {
    criteria.searchText = trimmedQuery;
    criteria.searchNames = true;
    criteria.searchTypes = true;
    criteria.searchRules = true;
    criteria.uniqueNames = false;
  }

  if (kind !== 'cards') {
    criteria.type = kind === 'tokens' ? 'Token' : kind === 'emblems' ? 'Emblem' : 'Plane';
  }

  return criteria;
}

function formatCardMeta(card: SearchCardView): string {
  return [
    card.expansionSetCode,
    card.cardNumber,
    String(card.rarity || '').replace(/_/g, ' ').toLowerCase(),
  ].filter(Boolean).join(' · ');
}

export function CardViewerActivity() {
  const preferredImageLanguage = useSettingsStore(state => state.settings.preferredImageLanguage);
  const preloadVisibleCardImages = useSettingsStore(state => state.settings.preloadVisibleCardImages);
  const [deckTypes, setDeckTypes] = React.useState<string[]>([]);
  const [format, setFormat] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<CardViewerKind>('cards');
  const [layout, setLayout] = React.useState<CardViewerLayout>('3x3');
  const [page, setPage] = React.useState(0);
  const [cards, setCards] = React.useState<SearchCardView[]>([]);
  const [selectedCard, setSelectedCard] = React.useState<SearchCardView | null>(null);
  const [modalCard, setModalCard] = React.useState<SearchCardView | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [missingCount, setMissingCount] = React.useState(0);
  const [preloadProgress, setPreloadProgress] = React.useState({ active: false, loaded: 0, total: 0 });
  const searchRequestRef = React.useRef(0);
  const preloadRunRef = React.useRef(0);
  const layoutConfig = LAYOUT_OPTIONS.find(option => option.value === layout) ?? LAYOUT_OPTIONS[0];
  const pageSize = layoutConfig.pageSize;
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const visibleCards = React.useMemo(
    () => cards.slice(page * pageSize, page * pageSize + pageSize),
    [cards, page, pageSize],
  );
  const selected = selectedCard ?? visibleCards[0] ?? null;

  React.useEffect(() => {
    wsService.getDeckTypes()
      .then(types => setDeckTypes(types.filter(Boolean)))
      .catch(() => setDeckTypes([]));
  }, []);

  React.useEffect(() => {
    setPage(0);
  }, [format, kind, layout, query]);

  React.useEffect(() => {
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const handle = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError('');
      wsService.searchCards(criteriaFor(kind, format, query))
        .then(results => {
          if (searchRequestRef.current !== requestId) return;
          const nextCards = results.filter(card => matchesKind(card, kind));
          setCards(nextCards);
          setSelectedCard(nextCards[0] ?? null);
          setMissingCount(cardImageService.getMissingImageDiagnostics().length);
        })
        .catch((error) => {
          if (searchRequestRef.current !== requestId) return;
          setCards([]);
          setSelectedCard(null);
          setSearchError(error instanceof Error ? error.message : 'Card search failed.');
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) {
            setIsSearching(false);
          }
        });
    }, 220);

    return () => window.clearTimeout(handle);
  }, [format, kind, query]);

  React.useEffect(() => {
    if (!preloadVisibleCardImages || visibleCards.length === 0) return;
    cardImageService
      .preloadMany(visibleCards, 'normal')
      .then(() => setMissingCount(cardImageService.getMissingImageDiagnostics().length))
      .catch(() => setMissingCount(cardImageService.getMissingImageDiagnostics().length));
  }, [preloadVisibleCardImages, visibleCards]);

  const startPreload = React.useCallback(async () => {
    const runId = preloadRunRef.current + 1;
    preloadRunRef.current = runId;
    setPreloadProgress({ active: true, loaded: 0, total: visibleCards.length });

    for (let index = 0; index < visibleCards.length; index += 1) {
      if (preloadRunRef.current !== runId) return;
      await cardImageService.preload(visibleCards[index], 'large');
      if (preloadRunRef.current !== runId) return;
      setPreloadProgress({ active: true, loaded: index + 1, total: visibleCards.length });
    }

    setMissingCount(cardImageService.getMissingImageDiagnostics().length);
    setPreloadProgress({ active: false, loaded: visibleCards.length, total: visibleCards.length });
  }, [visibleCards]);

  const cancelPreload = React.useCallback(() => {
    preloadRunRef.current += 1;
    setPreloadProgress(progress => ({ ...progress, active: false }));
  }, []);

  return (
    <section className="card-viewer-activity" data-testid="card-viewer-activity" data-card-kind={kind} data-layout={layout}>
      <div className="card-viewer-toolbar">
        <label>
          <span>Format</span>
          <select value={format} onChange={event => setFormat(event.target.value)} data-testid="card-viewer-format-select">
            <option value="">All formats</option>
            {deckTypes.map(deckType => (
              <option key={deckType} value={deckType}>{deckType}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Name, type, or rules"
            data-testid="card-viewer-search-input"
          />
        </label>
        <div className="card-viewer-segment" role="group" aria-label="Card source">
          {KIND_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={kind === option.value ? 'is-active' : ''}
              onClick={() => setKind(option.value)}
              data-testid={`card-viewer-kind-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="card-viewer-segment" role="group" aria-label="Card layout">
          {LAYOUT_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={layout === option.value ? 'is-active' : ''}
              onClick={() => setLayout(option.value)}
              data-testid={`card-viewer-layout-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-viewer-body">
        <div className="card-viewer-results">
          <div className="card-viewer-results-header">
            <strong data-testid="card-viewer-result-count">{isSearching ? 'Searching...' : `${cards.length} result${cards.length === 1 ? '' : 's'}`}</strong>
            <div className="card-viewer-page-controls">
              <button type="button" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0}>
                Previous
              </button>
              <span data-testid="card-viewer-page-label">Page {page + 1} / {pageCount}</span>
              <button type="button" onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>
                Next
              </button>
            </div>
          </div>

          {searchError ? (
            <p className="card-viewer-empty" role="alert">{searchError}</p>
          ) : visibleCards.length === 0 && !isSearching ? (
            <p className="card-viewer-empty">No cards match this search.</p>
          ) : (
            <div className="card-viewer-grid" style={{ '--card-viewer-columns': layout === '3x3' ? 3 : 4 } as React.CSSProperties} data-testid="card-viewer-grid">
              {visibleCards.map(card => (
                <button
                  key={`${card.id}-${card.expansionSetCode}-${card.cardNumber}`}
                  type="button"
                  className="card-viewer-card"
                  onClick={() => setSelectedCard(card)}
                  onDoubleClick={() => setModalCard(card)}
                  data-selected={selected?.id === card.id ? 'true' : 'false'}
                  data-testid="card-viewer-card"
                  data-card-name={card.name}
                >
                  <CardView card={card} size="normal" />
                  <span>{card.displayName || card.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="card-viewer-preview" data-testid="card-viewer-preview">
          {selected ? (
            <>
              <CardView card={selected} size="large" />
              <div>
                <h3>{selected.displayName || selected.name}</h3>
                <p>{formatCardMeta(selected)}</p>
                <p>{selected.cardTypes?.join(', ') || 'Card'}</p>
              </div>
              <button type="button" className="activity-deck-editor-button" onClick={() => setModalCard(selected)}>
                Big Preview
              </button>
            </>
          ) : (
            <p className="card-viewer-empty">Select a card to preview it.</p>
          )}
        </aside>
      </div>

      <div className="card-viewer-resource-panel" data-testid="card-viewer-resource-panel">
        <div>
          <span>Image source</span>
          <strong>Scryfall via browser cache</strong>
        </div>
        <div>
          <span>Language</span>
          <strong>{preferredImageLanguage}</strong>
        </div>
        <div>
          <span>Missing images</span>
          <strong data-testid="card-viewer-missing-count">{missingCount}</strong>
        </div>
        <div>
          <span>Preload</span>
          <strong data-testid="card-viewer-preload-progress">
            {preloadProgress.active ? `${preloadProgress.loaded}/${preloadProgress.total}` : `${visibleCards.length} visible`}
          </strong>
        </div>
        {preloadProgress.active ? (
          <button type="button" className="activity-deck-editor-button" onClick={cancelPreload} data-testid="card-viewer-cancel-preload">
            Cancel
          </button>
        ) : (
          <button type="button" className="activity-deck-editor-button" onClick={() => void startPreload()} disabled={visibleCards.length === 0} data-testid="card-viewer-preload-page">
            Preload Page
          </button>
        )}
      </div>

      {modalCard && (
        <CardPreviewModal card={modalCard as any} onClose={() => setModalCard(null)} />
      )}
    </section>
  );
}
