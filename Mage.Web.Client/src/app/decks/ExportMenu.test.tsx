import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { DeckCardLists } from '../../core/decks/types';
import { ExportMenu } from './ExportMenu';

const DECK: DeckCardLists = {
  name: 'Burn',
  cards: [{ amount: 4, cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' }],
  sideboard: [{ amount: 2, cardName: 'Smash to Smithereens', setCode: 'ORI', cardNumber: '163' }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  return user;
}

describe('ExportMenu', () => {
  test('copies the list in the chosen format', async () => {
    render(<ExportMenu getDeck={() => DECK} />);
    // user-event installs its own clipboard on setup: watch that one
    let user = await openMenu();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('menuitem', { name: /Arena/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Deck\n4 Lightning Bolt (M10) 146\n\nSideboard\n2 Smash to Smithereens (ORI) 163\n'));

    user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /MTGO.*plain names/ }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('4 Lightning Bolt\n\n2 Smash to Smithereens\n'));
  });

  test('downloads a .dck file named after the deck', async () => {
    const clicks: { name: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ name: this.download, href: this.href });
    });
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:deck';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<ExportMenu getDeck={async () => DECK} />);

    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /\.dck file/ }));
    await waitFor(() => expect(clicks).toEqual([{ name: 'Burn.dck', href: 'blob:deck' }]));
    expect(await blobs[0].text()).toBe('NAME:Burn\n4 [M10:146] Lightning Bolt\nSB: 2 [ORI:163] Smash to Smithereens\n');
  });

  test('a deck that fails to load explains why', async () => {
    render(<ExportMenu getDeck={async () => { throw new Error('That deck is no longer saved.'); }} />);
    const { useToasts } = await import('../stores/toasts');
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /\.txt file/ }));
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ title: "Couldn't export the deck", message: 'That deck is no longer saved.' }));
  });
});
