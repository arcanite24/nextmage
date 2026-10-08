import { ClipboardPaste, Download, PencilRuler, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { siteById } from '../../core/deckImport/sites';
import { SourceLine } from '../decks/import/SourceLine';
import { UpdateDialog } from '../decks/import/UpdateDialog';
import { useImportDrop, useImportPaste } from '../decks/import/useImportShortcuts';
import { useDegradedSites } from '../decks/import/useImportFlow';
import { PASTE_KEYS } from '../decks/import/text';
import { deckStorage } from '../../core/decks/DeckStorageService';
import { applyUpdate } from '../../core/deckImport/diff';
import { SLEEVE_COLORS, rosterOf, sleeveFor, useDecks, type RosterDeck } from '../stores/decks';
import { openImport, useImportSheet } from '../stores/importSheet';
import { Button } from '../ui/Button';
import { DeckBox } from '../ui/DeckBox';
import { Dialog } from '../ui/Dialog';
import { Zone } from '../ui/Zone';
import styles from './DecksScreen.module.css';

/** Your deck shelf: import, sleeve, update and remove decks. */
export function DecksScreen() {
  const decks = useDecks();
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const [removing, setRemoving] = useState<RosterDeck | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const selected = roster.find((deck) => deck.id === decks.selectedId) ?? null;
  const arrivedId = useImportSheet((state) => state.arrivedId);
  const navigate = useNavigate();
  const degraded = useDegradedSites();
  const { dragging, dropProps } = useImportDrop();
  useImportPaste();

  useEffect(() => {
    if (!decks.loaded) void decks.refresh();
  }, [decks]);

  const source = selected?.source;
  const sourceSite = siteById(source?.site);
  const updatable = !!sourceSite && sourceSite.tier === 'direct' && !degraded.has(sourceSite.id);

  /** A site that blocks us: paste a fresh copy of the list, which replaces this deck's cards. */
  function pasteNewList(deck: RosterDeck) {
    if (!deck.source) return;
    openImport({ kind: 'text', text: deck.source.url }, {
      kind: 'into',
      mode: 'replace',
      deckName: deck.name,
      apply: (fresh) => {
        void (async () => {
          const saved = await deckStorage.loadDeck(deck.id);
          if (!saved) return;
          await useDecks.getState().saveUpdated({ ...applyUpdate(saved, fresh), id: deck.id });
        })();
      },
    });
  }

  return (
    <div className={styles.page}>
      <Zone
        label="Your decks"
        className={[styles.shelf, dragging ? styles.dropping : ''].join(' ')}
        {...dropProps}
        aside={
          <>
            <Button size="sm" icon={<Download size={16} />} onClick={() => openImport()}>Import</Button>
            <Button size="sm" icon={<PencilRuler size={16} />} onClick={() => navigate('/decks/new')}>Build a deck</Button>
          </>
        }
      >
        {dragging && (
          <div className={styles.dropHint} aria-hidden="true">
            <ClipboardPaste size={22} />
            <span>Drop a deck file, link or list</span>
          </div>
        )}
        <div className={styles.grid} role="list">
          {decks.loaded && decks.saved.length === 0 && (
            <p role="listitem" className={styles.emptyShelf}>
              Bring a deck you already have: press <kbd>{PASTE_KEYS}</kbd> anywhere here with a link from Archidekt, Moxfield or another deck site, or a list.
            </p>
          )}
          {roster.map((deck) => (
            <div key={deck.id} role="listitem" className={[styles.cell, deck.id === arrivedId ? styles.arrived : ''].join(' ')}>
              <div onDoubleClick={() => navigate(`/decks/${encodeURIComponent(deck.id)}`)}>
                <DeckBox deck={deck} sleeve={sleeveFor(decks.sleeves, deck)} selected={deck.id === decks.selectedId} onSelect={() => decks.select(deck.id)} />
              </div>
            </div>
          ))}
        </div>
      </Zone>

      <Zone tone="filled" className={styles.detail}>
        {selected ? (
          <div className={styles.detailBody}>
            <h2 className={styles.detailName}>{selected.name}</h2>
            <p className={styles.detailNote}>{selected.note}</p>
            {source && sourceSite && (
              <div className={styles.source}>
                <SourceLine source={source} />
                {updatable ? (
                  <Button icon={<RefreshCw size={16} />} onClick={() => setUpdating(selected.id)}>Update from {sourceSite.name}</Button>
                ) : (
                  <Button icon={<ClipboardPaste size={16} />} onClick={() => pasteNewList(selected)}>Paste a new list</Button>
                )}
              </div>
            )}
            <div>
              <h3 className={styles.subLabel}>Sleeves</h3>
              <div className={styles.sleeves} role="radiogroup" aria-label="Sleeve color">
                {SLEEVE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={sleeveFor(decks.sleeves, selected) === color}
                    aria-label={`Sleeve ${color}`}
                    className={styles.swatch}
                    style={{ background: color }}
                    onClick={() => decks.setSleeve(selected.id, color)}
                  />
                ))}
              </div>
            </div>
            <Button variant="print" icon={<PencilRuler size={16} />} onClick={() => navigate(`/decks/${encodeURIComponent(selected.id)}`)}>
              {selected.starter ? 'Copy and edit' : 'Edit deck'}
            </Button>
            {!selected.starter && (
              <Button variant="danger" size="sm" className={styles.remove} icon={<Trash2 size={16} />} onClick={() => setRemoving(selected)}>Remove deck</Button>
            )}
          </div>
        ) : (
          <p className={styles.detailNote}>Pick a deck to see it here.</p>
        )}
      </Zone>

      <UpdateDialog deckId={updating} onClose={() => setUpdating(null)} />

      <Dialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove deck?"
        width="sm"
        description={removing ? `“${removing.name}” will be deleted from this browser.` : undefined}
        footer={
          <>
            <Button variant="quiet" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (removing) await decks.remove(removing.id);
                setRemoving(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </div>
  );
}
