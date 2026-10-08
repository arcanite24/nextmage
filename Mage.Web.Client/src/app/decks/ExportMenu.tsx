import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ClipboardCopy, FileDown, Upload } from 'lucide-react';
import type { DeckCardLists } from '../../core/decks/types';
import { DECK_EXPORT_FORMATS, deckFileName, exportDeckAs, type DeckExportFormat } from '../../core/decks/exportFormats';
import { notify } from '../stores/toasts';
import { Button, type ButtonProps } from '../ui/Button';
import { downloadText } from '../ui/download';
import styles from './ExportMenu.module.css';

const COPY_FORMATS: { format: DeckExportFormat; hint: string }[] = [
  { format: 'arena', hint: 'deck sites' },
  { format: 'mtgo', hint: 'plain names' },
  { format: 'dck', hint: 'desktop client' },
];

const DOWNLOADS: { format: DeckExportFormat; label: string }[] = [
  { format: 'dck', label: '.dck file' },
  { format: 'mtgo', label: '.txt file' },
];

export interface ExportMenuProps {
  /** the deck to export; may load it first */
  getDeck(): DeckCardLists | Promise<DeckCardLists>;
  size?: ButtonProps['size'];
  side?: 'top' | 'bottom';
  disabled?: boolean;
}

/** Export: copy the list in the format the destination reads, or download it as a file. */
export function ExportMenu({ getDeck, size = 'sm', side = 'bottom', disabled }: ExportMenuProps) {
  async function copy(format: DeckExportFormat) {
    try {
      const deck = await getDeck();
      await navigator.clipboard.writeText(exportDeckAs(deck, format));
      notify('Deck list copied', `${DECK_EXPORT_FORMATS[format].label} format. Paste it anywhere that reads deck lists.`);
    } catch (error) {
      notify("Couldn't copy", error instanceof Error && !/clipboard|permission|denied/i.test(error.message) ? error.message : 'The browser blocked the clipboard.', 'error');
    }
  }

  async function download(format: DeckExportFormat) {
    try {
      const deck = await getDeck();
      downloadText(deckFileName(deck, format), exportDeckAs(deck, format), DECK_EXPORT_FORMATS[format].mime);
    } catch (error) {
      notify("Couldn't export the deck", error instanceof Error ? error.message : String(error), 'error');
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <Button variant="print" size={size} icon={<Upload size={16} />}>Export</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} side={side} align="start" sideOffset={6}>
          <DropdownMenu.Label className={styles.label}>Copy list</DropdownMenu.Label>
          {COPY_FORMATS.map(({ format, hint }) => (
            <DropdownMenu.Item key={format} className={styles.item} onSelect={() => void copy(format)}>
              <ClipboardCopy size={16} aria-hidden="true" /> {DECK_EXPORT_FORMATS[format].label} <small>{hint}</small>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Label className={styles.label}>Download</DropdownMenu.Label>
          {DOWNLOADS.map(({ format, label }) => (
            <DropdownMenu.Item key={format} className={styles.item} onSelect={() => void download(format)}>
              <FileDown size={16} aria-hidden="true" /> {label} <small>{DECK_EXPORT_FORMATS[format].label}</small>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
