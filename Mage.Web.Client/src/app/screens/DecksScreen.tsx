import { FileUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SLEEVE_COLORS, rosterOf, sleeveFor, useDecks, type RosterDeck } from '../stores/decks';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { DeckBox } from '../ui/DeckBox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Zone } from '../ui/Zone';
import styles from './DecksScreen.module.css';

/** Your deck shelf: import, sleeve and remove decks. */
export function DecksScreen() {
  const decks = useDecks();
  const roster = useMemo(() => rosterOf(decks), [decks]);
  const [importOpen, setImportOpen] = useState(false);
  const [removing, setRemoving] = useState<RosterDeck | null>(null);
  const selected = roster.find((deck) => deck.id === decks.selectedId) ?? null;
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!decks.loaded) void decks.refresh();
  }, [decks]);

  async function importFile(file: File) {
    try {
      await decks.importText(await file.text(), file.name.replace(/\.[^.]+$/, ''));
      notify('Deck imported', file.name);
    } catch (error) {
      notify(`Couldn't import ${file.name}`, error instanceof Error ? error.message : String(error), 'error');
    }
  }

  return (
    <div className={styles.page}>
      <Zone
        label="Your decks"
        className={styles.shelf}
        aside={
          <>
            <Button size="sm" icon={<FileUp size={16} />} onClick={() => fileInput.current?.click()}>Import file</Button>
            <Button size="sm" variant="decision" icon={<Plus size={16} />} onClick={() => setImportOpen(true)}>Paste a list</Button>
            <input
              ref={fileInput}
              type="file"
              accept=".dck,.dec,.txt,.mwdeck,.cod,.o8d,.json,.draft"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = '';
              }}
            />
          </>
        }
      >
        <div className={styles.grid} role="list">
          {roster.map((deck) => (
            <div key={deck.id} role="listitem" className={styles.cell}>
              <DeckBox deck={deck} sleeve={sleeveFor(decks.sleeves, deck)} selected={deck.id === decks.selectedId} onSelect={() => decks.select(deck.id)} />
            </div>
          ))}
        </div>
      </Zone>

      <Zone label="Selected deck" tone="filled" className={styles.detail}>
        {selected ? (
          <div className={styles.detailBody}>
            <h2 className={styles.detailName}>{selected.name}</h2>
            <p className={styles.detailNote}>{selected.note}</p>
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
            <p className={styles.soon}>Card-by-card editing arrives with the new deck builder.</p>
            {!selected.starter && (
              <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => setRemoving(selected)}>Remove deck</Button>
            )}
          </div>
        ) : (
          <p className={styles.detailNote}>Pick a deck to see it here.</p>
        )}
      </Zone>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

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

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const importText = useDecks((state) => state.importText);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await importText(text, name.trim() || undefined);
      setText('');
      setName('');
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
      title="Paste a deck list"
      description="One card per line, like “4 Lightning Bolt”. Arena, MTGO and XMage formats work. Put “Sideboard” on its own line before the sideboard."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="decision" busy={busy} disabled={!text.trim()} onClick={() => void submit()}>Add deck</Button>
        </>
      }
    >
      <div className={styles.importForm}>
        <Field label="Deck name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" />
        <label className={styles.textareaLabel} htmlFor="deck-list">Card list</label>
        <textarea
          id="deck-list"
          className={styles.textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'4 Lightning Bolt\n4 Monastery Swiftspear\n20 Mountain\n\nSideboard\n2 Smash to Smithereens'}
          spellCheck={false}
        />
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

