import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';

async function gotoVisual(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

test.describe('deck editor browser workflows', () => {
  test('saves, saves as a copy, starts new, and loads a saved deck', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByRole('heading', { name: 'P0 Visual Smoke' })).toBeVisible();

    await page.getByTestId('deck-description-input').fill('Browser round trip notes');
    await page.getByTestId('deck-editor-save-button').click();
    await expect(page.getByRole('status')).toContainText('Saved P0 Visual Smoke.');

    await expect.poll(async () => readStoredDeck(page, 'P0 Visual Smoke')).toMatchObject({
      description: 'Browser round trip notes',
    });

    await page.getByTestId('deck-editor-save-as-button').click();
    const saveAsInput = page.getByTestId('deck-editor-save-as-name-input');
    await expect(saveAsInput).toBeFocused();
    await expect(saveAsInput).toHaveValue('P0 Visual Smoke Copy');
    await expect.poll(async () => saveAsInput.evaluate(input => {
      const element = input as HTMLInputElement;
      return {
        start: element.selectionStart,
        end: element.selectionEnd,
        valueLength: element.value.length,
      };
    })).toEqual({
      start: 0,
      end: 'P0 Visual Smoke Copy'.length,
      valueLength: 'P0 Visual Smoke Copy'.length,
    });
    await page.keyboard.type('Browser Round Trip Copy');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Saved copy as Browser Round Trip Copy.');

    await expect.poll(async () => readStoredDecksMeta(page)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'P0 Visual Smoke' }),
      expect.objectContaining({ name: 'Browser Round Trip Copy' }),
    ]));
    const savedMeta = await readStoredDecksMeta(page);
    const originalDeck = savedMeta.find(deck => deck.name === 'P0 Visual Smoke');
    const copiedDeck = savedMeta.find(deck => deck.name === 'Browser Round Trip Copy');
    expect(originalDeck?.id).toBeTruthy();
    expect(copiedDeck?.id).toBeTruthy();
    expect(copiedDeck?.id).not.toBe(originalDeck?.id);

    await page.getByTestId('deck-editor-new-button').click();
    await expect(page.getByRole('heading', { name: /New Deck/ })).toBeVisible();

    await page.getByTestId('deck-editor-load-button').click();
    await expect(page.getByTestId('deck-editor-load-dialog')).toBeVisible();
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Discard unsaved changes');
      await dialog.accept();
    });
    await page.getByTestId('deck-editor-load-deck-row').filter({ hasText: 'Browser Round Trip Copy' }).click();

    await expect(page.getByRole('heading', { name: 'Browser Round Trip Copy' })).toBeVisible();
    await expect(page.getByTestId('deck-description-input')).toHaveValue('Browser round trip notes');
    await expect(page.getByRole('status')).toContainText('Loaded Browser Round Trip Copy.');
  });

  test('guards unsaved deck changes before app navigation', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await page.getByTestId('deck-description-input').fill('Unsaved navigation notes');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Discard unsaved changes and open settings?');
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByTestId('visual-navigation-target')).toHaveText('');
    await expect(page.getByTestId('deck-description-input')).toHaveValue('Unsaved navigation notes');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Discard unsaved changes and open settings?');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByTestId('visual-navigation-target')).toHaveText('settings');
  });

  test('selects, opens, and creates decks from the manager with keyboard controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const existingDeck = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'P0 Visual Smoke' });
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('deck-manager-export-button')).toBeEnabled();
    await page.getByPlaceholder('Search...').fill('no visible deck matches this');
    await expect(existingDeck).toHaveCount(0);
    await expect(page.getByTestId('deck-manager-export-button')).toBeDisabled();
    await page.getByPlaceholder('Search...').fill('');
    await expect(existingDeck).toBeVisible();
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'false');

    await existingDeck.focus();
    await page.keyboard.press('Space');
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('deck-manager-export-button')).toBeEnabled();

    await page.keyboard.press('Escape');
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('deck-manager-export-button')).toBeDisabled();

    await page.keyboard.press('Space');
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('deck-manager-export-button')).toBeEnabled();

    await page.keyboard.press('Delete');
    await expect(page.getByTestId('deck-manager-delete-confirm')).toBeVisible();
    await expect(page.getByTestId('deck-manager-delete-confirm')).toContainText('P0 Visual Smoke');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-manager-delete-confirm')).toHaveCount(0);
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'true');

    await existingDeck.focus();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('deck-manager-delete-confirm')).toBeVisible();
    await page.getByTestId('deck-manager-delete-cancel-button').click();
    await expect(page.getByTestId('deck-manager-delete-confirm')).toHaveCount(0);
    await expect(existingDeck).toHaveAttribute('aria-pressed', 'true');

    await existingDeck.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('visual-deck-manager-action')).toHaveText(/^edit:/);

    const newDeckCard = page.getByTestId('deck-manager-new-deck-card');
    await newDeckCard.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('visual-deck-manager-action')).toHaveText('create');
  });

  test('moves cards between main deck and sideboard with desktop-style gestures', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const mainLightningBolt = deckRow(page, 'main', 'Lightning Bolt');
    const sideLightningBolt = deckRow(page, 'side', 'Lightning Bolt');
    const mainNaturalize = deckRow(page, 'main', 'Naturalize');
    const sideNaturalize = deckRow(page, 'side', 'Naturalize');
    const collectionLightningBolt = collectionCardWrapper(page, 'Lightning Bolt');
    const collectionLlanowarElves = collectionCardWrapper(page, 'Llanowar Elves');
    const deckPanel = page.getByTestId('deck-panel');

    await expect(deckPanel).toHaveAttribute('data-selection-state', 'idle');
    await expect(deckPanel).toHaveAttribute('data-selected-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-main-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-sideboard-count', '0');
    await expect(deckPanel).toHaveAttribute('data-main-row-count', '3');
    await expect(deckPanel).toHaveAttribute('data-sideboard-row-count', '1');
    await expect(deckPanel).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(mainLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('4');
    await mainLightningBolt.dblclick({ modifiers: ['Alt'] });
    await expect(mainLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('3');
    await expect(sideLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(sideLightningBolt).toBeFocused();

    await startCollectionCardDrag(page, 'Lightning Bolt');
    await expect(collectionLightningBolt).toHaveAttribute('data-dragging', 'true');
    await expect(collectionLightningBolt).toBeVisible();
    await finishCollectionCardDragToZone(page, 'main');
    await expect(collectionLightningBolt).toBeVisible();
    await expect(collectionLightningBolt).not.toHaveAttribute('data-dragging', 'true');
    await expect(mainLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('4');

    await startCollectionCardDrag(page, 'Llanowar Elves');
    await expect(collectionLlanowarElves).toHaveAttribute('data-dragging', 'true');
    await expect(collectionLlanowarElves).toBeVisible();
    await finishCollectionCardDragToZone(page, 'side');
    await expect(collectionLlanowarElves).toBeVisible();
    await expect(collectionLlanowarElves).not.toHaveAttribute('data-dragging', 'true');
    await expect(deckRow(page, 'side', 'Llanowar Elves').getByTestId('deck-card-count-input')).toHaveValue('1');

    await collectionLlanowarElves.focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('F10');
    await page.keyboard.up('Shift');
    let cardPreview = page.getByTestId('card-preview-modal');
    await expect(cardPreview).toBeVisible();
    await expect(cardPreview).toHaveAttribute('role', 'dialog');
    await expect(cardPreview.getByRole('button', { name: 'Close card preview' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cardPreview.getByRole('button', { name: 'Close card preview' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(cardPreview.getByRole('button', { name: 'Close card preview' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Llanowar Elves' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);
    await expect(collectionLlanowarElves).toBeFocused();

    await collectionLlanowarElves.focus();
    await page.keyboard.press('Enter');
    await expect(deckRow(page, 'main', 'Llanowar Elves').getByTestId('deck-card-count-input')).toHaveValue('5');
    await page.keyboard.down('Alt');
    await page.keyboard.press('Space');
    await page.keyboard.up('Alt');
    await expect(deckRow(page, 'side', 'Llanowar Elves').getByTestId('deck-card-count-input')).toHaveValue('2');
    await collectionLlanowarElves.click();
    await page.getByTestId('deck-description-input').click();
    await page.waitForTimeout(300);
    await expect(deckRow(page, 'main', 'Llanowar Elves').getByTestId('deck-card-count-input')).toHaveValue('5');

    await expect(sideNaturalize.getByTestId('deck-card-count-input')).toHaveValue('2');
    await startDeckRowDrag(page, 'side', 'Naturalize');
    await expect(sideNaturalize).toHaveAttribute('data-dragging', 'true');
    await expect(sideNaturalize.getByTestId('deck-card-count-input')).toHaveValue('2');
    await finishDeckRowDragToZone(page, 'main');
    await expect(sideNaturalize.getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(mainNaturalize.getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(mainNaturalize).toBeFocused();

    await mainNaturalize.focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('F10');
    await page.keyboard.up('Shift');
    cardPreview = page.getByTestId('card-preview-modal');
    await expect(cardPreview).toBeVisible();
    await expect(cardPreview).toHaveAttribute('role', 'dialog');
    await expect(cardPreview.getByRole('button', { name: 'Close card preview' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Naturalize' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);
    await expect(mainNaturalize).toBeFocused();

    await sideLightningBolt.click({ modifiers: ['ControlOrMeta'] });
    await mainNaturalize.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');
    await expect(deckPanel).toHaveAttribute('data-selection-state', 'active');
    await expect(deckPanel).toHaveAttribute('data-selected-count', '2');
    await expect(deckPanel).toHaveAttribute('data-selected-main-count', '1');
    await expect(deckPanel).toHaveAttribute('data-selected-sideboard-count', '1');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveAttribute('data-selection-state', 'active');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveAttribute('data-selected-count', '2');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveAttribute('data-selected-main-count', '1');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveAttribute('data-selected-sideboard-count', '1');
    await expect(sideLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(mainNaturalize).toHaveAttribute('data-row-selected', 'true');
    await mainNaturalize.getByTestId('deck-card-select-checkbox').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(deckPanel).toHaveAttribute('data-selection-state', 'idle');
    await expect(deckPanel).toHaveAttribute('data-selected-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-main-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-sideboard-count', '0');
    await expect(mainNaturalize).toBeFocused();
    await expect(sideLightningBolt).not.toHaveAttribute('data-row-selected', 'true');
    await expect(mainNaturalize).not.toHaveAttribute('data-row-selected', 'true');

    await sideLightningBolt.click({ modifiers: ['ControlOrMeta'] });
    await mainNaturalize.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');
    await page.getByTestId('deck-clear-selection-button').click();
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(mainNaturalize).toBeFocused();
    await sideLightningBolt.click({ modifiers: ['ControlOrMeta'] });
    await mainNaturalize.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');

    await page.getByTestId('deck-editor-sideboard-toggle').uncheck();
    await expect(page.getByTestId('deck-section-sideboard')).toHaveCount(0);
    await expect(deckPanel).toHaveAttribute('data-sideboard-visible', 'false');
    await expect(deckPanel).toHaveAttribute('data-sideboard-row-count', '0');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('1 selected');
    await expect(deckPanel).toHaveAttribute('data-selected-count', '1');
    await expect(deckPanel).toHaveAttribute('data-selected-main-count', '1');
    await expect(deckPanel).toHaveAttribute('data-selected-sideboard-count', '0');
    await expect(mainNaturalize).toHaveAttribute('data-row-selected', 'true');
    await page.getByTestId('deck-editor-sideboard-toggle').check();
    await expect(page.getByTestId('deck-section-sideboard')).toBeVisible();
    await expect(deckPanel).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(deckPanel).toHaveAttribute('data-sideboard-row-count', '3');
    await expect(sideLightningBolt).not.toHaveAttribute('data-row-selected', 'true');

    await mainNaturalize.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(sideLightningBolt).toBeVisible();
    await expect(mainNaturalize).toBeVisible();

    await sideLightningBolt.click();
    await page.getByTestId('deck-editor-sideboard-toggle').uncheck();
    await page.waitForTimeout(300);
    await page.getByTestId('deck-editor-sideboard-toggle').check();
    await expect(page.getByTestId('deck-section-sideboard')).toBeVisible();
    await expect(sideLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('1');

    await sideLightningBolt.click();
    await page.getByTestId('deck-description-input').click();
    await page.waitForTimeout(300);
    await expect(sideLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('1');

    const sideLightningCount = sideLightningBolt.getByTestId('deck-card-count-input');
    await sideLightningCount.focus();
    await sideLightningCount.fill('3');
    await expect(sideLightningCount).toHaveValue('3');
    await page.keyboard.press('Escape');
    await expect(sideLightningCount).toHaveValue('1');
    await expect(sideLightningCount).not.toBeFocused();

    await sideLightningCount.focus();
    await sideLightningCount.fill('2');
    await page.keyboard.press('Enter');
    await expect(sideLightningCount).toHaveValue('2');
    await expect(sideLightningCount).not.toBeFocused();

    await sideLightningBolt.click();
    await page.getByTestId('deck-editor-save-button').click();
    await page.waitForTimeout(300);
    await expect(sideLightningBolt.getByTestId('deck-card-count-input')).toHaveValue('2');

    await mainLightningBolt.click({ modifiers: ['ControlOrMeta'] });
    await deckRow(page, 'main', 'Mountain').focus();
    await page.keyboard.press('Shift+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('3 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

    await mainLightningBolt.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('7 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Naturalize')).toHaveAttribute('data-row-selected', 'true');
    await expect(sideLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'side', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

    await mainLightningBolt.getByTestId('deck-card-select-checkbox').check();
    await deckRow(page, 'main', 'Mountain').focus();
    await page.keyboard.press('Shift+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('3 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

    await mainLightningBolt.getByTestId('deck-card-select-checkbox').check();
    await deckRow(page, 'main', 'Mountain').getByTestId('deck-card-select-checkbox').focus();
    await page.keyboard.press('Shift+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('3 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

    await mainLightningBolt.getByTestId('deck-card-select-checkbox').check();
    await deckRow(page, 'main', 'Mountain').getByTestId('deck-card-select-checkbox').click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('deck-selected-count')).toHaveText('3 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

    await page.getByTestId('deck-editor-sideboard-toggle').uncheck();
    await expect(page.getByTestId('deck-section-sideboard')).toHaveCount(0);
    await mainLightningBolt.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('4 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-row-selected', 'true');
    await expect(deckRow(page, 'main', 'Naturalize')).toHaveAttribute('data-row-selected', 'true');
    await mainLightningBolt.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await page.getByTestId('deck-editor-sideboard-toggle').check();
    await expect(page.getByTestId('deck-section-sideboard')).toBeVisible();

    await sideLightningBolt.click({ modifiers: ['ControlOrMeta'] });
    await mainNaturalize.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');

    await sideLightningBolt.focus();
    await page.keyboard.press('Delete');
    await expect(sideLightningBolt).toHaveCount(0);
    await expect(mainNaturalize).toHaveCount(0);
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(deckPanel).toHaveAttribute('data-selection-state', 'idle');
    await expect(deckPanel).toHaveAttribute('data-selected-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-main-count', '0');
    await expect(deckPanel).toHaveAttribute('data-selected-sideboard-count', '0');
    await expect(deckRow(page, 'side', 'Naturalize')).toBeFocused();
    await deckRow(page, 'side', 'Llanowar Elves').getByTestId('deck-card-remove-all-button').click();
    await expect(deckRow(page, 'side', 'Llanowar Elves')).toHaveCount(0);
    await expect(deckRow(page, 'side', 'Naturalize')).toBeFocused();
    await deckRow(page, 'side', 'Naturalize').getByTestId('deck-card-count-input').fill('0');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Mountain')).toBeFocused();

    const mainMountain = deckRow(page, 'main', 'Mountain');
    await mainMountain.getByTestId('deck-card-count-input').fill('1');
    await mainMountain.focus();
    await page.keyboard.press('Enter');
    await expect(mainMountain).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Llanowar Elves')).toBeFocused();
  });

  test('removes selected deck rows with Backspace and preserves focus orientation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const mainLightningBolt = deckRow(page, 'main', 'Lightning Bolt');
    const mainLlanowarElves = deckRow(page, 'main', 'Llanowar Elves');
    const mainMountain = deckRow(page, 'main', 'Mountain');

    await mainLightningBolt.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await mainLlanowarElves.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(mainLlanowarElves).toHaveAttribute('data-row-selected', 'true');

    await page.keyboard.press('Backspace');
    await expect(mainLightningBolt).toHaveCount(0);
    await expect(mainLlanowarElves).toHaveCount(0);
    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(mainMountain).toBeFocused();
  });

  test('keeps Backspace inside exact-count inputs while deck rows are selected', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const mainLightningBolt = deckRow(page, 'main', 'Lightning Bolt');
    const mainLlanowarElves = deckRow(page, 'main', 'Llanowar Elves');
    const mainMountain = deckRow(page, 'main', 'Mountain');
    const mountainCount = mainMountain.getByTestId('deck-card-count-input');

    await mainLightningBolt.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await mainLlanowarElves.focus();
    await page.keyboard.press('ControlOrMeta+Space');
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');

    await mountainCount.fill('12');
    await mountainCount.focus();
    await page.keyboard.press('Backspace');

    await expect(mountainCount).toHaveValue('1');
    await expect(mainLightningBolt).toBeVisible();
    await expect(mainLlanowarElves).toBeVisible();
    await expect(page.getByTestId('deck-selected-count')).toHaveText('2 selected');
    await expect(mainLightningBolt).toHaveAttribute('data-row-selected', 'true');
    await expect(mainLlanowarElves).toHaveAttribute('data-row-selected', 'true');
  });

  test('keeps select-all native inside exact-count inputs', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const mountainCount = deckRow(page, 'main', 'Mountain').getByTestId('deck-card-count-input');
    await mountainCount.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('7');

    await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-row-selected', 'true');
    await expect(mountainCount).toHaveValue('7');
  });

  test('adds basic lands with printing constraints from the editor modal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await page.getByTestId('deck-editor-add-lands-button').click();
    let addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();
    await expect(addLandsModal).toHaveAttribute('role', 'dialog');
    await expect(addLandsModal.getByTestId('deck-add-lands-target-input')).toBeFocused();
    await addLandsModal.getByTestId('deck-add-lands-cancel-button').focus();
    await page.keyboard.press('Tab');
    await expect(addLandsModal.getByTestId('deck-add-lands-target-input')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(addLandsModal.getByTestId('deck-add-lands-cancel-button')).toBeFocused();
    await addLandsModal.getByLabel('Forest count').fill('2');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeFocused();
    await expect(deckRow(page, 'main', 'Forest')).toHaveCount(0);
    await expect(deckRow(page, 'side', 'Forest')).toHaveCount(0);

    await page.getByTestId('deck-editor-add-lands-button').click();
    addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();
    await addLandsModal.getByLabel('Forest count').fill('2');
    await addLandsModal.getByTestId('deck-add-lands-cancel-button').click();
    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeFocused();
    await expect(deckRow(page, 'side', 'Forest')).toHaveCount(0);

    await page.getByTestId('deck-editor-add-lands-button').click();
    addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();
    await expect(addLandsModal.getByTestId('deck-add-lands-rules')).toHaveAttribute('data-count-source', 'manual');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-source')).toHaveText('Manual');
    await addLandsModal.getByTestId('deck-add-lands-suggest-button').click();
    await expect(addLandsModal.getByTestId('deck-add-lands-rules')).toHaveAttribute('data-count-source', 'suggested');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-source')).toHaveText('Suggested');
    await addLandsModal.getByLabel('Forest count').fill('1');
    await expect(addLandsModal.getByTestId('deck-add-lands-rules')).toHaveAttribute('data-count-source', 'manual');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-source')).toHaveText('Manual');
    await addLandsModal.getByTestId('deck-add-lands-cancel-button').click();
    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeFocused();
    await expect(deckRow(page, 'side', 'Forest')).toHaveCount(0);

    await page.getByTestId('deck-editor-add-lands-button').click();
    addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();

    const freeBuildRules = addLandsModal.getByTestId('deck-add-lands-rules');
    await expect(freeBuildRules).toHaveAttribute('data-target-size', '60');
    await expect(freeBuildRules).toHaveAttribute('data-total-added', '0');
    await expect(freeBuildRules).toHaveAttribute('data-submit-state', 'blocked');
    await expect(freeBuildRules).toHaveAttribute('data-destination', 'main');
    await expect(freeBuildRules).toHaveAttribute('data-zone-policy', 'multi-zone');
    await expect(freeBuildRules).toHaveAttribute('data-set-code', '');
    await expect(freeBuildRules).toHaveAttribute('data-set-label', 'Any set');
    await expect(freeBuildRules).toHaveAttribute('data-full-art-only', 'false');
    await expect(freeBuildRules).toHaveAttribute('data-snow-allowed', 'true');
    await expect(freeBuildRules).toHaveAttribute('data-count-source', 'manual');
    await expect(freeBuildRules).toHaveAttribute('aria-label', 'Add Lands rules: target 60, 0 selected, Main or sideboard, Any set, any art, snow basics allowed, manual counts, choose at least one land');
    await expect(freeBuildRules).toHaveAttribute('title', 'Add Lands rules: target 60, 0 selected, Main or sideboard, Any set, any art, snow basics allowed, manual counts, choose at least one land');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-target')).toHaveText('Target 60');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-destination')).toHaveText('Main or sideboard');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-snow')).toHaveText('Snow allowed');
    await expect(addLandsModal.getByTestId('deck-add-lands-set-option-any')).toHaveAttribute('data-selected', 'true');
    const forestRow = addLandsModal.locator('[data-testid="deck-add-lands-row"][data-land-key="forest"]');
    const forestDecrement = addLandsModal.locator('[data-testid="deck-add-lands-decrement-button"][data-land-key="forest"]');
    const forestIncrement = addLandsModal.locator('[data-testid="deck-add-lands-increment-button"][data-land-key="forest"]');
    const addLandsSubmit = addLandsModal.getByTestId('deck-add-lands-submit-button');
    await expect(forestRow).toHaveAttribute('data-land-count', '0');
    await expect(forestRow).toHaveAttribute('data-land-selected', 'false');
    await expect(addLandsSubmit).toBeDisabled();
    await expect(forestDecrement).toBeDisabled();
    await forestIncrement.click();
    await expect(addLandsModal.getByLabel('Forest count')).toHaveValue('1');
    await expect(forestRow).toHaveAttribute('data-land-count', '1');
    await expect(forestRow).toHaveAttribute('data-land-selected', 'true');
    await expect(freeBuildRules).toHaveAttribute('data-total-added', '1');
    await expect(freeBuildRules).toHaveAttribute('data-submit-state', 'ready');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-total')).toHaveText('1 selected');
    await expect(addLandsSubmit).toBeEnabled();
    await expect(forestDecrement).toBeEnabled();
    await forestDecrement.click();
    await expect(addLandsModal.getByLabel('Forest count')).toHaveValue('0');
    await expect(forestRow).toHaveAttribute('data-land-count', '0');
    await expect(forestRow).toHaveAttribute('data-land-selected', 'false');
    await expect(freeBuildRules).toHaveAttribute('data-total-added', '0');
    await expect(freeBuildRules).toHaveAttribute('data-submit-state', 'blocked');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-total')).toHaveText('0 selected');
    await expect(addLandsSubmit).toBeDisabled();
    await expect(forestDecrement).toBeDisabled();
    const m11Option = addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'M11' });
    const iceOption = addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'ICE' });
    await expect(m11Option).toBeVisible();
    await expect(m11Option).toHaveAttribute('data-set-code', 'M11');
    await expect(m11Option).toHaveAttribute('data-selected', 'false');
    await expect(m11Option).toHaveAttribute('data-land-count', '1');
    await expect(m11Option).toHaveAttribute('data-is-deck-set', 'true');
    await expect(m11Option).toHaveAttribute('data-has-full-art', 'false');
    await expect(m11Option).toHaveAttribute('data-has-snow-basics', 'false');
    await expect(iceOption).toBeVisible();
    await expect(iceOption).toHaveAttribute('data-set-code', 'ICE');
    await expect(iceOption).toHaveAttribute('data-has-snow-basics', 'true');
    await addLandsModal.getByTestId('deck-add-lands-set-search-input').fill('bfz');
    const bfzOption = addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'BFZ' });
    await expect(bfzOption).toHaveAttribute('data-set-code', 'BFZ');
    await expect(bfzOption).toHaveAttribute('data-selected', 'false');
    await expect(bfzOption).toHaveAttribute('data-has-full-art', 'true');
    await expect(bfzOption).toHaveAttribute('data-has-snow-basics', 'false');
    await bfzOption.click();
    await expect(addLandsModal.getByTestId('deck-add-lands-set-input')).toHaveValue('BFZ');
    await expect(addLandsModal.getByTestId('deck-add-lands-set-option-any')).toHaveAttribute('data-selected', 'false');
    await expect(bfzOption).toHaveAttribute('data-selected', 'true');
    await addLandsModal.getByTestId('deck-add-lands-full-art-checkbox').check();
    await addLandsModal.getByLabel('Forest count').fill('1');
    await addLandsModal.getByTestId('deck-add-lands-zone-select').selectOption('side');
    await expect(forestRow).toHaveAttribute('data-land-count', '1');
    await expect(forestRow).toHaveAttribute('data-land-selected', 'true');
    await expect(freeBuildRules).toHaveAttribute('data-total-added', '1');
    await expect(freeBuildRules).toHaveAttribute('data-submit-state', 'ready');
    await expect(freeBuildRules).toHaveAttribute('data-destination', 'side');
    await expect(freeBuildRules).toHaveAttribute('data-set-code', 'BFZ');
    await expect(freeBuildRules).toHaveAttribute('data-set-label', 'Battle for Zendikar (BFZ)');
    await expect(freeBuildRules).toHaveAttribute('data-full-art-only', 'true');
    await expect(freeBuildRules).toHaveAttribute('aria-label', 'Add Lands rules: target 60, 1 selected, Main or sideboard, Battle for Zendikar (BFZ), full-art only, snow basics allowed, manual counts, ready to add');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-printing')).toHaveText('Battle for Zendikar (BFZ)');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-art')).toHaveText('Full-art only');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-total')).toHaveText('1 selected');
    await expect(addLandsSubmit).toBeEnabled();
    await addLandsSubmit.click();

    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeFocused();
    await expect(page.getByRole('status')).toContainText(
      'Added 1 basic land (from BFZ, full-art only) to sideboard.',
    );
    const resultDetails = page.getByTestId('add-lands-result-details');
    await expect(resultDetails).toHaveAttribute('data-total-added', '1');
    await expect(resultDetails).toHaveAttribute('data-destination', 'side');
    await expect(resultDetails).toHaveAttribute('data-set-code', 'BFZ');
    await expect(resultDetails).toHaveAttribute('data-full-art-only', 'true');
    await expect(resultDetails).toHaveAttribute('data-unresolved-count', '0');
    const resultCard = resultDetails.getByTestId('add-lands-result-card').filter({ hasText: 'Forest' });
    await expect(resultCard).toHaveAttribute('data-card-name', 'Forest');
    await expect(resultCard).toHaveAttribute('data-card-amount', '1');
    await expect(resultCard).toHaveAttribute('data-set-code', 'BFZ');
    await expect(resultCard).toHaveAttribute('data-resolved', 'true');
    await expect(deckRow(page, 'side', 'Forest').getByTestId('deck-card-count-input')).toHaveValue('1');
  });

  test('hides snow land set options outside free-building editor mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=limited');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await page.getByTestId('deck-editor-add-lands-button').click();
    const addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();

    await expect(addLandsModal.getByTestId('deck-add-lands-target-input')).toHaveValue('60');
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select').locator('option[value="side"]')).toHaveCount(0);
    const limitedRules = addLandsModal.getByTestId('deck-add-lands-rules');
    await expect(limitedRules).toHaveAttribute('data-target-size', '60');
    await expect(limitedRules).toHaveAttribute('data-total-added', '0');
    await expect(limitedRules).toHaveAttribute('data-destination', 'main');
    await expect(limitedRules).toHaveAttribute('data-zone-policy', 'single-zone');
    await expect(limitedRules).toHaveAttribute('data-snow-allowed', 'false');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-destination')).toHaveText('Main deck only');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-snow')).toHaveText('No snow basics');
    const limitedM11Option = addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'M11' });
    await expect(limitedM11Option).toBeVisible();
    await expect(limitedM11Option).toHaveAttribute('data-has-snow-basics', 'false');
    await expect(addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'ICE' })).toHaveCount(0);
    await addLandsModal.getByTestId('deck-add-lands-set-input').fill('ICE');
    await addLandsModal.getByLabel('Forest count').fill('1');
    await expect(limitedRules).toHaveAttribute('data-total-added', '1');
    await expect(limitedRules).toHaveAttribute('data-set-code', 'ICE');
    await expect(limitedRules).toHaveAttribute('data-set-label', 'ICE');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-printing')).toHaveText('ICE');
    await expect(addLandsModal.getByTestId('deck-add-lands-rule-total')).toHaveText('1 selected');
    await addLandsModal.getByTestId('deck-add-lands-submit-button').click();

    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Added 1 basic land (from ICE) to main deck.');
    await expect(page.getByRole('status')).toContainText('Forest used fallback printings.');
    const resultDetails = page.getByTestId('add-lands-result-details');
    await expect(resultDetails).toHaveAttribute('data-total-added', '1');
    await expect(resultDetails).toHaveAttribute('data-destination', 'main');
    await expect(resultDetails).toHaveAttribute('data-set-code', 'ICE');
    await expect(resultDetails).toHaveAttribute('data-unresolved-count', '1');
    const fallbackCard = resultDetails.getByTestId('add-lands-result-card').filter({ hasText: 'Forest' });
    await expect(fallbackCard).toHaveAttribute('data-resolved', 'false');
    await expect(fallbackCard).toHaveAttribute('data-set-code', '');
    await expect(resultDetails.getByTestId('add-lands-result-unresolved')).toContainText('Forest');
    await expect(deckRow(page, 'main', 'Forest').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Snow-Covered Forest')).toHaveCount(0);
  });

  test('shows Add Lands only for deck-editor modes where the desktop client allows it', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=normal');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=limited');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-add-lands-button')).toHaveCount(0);

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=draft');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-add-lands-button')).toHaveCount(0);
  });

  test('generates a deck from persisted generator settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await page.getByTestId('deck-editor-generate-button').click();
    let generatorModal = page.getByTestId('deck-generator-modal');
    await expect(generatorModal).toBeVisible();
    let generatorFormatInput = generatorModal.getByTestId('deck-generator-format-input');
    await expect(generatorFormatInput).toBeFocused();
    await expect(generatorFormatInput).toHaveValue('Constructed - Standard');
    await expect.poll(async () => generatorFormatInput.evaluate(input => {
      const element = input as HTMLInputElement;
      return {
        start: element.selectionStart,
        end: element.selectionEnd,
        valueLength: element.value.length,
      };
    })).toEqual({
      start: 0,
      end: 'Constructed - Standard'.length,
      valueLength: 'Constructed - Standard'.length,
    });
    await generatorModal.getByLabel('Blue').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-generator-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-generate-button')).toBeFocused();
    await expect(page.getByRole('heading', { name: 'P0 Visual Smoke' })).toBeVisible();

    await page.getByTestId('deck-editor-generate-button').click();
    generatorModal = page.getByTestId('deck-generator-modal');
    await expect(generatorModal).toBeVisible();
    generatorFormatInput = generatorModal.getByTestId('deck-generator-format-input');
    await expect(generatorFormatInput).toBeFocused();
    await page.keyboard.type('TLA');
    await generatorModal.getByTestId('deck-generator-submit-button').focus();
    await page.keyboard.press('Tab');
    await expect(generatorModal.getByLabel('White')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(generatorModal.getByTestId('deck-generator-submit-button')).toBeFocused();

    await generatorModal.getByLabel('Green').click();
    await generatorModal.getByLabel('Blue').click();
    await generatorModal.getByRole('button', { name: '40' }).click();
    await generatorModal.getByTestId('deck-generator-submit-button').click();

    await expect(page.getByTestId('deck-generator-modal')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-generate-button')).toBeFocused();
    await expect(page.getByRole('heading', { name: /Generated-Deck-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}-\d{2}-\d{3}/ })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/Generated Generated-Deck-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}-\d{2}-\d{3} from green\./);
    await expect(page.getByRole('status')).toContainText('Generated 23/40 main-deck cards');
    await expect(deckRow(page, 'main', 'Llanowar Elves').getByTestId('deck-card-count-input')).toHaveValue(/^[1-4]$/);
    await expect(deckRow(page, 'main', 'Elvish Visionary').getByTestId('deck-card-count-input')).toHaveValue(/^[1-4]$/);
    await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue(/^[1-4]$/);
    await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue(/^[1-4]$/);
    await expect(deckRow(page, 'main', 'Forest').getByTestId('deck-card-count-input')).toHaveValue('15');

    await expect.poll(async () => readGeneratorSettings(page)).toMatchObject({
      colors: ['green'],
      deckSize: 40,
      format: 'TLA',
    });
  });

  test('searches cards with persisted filters and modifier-key exclusions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await expect(collectionCard(page, 'Lightning Bolt')).toBeVisible();
    await expect(collectionCard(page, 'Llanowar Elves')).toBeVisible();
    await expect(page.getByTestId('deck-editor-format-options').locator('option[value="Constructed - Pauper"]')).toHaveCount(1);
    await expect(page.getByTestId('deck-editor-set-code-options').locator('option[value="DMU"]')).toHaveCount(1);
    await expect(page.getByTestId('deck-editor-search-names-toggle')).toBeChecked();
    await expect(page.getByTestId('deck-editor-search-types-toggle')).toBeChecked();
    await expect(page.getByTestId('deck-editor-search-rules-toggle')).toBeChecked();

    await page.getByTestId('deck-editor-card-name-filter').fill('Opt');
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(collectionCards(page)).toHaveCount(2);
    await page.getByRole('checkbox', { name: 'Unique' }).check();
    await expect(collectionCards(page)).toHaveCount(1);
    await page.getByRole('checkbox', { name: 'Unique' }).uncheck();
    await expect(collectionCards(page)).toHaveCount(2);

    await page.getByTestId('deck-editor-card-name-filter').fill('"draw a card"');
    await page.getByTestId('deck-editor-search-names-toggle').uncheck();
    await page.getByTestId('deck-editor-search-types-toggle').uncheck();
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(collectionCards(page)).toHaveCount(3);

    await page.getByTestId('deck-editor-card-name-filter').fill('legendary');
    await page.getByTestId('deck-editor-search-types-toggle').check();
    await page.getByTestId('deck-editor-search-rules-toggle').uncheck();
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(collectionCards(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByTestId('deck-editor-card-name-filter').fill('');
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(collectionCard(page, 'Lightning Bolt')).toBeVisible();
    await expect(collectionCard(page, 'Llanowar Elves')).toBeVisible();

    await page.locator('.filter-format').getByLabel('Deck').uncheck();
    await page.getByTestId('deck-editor-format-picker').selectOption('Constructed - Pauper');
    await expect(page.getByTestId('deck-editor-format-filter')).toHaveValue('Constructed - Pauper');
    await page.getByTestId('deck-editor-set-code-picker').selectOption('DMU');
    await page.getByTestId('deck-editor-set-code-picker').selectOption('M11');
    await expect(page.getByTestId('deck-editor-set-code-filter')).toHaveValue('DMU M11');
    await expect(page.getByTestId('deck-editor-active-filters')).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Format: Constructed - Pauper' })).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Set: DMU' })).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Set: M11' })).toBeVisible();
    await expect(page.getByLabel('Remove DMU set filter')).toBeVisible();
    await page.getByLabel('Remove DMU set filter').click();
    await page.getByTestId('deck-editor-set-code-filter').fill('');
    await page.getByLabel('Penny').check();
    await expect(page.getByTestId('deck-editor-format-filter')).toHaveValue('Penny Dreadful Commander');
    await expect(page.getByTestId('deck-editor-format-filter')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear Penny Dreadful filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear Penny Dreadful filter' }).click();
    await expect(page.getByLabel('Penny')).not.toBeChecked();
    await expect(page.getByTestId('deck-editor-format-filter')).toBeEnabled();

    await page.getByTestId('deck-editor-color-filter-red').click({ modifiers: ['Meta'] });
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Color: W' })).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Color: G' })).toBeVisible();
    await page.getByRole('button', { name: 'Search cards' }).click();
    await expect(collectionCard(page, 'Lightning Bolt')).toHaveCount(0);
    await expect(collectionCard(page, 'Llanowar Elves')).toBeVisible();

    await page.getByTestId('deck-editor-card-name-filter').fill('Naturalize');
    await page.getByTestId('deck-editor-collection-list-button').click();
    await page.getByTestId('deck-editor-collection-sort-select').selectOption('manaValue');
    await page.getByRole('checkbox', { name: 'Piles' }).check();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Text: Naturalize' })).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-token').filter({ hasText: 'Piles' })).toBeVisible();
    await expect(page.getByTestId('deck-editor-active-filter-count')).toContainText('active');
    await page.getByRole('button', { name: 'Search cards' }).click();

    await expect(page.getByTestId('deck-editor-collection-piles')).toBeVisible();
    await expect(page.getByRole('heading', { name: /CMC: 2/ })).toBeVisible();
    await expect(page.getByTestId('deck-editor-collection-pile-count')).toHaveText('1');
    await expect(collectionCard(page, 'Naturalize')).toBeVisible();
    await expect(collectionCard(page, 'Lightning Bolt')).toHaveCount(0);

    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      modes: {
        normal: {
          collectionView: 'list',
          search: {
            searchText: 'Naturalize',
            nameContains: 'Naturalize',
            searchNames: true,
            searchTypes: true,
            searchRules: true,
            colors: {
              white: true,
              blue: true,
              black: true,
              red: false,
              green: true,
              colorless: true,
            },
            piles: true,
          },
        },
      },
    });
  });

  test('persists layout and sort settings independently for limited, sideboard, and draft modes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=limited');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await page.getByTestId('deck-editor-collection-list-button').click();
    await page.getByTestId('deck-editor-collection-sort-select').selectOption('rarity');
    await page.getByTestId('deck-editor-collection-sort-direction-button').click();
    await page.getByTestId('deck-editor-deck-sort-select').selectOption('amount');
    await page.getByTestId('deck-editor-deck-sort-direction-button').click();
    await page.getByTestId('deck-editor-sideboard-toggle').uncheck();
    await setRangeValue(page.getByTestId('deck-editor-panel-width-input'), '420');
    await page.getByTestId('deck-editor-card-name-filter').fill('limited pick');

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('name');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('');
    await page.getByTestId('deck-editor-collection-list-button').click();
    await page.getByTestId('deck-editor-collection-sort-select').selectOption('manaValue');
    await page.getByTestId('deck-editor-deck-sort-select').selectOption('set');
    await setRangeValue(page.getByTestId('deck-editor-panel-width-input'), '360');
    await page.getByTestId('deck-editor-card-name-filter').fill('sideboard swap');

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=draft');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('name');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('');
    await page.getByTestId('deck-editor-collection-sort-select').selectOption('cardNumber');
    await page.getByTestId('deck-editor-deck-sort-select').selectOption('name');
    await setRangeValue(page.getByTestId('deck-editor-panel-width-input'), '500');
    await page.getByTestId('deck-editor-card-name-filter').fill('booster card');

    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'draft',
      modes: {
        normal: {
          collectionView: 'grid',
          collectionSortBy: 'name',
          deckSortBy: 'custom',
          deckPanelWidth: 320,
          showSideboard: true,
          search: { nameContains: '' },
        },
        limited: {
          collectionView: 'list',
          collectionSortBy: 'rarity',
          collectionSortDirection: 'desc',
          deckSortBy: 'amount',
          deckSortDirection: 'desc',
          deckPanelWidth: 420,
          showSideboard: false,
          search: { nameContains: 'limited pick' },
        },
        sideboard: {
          collectionView: 'list',
          collectionSortBy: 'manaValue',
          deckSortBy: 'set',
          deckPanelWidth: 360,
          search: { nameContains: 'sideboard swap' },
        },
        draft: {
          collectionSortBy: 'cardNumber',
          deckSortBy: 'name',
          deckPanelWidth: 500,
          search: { nameContains: 'booster card' },
        },
      },
    });

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=limited');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('rarity');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('limited pick');
    await expect(page.getByTestId('deck-editor-sideboard-toggle')).not.toBeChecked();
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-panel-width', '420');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-view', 'list');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-sort', 'rarity');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-sort-direction', 'desc');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-sort', 'amount');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-sort-direction', 'desc');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-sideboard-visible', 'false');

    await page.getByTestId('deck-editor-reset-layout-button').click();
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('name');
    await expect(page.getByTestId('deck-editor-collection-grid-button')).toHaveClass(/active/);
    await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue('custom');
    await expect(page.getByTestId('deck-editor-sideboard-toggle')).toBeChecked();
    await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue('320');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('limited pick');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-panel-width', '320');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-view', 'grid');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-sort', 'name');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-collection-sort-direction', 'asc');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(page.getByTestId('deck-editor-layout-controls')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'limited',
      modes: {
        limited: {
          collectionView: 'grid',
          collectionSortBy: 'name',
          collectionSortDirection: 'asc',
          deckSortBy: 'custom',
          deckSortDirection: 'asc',
          deckPanelWidth: 320,
          showSideboard: true,
          search: { nameContains: 'limited pick' },
        },
        sideboard: {
          collectionView: 'list',
          collectionSortBy: 'manaValue',
          deckSortBy: 'set',
          deckPanelWidth: 360,
          search: { nameContains: 'sideboard swap' },
        },
        draft: {
          collectionSortBy: 'cardNumber',
          deckSortBy: 'name',
          deckPanelWidth: 500,
          search: { nameContains: 'booster card' },
        },
      },
    });

    await gotoVisual(page, '/visual.html?scenario=deck-editor&editorMode=sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('manaValue');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('sideboard swap');
  });

  test('renders sideboard and construction activity deck payloads for submit promotion', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    let workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'sideboard');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-controls-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'sideboard');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-main-delta', '0');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-sideboard-delta', '0');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-timer-state', 'running');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-time-initial', '90');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-submit-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-timer')).toHaveText(/01:[0-3]\d/);
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Ready to submit');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'sideboard');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await workspace.getByTestId('activity-deck-sort-select').selectOption('amount');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'amount');
    await workspace.getByTestId('activity-deck-sort-direction-button').click();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'desc');
    await expect(workspace.getByTestId('activity-deck-editor-main').getByTestId('activity-deck-editor-row').first()).toHaveAttribute('data-card-name', 'Mountain');
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'sideboard',
      modes: {
        sideboard: {
          deckSortBy: 'amount',
          deckSortDirection: 'desc',
        },
      },
    });
    const sideboardVisibilityToggle = workspace.getByTestId('activity-deck-sideboard-toggle');
    await expect(sideboardVisibilityToggle).toBeChecked();
    await sideboardVisibilityToggle.uncheck();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'false');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toHaveCount(0);
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'sideboard',
      modes: {
        sideboard: {
          deckSortBy: 'amount',
          deckSortDirection: 'desc',
          showSideboard: false,
        },
      },
    });
    await sideboardVisibilityToggle.check();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toBeVisible();
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      modes: {
        sideboard: {
          showSideboard: true,
        },
      },
    });
    await workspace.getByTestId('activity-deck-reset-layout-button').click();
    await expect(workspace.getByTestId('activity-deck-reset-layout-button')).toHaveAttribute('data-editor-mode', 'sideboard');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toBeVisible();
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'sideboard',
      modes: {
        sideboard: {
          deckSortBy: 'custom',
          deckSortDirection: 'asc',
          showSideboard: true,
        },
      },
    });
    const sideboardAnalytics = workspace.getByTestId('activity-deck-analytics');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-panel')).toBeVisible();
    await expect(sideboardAnalytics.getByTestId('deck-analytics-stat-main')).toContainText('60/60');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-stat-side')).toContainText('2/15');
    await sideboardAnalytics.getByTestId('deck-analytics-color-red').click();
    await expect(activityDeckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await activityDeckRow(page, 'main', 'Lightning Bolt').getByTestId('activity-deck-editor-count-input').fill('0');
    await expect(activityDeckRow(page, 'main', 'Lightning Bolt')).toHaveCount(0);
    await workspace.getByTestId('sideboard-reset-button').click();
    await expect(activityDeckRow(page, 'main', 'Lightning Bolt').getByTestId('activity-deck-editor-count-input')).toHaveValue('4');
    await expect(activityDeckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'false');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await sideboardAnalytics.getByTestId('deck-analytics-color-red').click();
    await expect(sideboardAnalytics.getByTestId('deck-analytics-active-detail')).toBeVisible();
    await expect(sideboardAnalytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Red cards');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]')).toHaveAttribute('data-selected', 'true');
    const sideboardLegality = workspace.getByTestId('activity-deck-legality');
    await expect(sideboardLegality.getByTestId('deck-legality-panel')).toBeVisible();
    const sideboardPauperLabel = sideboardLegality.getByTestId('deck-legality-label').filter({ hasText: 'Pauper' });
    await expect(sideboardPauperLabel).toHaveAttribute('data-legality-status', 'not-legal');
    await sideboardPauperLabel.click();
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Mountain"]')).toHaveAttribute('data-selected', 'true');
    await sideboardAnalytics.getByTestId('deck-analytics-active-detail-clear').click();
    await expect(sideboardAnalytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Mountain"]')).toHaveAttribute('data-selected', 'true');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Mountain"]')).toHaveAttribute('data-format-invalid', 'true');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]')).toHaveAttribute('data-format-invalid', 'true');
    const sideboardNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="side"][data-card-name="Naturalize"]',
    );
    await expect(sideboardNaturalize).toHaveAttribute('data-format-invalid', 'true');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await startActivityDeckRowDrag(page, 'side', 'Naturalize');
    await expect(sideboardNaturalize).toHaveAttribute('data-dragging', 'true');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await finishActivityDeckRowDragToZone(page, 'main');
    const mainNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Naturalize"]',
    );
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('61');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'true');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main +1 / Side -1');
    await expect(mainNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await workspace.getByTestId('sideboard-reset-button').click();
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');

    await sideboardNaturalize.click();
    await workspace.getByTestId('sideboard-reset-button').click();
    await page.waitForTimeout(300);
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');

    await sideboardNaturalize.click();
    await expect(sideboardNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('0');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side -2');
    await workspace.getByTestId('sideboard-reset-button').click();
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');

    await sideboardNaturalize.dblclick({ modifiers: ['Alt'] });
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('61');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(mainNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await mainNaturalize.dblclick();
    await expect(mainNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side -1');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-stat-side')).toContainText('1/15');
    await expect(workspace.getByTestId('sideboard-submit-deck-button')).toBeEnabled();
    await expect(workspace.getByTestId('sideboard-reset-button')).toBeEnabled();
    await workspace.getByTestId('sideboard-submit-deck-button').click();
    await expect(workspace.getByTestId('activity-command-status')).toContainText('Deck submitted.');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-stat-side')).toContainText('1/15');
    await workspace.getByTestId('sideboard-reset-button').click();
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(sideboardNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await expect(sideboardAnalytics.getByTestId('deck-analytics-stat-side')).toContainText('1/15');

    await gotoVisual(page, '/visual.html?scenario=construction');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'construction');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-controls-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'construction');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-timer-state', 'running');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-time-initial', '120');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-submit-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-timer')).toHaveText(/02:[0-3]\d/);
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Ready to submit');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    const constructionLightningBolt = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]',
    );
    await expect(constructionLightningBolt.getByTestId('activity-deck-editor-count-input')).toHaveValue('4');
    await constructionLightningBolt.getByTestId('activity-deck-editor-count-input').fill('3');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('59');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side 0');
    const constructionSideNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="side"][data-card-name="Naturalize"]',
    );
    await expect(constructionSideNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await startActivityDeckRowDrag(page, 'side', 'Naturalize');
    await expect(constructionSideNaturalize).toHaveAttribute('data-dragging', 'true');
    await expect(constructionSideNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await finishActivityDeckRowDragToZone(page, 'main');
    const constructionMainNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Naturalize"]',
    );
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side -1');
    await expect(constructionMainNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await constructionMainNaturalize.dblclick({ modifiers: ['Alt'] });
    await expect(constructionMainNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('59');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side 0');
    await constructionSideNaturalize.dblclick();
    await expect(constructionSideNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('0');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side -2');

    await gotoVisual(page, '/visual.html?scenario=construction');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'construction');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    const constructionSideboardToggle = workspace.getByTestId('activity-deck-sideboard-toggle');
    await expect(constructionSideboardToggle).toBeChecked();
    await constructionSideboardToggle.uncheck();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'false');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toHaveCount(0);
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'limited',
      modes: {
        sideboard: {
          showSideboard: true,
        },
        limited: {
          deckSortBy: 'custom',
          showSideboard: false,
        },
      },
    });
    await workspace.getByTestId('activity-deck-reset-layout-button').click();
    await expect(workspace.getByTestId('activity-deck-reset-layout-button')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toBeVisible();
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'limited',
      modes: {
        sideboard: {
          showSideboard: true,
        },
        limited: {
          deckSortBy: 'custom',
          deckSortDirection: 'asc',
          showSideboard: true,
        },
      },
    });
    await expect(workspace.getByTestId('activity-deck-editor-row').filter({ hasText: 'Lightning Bolt' })).toBeVisible();
    const constructionAnalytics = workspace.getByTestId('activity-deck-analytics');
    await expect(constructionAnalytics.getByTestId('deck-analytics-panel')).toBeVisible();
    await expect(constructionAnalytics.getByTestId('deck-analytics-stat-main')).toContainText('60/40');
    await constructionAnalytics.getByTestId('deck-analytics-type-instant').click();
    await expect(constructionAnalytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Instants');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]')).toHaveAttribute('data-selected', 'true');
    await constructionAnalytics.getByTestId('deck-analytics-active-detail-clear').click();
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]')).toHaveAttribute('data-selected', 'false');
    const constructionLegality = workspace.getByTestId('activity-deck-legality');
    await expect(constructionLegality.getByTestId('deck-legality-panel')).toBeVisible();
    const constructionPauperLabel = constructionLegality.getByTestId('deck-legality-label').filter({ hasText: 'Pauper' });
    await expect(constructionPauperLabel).toHaveAttribute('data-legality-status', 'not-legal');
    await constructionPauperLabel.click();
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]')).toHaveAttribute('data-format-invalid', 'true');
    await expect(workspace.getByTestId('construction-submit-deck-button')).toBeEnabled();
    await expect(workspace.getByTestId('construction-add-lands-button')).toBeEnabled();
    await workspace.getByTestId('construction-add-lands-button').click();
    const constructionAddLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(constructionAddLandsModal).toBeVisible();
    await expect(constructionAddLandsModal.getByTestId('deck-add-lands-target-input')).toHaveValue('60');
    await expect(constructionAddLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
    await expect(constructionAddLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
    await expect(constructionAddLandsModal.getByTestId('deck-add-lands-zone-select').locator('option[value="side"]')).toHaveCount(0);
    await expect(constructionAddLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'ICE' })).toHaveCount(0);
    await constructionAddLandsModal.getByLabel('Forest count').fill('1');
    await constructionAddLandsModal.getByTestId('deck-add-lands-submit-button').click();
    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('61');
    await expect(constructionAnalytics.getByTestId('deck-analytics-stat-main')).toContainText('61/40');
    await expect(workspace.getByTestId('activity-command-status')).toContainText('Added 1 basic land to main deck.');
    const constructionResultDetails = workspace.getByTestId('add-lands-result-details');
    await expect(constructionResultDetails).toHaveAttribute('data-total-added', '1');
    await expect(constructionResultDetails).toHaveAttribute('data-destination', 'main');
    await expect(constructionResultDetails).toHaveAttribute('data-full-art-only', 'false');
    await expect(constructionResultDetails.getByTestId('add-lands-result-card').filter({ hasText: 'Forest' })).toHaveAttribute('data-resolved', 'true');

    await gotoVisual(page, '/visual.html?scenario=draft');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'draft');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-controls-ready', 'false');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'draft');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'draft');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    const draftLightningBolt = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]',
    );
    await expect(draftLightningBolt.getByTestId('activity-deck-editor-count-input')).toHaveValue('4');
    await draftLightningBolt.getByTestId('activity-deck-editor-count-input').fill('3');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('59');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side 0');
    const draftSideNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="side"][data-card-name="Naturalize"]',
    );
    await expect(draftSideNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await startActivityDeckRowDrag(page, 'side', 'Naturalize');
    await expect(draftSideNaturalize).toHaveAttribute('data-dragging', 'true');
    await expect(draftSideNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await finishActivityDeckRowDragToZone(page, 'main');
    const draftMainNaturalize = workspace.locator(
      '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Naturalize"]',
    );
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('1');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side -1');
    await expect(draftMainNaturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await draftMainNaturalize.click({ button: 'right' });
    await expect(page.getByTestId('card-preview-modal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Naturalize' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);

    await draftMainNaturalize.focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('F10');
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('card-preview-modal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Naturalize' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);

    await draftMainNaturalize.focus();
    await page.keyboard.down('Alt');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Alt');
    await expect(draftMainNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('59');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side 0');
    await draftSideNaturalize.focus();
    await page.keyboard.press('Delete');
    await expect(draftSideNaturalize).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('0');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side -2');
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-panel')).toBeVisible();
    await expect(workspace.getByTestId('activity-deck-legality').getByTestId('deck-legality-panel')).toBeVisible();
    await workspace.getByTestId('activity-deck-sort-select').selectOption('name');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'name');
    await workspace.getByTestId('activity-deck-sideboard-toggle').uncheck();
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'false');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toHaveCount(0);
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'draft',
      modes: {
        limited: {
          showSideboard: true,
        },
        draft: {
          deckSortBy: 'name',
          showSideboard: false,
        },
      },
    });
    await workspace.getByTestId('activity-deck-reset-layout-button').click();
    await expect(workspace.getByTestId('activity-deck-reset-layout-button')).toHaveAttribute('data-editor-mode', 'draft');
    await expect(workspace.getByTestId('activity-deck-sort-select')).toHaveValue('custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort', 'custom');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-deck-sort-direction', 'asc');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-sideboard-visible', 'true');
    await expect(workspace.getByTestId('activity-deck-editor-side')).toBeVisible();
    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'draft',
      modes: {
        limited: {
          showSideboard: true,
        },
        draft: {
          deckSortBy: 'custom',
          deckSortDirection: 'asc',
          showSideboard: true,
        },
      },
    });
  });

  for (const activityEditorCase of [
    {
      scenario: 'sideboard',
      activityKind: 'sideboard',
      editorMode: 'sideboard',
      addLandsVisible: false,
      compactAddLandsVisible: false,
      limitedSideboard: false,
      submitKind: 'sideboard',
      submitStatus: 'Sideboard submitted.',
      collectionView: 'list',
      collectionSortBy: 'manaValue',
      searchText: 'sideboard activity',
      deckSortBy: 'amount',
      deckSortDirection: 'desc',
      showSideboard: true,
      deckPanelWidth: 420,
      searchNames: true,
      searchTypes: false,
      searchRules: true,
      uniqueNames: true,
      piles: false,
    },
    {
      scenario: 'limited-sideboard',
      activityKind: 'sideboard',
      editorMode: 'sideboard',
      addLandsVisible: true,
      compactAddLandsVisible: true,
      limitedSideboard: true,
      submitKind: 'sideboard',
      submitStatus: 'Sideboard submitted.',
      collectionView: 'list',
      collectionSortBy: 'manaValue',
      searchText: 'sideboard activity',
      deckSortBy: 'amount',
      deckSortDirection: 'desc',
      showSideboard: true,
      deckPanelWidth: 420,
      searchNames: true,
      searchTypes: false,
      searchRules: true,
      uniqueNames: true,
      piles: false,
    },
    {
      scenario: 'construction',
      activityKind: 'construction',
      editorMode: 'limited',
      addLandsVisible: true,
      compactAddLandsVisible: true,
      limitedSideboard: false,
      submitKind: 'construction',
      submitStatus: 'Limited deck submitted.',
      collectionView: 'list',
      collectionSortBy: 'rarity',
      searchText: 'limited activity',
      deckSortBy: 'set',
      deckSortDirection: 'asc',
      showSideboard: true,
      deckPanelWidth: 460,
      searchNames: false,
      searchTypes: true,
      searchRules: true,
      uniqueNames: false,
      piles: true,
    },
    {
      scenario: 'draft',
      activityKind: 'draft',
      editorMode: 'draft',
      addLandsVisible: false,
      compactAddLandsVisible: false,
      limitedSideboard: false,
      submitKind: null,
      submitStatus: null,
      collectionView: 'grid',
      collectionSortBy: 'cardNumber',
      searchText: 'draft activity',
      deckSortBy: 'name',
      deckSortDirection: 'asc',
      showSideboard: true,
      deckPanelWidth: 500,
      searchNames: true,
      searchTypes: true,
      searchRules: false,
      uniqueNames: true,
      piles: true,
    },
  ] as const) {
    test(`opens ${activityEditorCase.scenario} activity deck payloads in the full editor`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1200 });
      await seedPromotedActivityEditorConfig(page, {
        mode: activityEditorCase.editorMode,
        collectionView: activityEditorCase.collectionView,
        collectionSortBy: activityEditorCase.collectionSortBy,
        searchText: activityEditorCase.searchText,
        deckSortBy: activityEditorCase.deckSortBy,
        deckSortDirection: activityEditorCase.deckSortDirection,
        showSideboard: activityEditorCase.showSideboard,
        deckPanelWidth: activityEditorCase.deckPanelWidth,
        searchNames: activityEditorCase.searchNames,
        searchTypes: activityEditorCase.searchTypes,
        searchRules: activityEditorCase.searchRules,
        uniqueNames: activityEditorCase.uniqueNames,
        piles: activityEditorCase.piles,
      });
      await gotoVisual(page, `/visual.html?scenario=${activityEditorCase.scenario}`);
      await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

      const workspace = page.getByTestId('activity-workspace');
      await expect(workspace).toHaveAttribute('data-activity-kind', activityEditorCase.activityKind);
      await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', activityEditorCase.editorMode);
      if (activityEditorCase.activityKind === 'sideboard') {
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute(
          'data-limited-sideboard',
          String(activityEditorCase.limitedSideboard),
        );
      }
      if (activityEditorCase.compactAddLandsVisible) {
        const compactAddLandsButton = workspace.getByTestId(
          activityEditorCase.activityKind === 'sideboard' ? 'sideboard-add-lands-button' : 'construction-add-lands-button',
        );
        await expect(compactAddLandsButton).toBeEnabled();
      } else {
        await expect(workspace.getByTestId('sideboard-add-lands-button')).toHaveCount(0);
      }
      const activityLightningBolt = workspace.locator(
        '[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]',
      );
      await activityLightningBolt.getByTestId('activity-deck-editor-count-input').fill('3');
      await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
      await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main -1 / Side 0');

      await workspace.getByTestId('activity-open-full-editor-button').click();

      await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'P0 Visual Smoke' })).toBeVisible();
      await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('3');
      await expect(deckRow(page, 'side', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('2');
      await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue(activityEditorCase.deckSortBy);
      await expect(page.getByTestId('deck-editor-deck-sort-direction-button')).toHaveText(activityEditorCase.deckSortDirection === 'asc' ? 'Asc' : 'Desc');
      await expect(page.getByTestId('deck-editor-sideboard-toggle')).toBeChecked({ checked: activityEditorCase.showSideboard });
      await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue(String(activityEditorCase.deckPanelWidth));
      await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue(activityEditorCase.searchText);
      await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue(activityEditorCase.collectionSortBy);
      await expect(page.getByTestId('deck-editor-search-names-toggle')).toBeChecked({ checked: activityEditorCase.searchNames });
      await expect(page.getByTestId('deck-editor-search-types-toggle')).toBeChecked({ checked: activityEditorCase.searchTypes });
      await expect(page.getByTestId('deck-editor-search-rules-toggle')).toBeChecked({ checked: activityEditorCase.searchRules });
      await expect(page.getByRole('checkbox', { name: 'Unique' })).toBeChecked({ checked: activityEditorCase.uniqueNames });
      await expect(page.getByRole('checkbox', { name: 'Piles' })).toBeChecked({ checked: activityEditorCase.piles });
      const promotedAnalytics = page.getByTestId('deck-analytics-panel');
      await expect(promotedAnalytics).toBeVisible();
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-main')).toContainText(
        activityEditorCase.activityKind === 'construction' || activityEditorCase.limitedSideboard ? '59/40' : '59/60',
      );
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-side')).toContainText(
        activityEditorCase.activityKind === 'construction' || activityEditorCase.limitedSideboard ? '2/any' : '2/15',
      );
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-total')).toContainText('61');
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-unique')).toContainText('4');
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-nonland')).toContainText('7');
      await expect(promotedAnalytics.getByTestId('deck-analytics-curve-1')).toHaveAttribute('title', 'Mana value 1: 7');
      if (activityEditorCase.collectionView === 'list') {
        await expect(page.getByTestId('deck-editor-collection-list-button')).toHaveClass(/active/);
      } else {
        await expect(page.getByTestId('deck-editor-collection-grid-button')).toHaveClass(/active/);
      }
      await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
        activeMode: activityEditorCase.editorMode,
        modes: {
          [activityEditorCase.editorMode]: {
            collectionView: activityEditorCase.collectionView,
            collectionSortBy: activityEditorCase.collectionSortBy,
            deckSortBy: activityEditorCase.deckSortBy,
            deckSortDirection: activityEditorCase.deckSortDirection,
            showSideboard: activityEditorCase.showSideboard,
            deckPanelWidth: activityEditorCase.deckPanelWidth,
            search: {
              nameContains: activityEditorCase.searchText,
              searchNames: activityEditorCase.searchNames,
              searchTypes: activityEditorCase.searchTypes,
              searchRules: activityEditorCase.searchRules,
              uniqueNames: activityEditorCase.uniqueNames,
              piles: activityEditorCase.piles,
            },
          },
        },
      });

      if (activityEditorCase.addLandsVisible) {
        await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();
      } else {
        await expect(page.getByTestId('deck-editor-add-lands-button')).toHaveCount(0);
      }

      await deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input').fill('2');
      await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('2');
      await dispatchDeckRowDoubleClick(page, 'side', 'Naturalize', { altKey: true });
      await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
      await expect(deckRow(page, 'side', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
      await expect(promotedAnalytics.getByTestId('deck-analytics-stat-side')).toContainText(
        activityEditorCase.activityKind === 'construction' || activityEditorCase.limitedSideboard ? '1/any' : '1/15',
      );
      await startDeckRowDrag(page, 'side', 'Naturalize');
      await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-dragging', 'true');
      await expect(deckRow(page, 'side', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
      await finishDeckRowDragToZone(page, 'main');
      await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('2');
      await expect(deckRow(page, 'side', 'Naturalize')).toHaveCount(0);
      await dispatchDeckRowDoubleClick(page, 'main', 'Naturalize');
      await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');

      if (activityEditorCase.addLandsVisible) {
        await page.getByTestId('deck-editor-add-lands-button').click();
        const promotedAddLandsModal = page.getByTestId('deck-add-lands-modal');
        await expect(promotedAddLandsModal).toBeVisible();
        await expect(promotedAddLandsModal.getByTestId('deck-add-lands-target-input')).toHaveValue('59');
        await expect(promotedAddLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
        await expect(promotedAddLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
        await expect(promotedAddLandsModal.getByTestId('deck-add-lands-zone-select').locator('option[value="side"]')).toHaveCount(0);
        await expect(promotedAddLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'ICE' })).toHaveCount(0);
        await promotedAddLandsModal.getByLabel('Forest count').fill('1');
        await promotedAddLandsModal.getByTestId('deck-add-lands-submit-button').click();
        await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
        await expect(deckRow(page, 'main', 'Forest').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(promotedAnalytics.getByTestId('deck-analytics-stat-main')).toContainText('60/40');
        await expect(page.getByRole('status')).toContainText('Added 1 basic land to main deck.');
      }

      const activitySubmitButton = page.getByTestId('deck-editor-activity-submit-button');
      if (activityEditorCase.submitKind) {
        await expect(activitySubmitButton).toHaveAttribute('data-activity-kind', activityEditorCase.submitKind);
        await expect(activitySubmitButton).toBeEnabled();
        await activitySubmitButton.click();
        await expect(page.getByRole('status')).toContainText(activityEditorCase.submitStatus);

        let discardPrompts = 0;
        page.on('dialog', async (dialog) => {
          discardPrompts += 1;
          await dialog.dismiss();
        });
        await page.getByRole('button', { name: 'Lobby' }).click();
        await expect.poll(() => discardPrompts).toBe(0);
      } else {
        await expect(activitySubmitButton).toHaveCount(0);
      }
    });
  }

  test('adds lands from the compact limited-sideboard activity and preserves them when promoted', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=limited-sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'sideboard');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-limited-sideboard', 'true');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');

    await workspace.getByTestId('sideboard-add-lands-button').click();
    const addLandsModal = page.getByTestId('deck-add-lands-modal');
    await expect(addLandsModal).toBeVisible();
    await expect(addLandsModal.getByTestId('deck-add-lands-target-input')).toHaveValue('60');
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
    await expect(addLandsModal.getByTestId('deck-add-lands-zone-select').locator('option[value="side"]')).toHaveCount(0);
    await expect(addLandsModal.getByTestId('deck-add-lands-set-option').filter({ hasText: 'ICE' })).toHaveCount(0);
    await addLandsModal.getByLabel('Forest count').fill('1');
    await addLandsModal.getByTestId('deck-add-lands-submit-button').click();

    await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('61');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('2');
    await expect(workspace.getByTestId('activity-deck-delta')).toHaveText('Main +1 / Side 0');
    await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-main')).toContainText('61/40');
    await expect(workspace.getByTestId('activity-command-status')).toContainText('Added 1 basic land to main deck.');
    const resultDetails = workspace.getByTestId('add-lands-result-details');
    await expect(resultDetails).toHaveAttribute('data-total-added', '1');
    await expect(resultDetails).toHaveAttribute('data-destination', 'main');
    await expect(resultDetails).toHaveAttribute('data-full-art-only', 'false');
    await expect(resultDetails.getByTestId('add-lands-result-card').filter({ hasText: 'Forest' })).toHaveAttribute('data-resolved', 'true');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Forest"]').getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="side"][data-card-name="Forest"]')).toHaveCount(0);

    await workspace.getByTestId('activity-open-full-editor-button').click();
    await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
    await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'sideboard');
    await expect(deckRow(page, 'main', 'Forest').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'side', 'Forest')).toHaveCount(0);
    await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('61/40');
    await expect(page.getByTestId('deck-analytics-stat-side')).toContainText('2/any');
  });

  test('renders viewed limited deck callbacks as read-only activity deck views', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=card-viewer');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'card-viewer');
    await expect(workspace).toHaveAttribute('data-activity-last-callback', 'viewLimitedDeck');
    await expect(workspace.getByTestId('activity-workspace-title')).toHaveText('Viewed limited deck');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-activity-command-kind', 'card-viewer');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-command-count', '0');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-deck-read-only', 'true');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'view');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-read-only', 'true');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-submit-ready', 'false');
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Read-only view');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(workspace.getByTestId('activity-open-full-editor-button')).toBeDisabled();
    await expect(workspace.getByTestId('sideboard-submit-deck-button')).toHaveCount(0);
    await expect(workspace.getByTestId('construction-add-lands-button')).toHaveCount(0);

    const bolt = workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]');
    await expect(bolt).toHaveAttribute('data-read-only', 'true');
    await expect(bolt.getByTestId('activity-deck-editor-count-input')).toBeDisabled();
    await expect(bolt.getByTestId('activity-deck-editor-move-button')).toHaveCount(0);
    await expect(bolt.getByTestId('activity-deck-editor-remove-button')).toHaveCount(0);
    await bolt.click({ button: 'right' });
    await expect(page.getByTestId('card-preview-modal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lightning Bolt' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);
    await bolt.focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('F10');
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('card-preview-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);
    await bolt.focus();
    await page.keyboard.press('Delete');
    await expect(bolt).toHaveCount(1);
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-main')).toContainText('60/40');
    await expect(workspace.getByTestId('activity-deck-legality').getByTestId('deck-legality-panel')).toBeVisible();
  });

  test('renders viewed sideboard callbacks as read-only sideboard deck views', async ({ page }) => {
    await gotoVisual(page, '/visual.html?scenario=view-sideboard');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'card-viewer');
    await expect(workspace).toHaveAttribute('data-activity-last-callback', 'viewSideboard');
    await expect(workspace.getByTestId('activity-workspace-title')).toHaveText('Viewed sideboard - Visual Opponent');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-command-count', '0');
    await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-deck-read-only', 'true');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'view');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-read-only', 'true');
    await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('0');
    await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('3');
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Read-only view');
    await expect(workspace.getByTestId('activity-open-full-editor-button')).toBeDisabled();
    await expect(workspace.getByTestId('sideboard-submit-deck-button')).toHaveCount(0);
    await expect(workspace.getByTestId('sideboard-add-lands-button')).toHaveCount(0);

    const sideboardToggle = workspace.getByTestId('activity-deck-sideboard-toggle');
    if (!(await sideboardToggle.isChecked())) {
      await sideboardToggle.check();
    }

    await expect(workspace.getByTestId('activity-deck-editor-main').getByTestId('activity-deck-editor-row')).toHaveCount(0);
    const naturalize = workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="side"][data-card-name="Naturalize"]');
    await expect(naturalize).toHaveAttribute('data-read-only', 'true');
    await expect(naturalize.getByTestId('activity-deck-editor-count-input')).toBeDisabled();
    await expect(naturalize.getByTestId('activity-deck-editor-count-input')).toHaveValue('2');
    await expect(naturalize.getByTestId('activity-deck-editor-move-button')).toHaveCount(0);
    await expect(naturalize.getByTestId('activity-deck-editor-remove-button')).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-main')).toContainText('0/60');
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-side')).toContainText('3/15');
  });

  test('promotes post-draft thin construction fallbacks with draft picks and limited editor settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await seedPromotedActivityEditorConfig(page, {
      mode: 'limited',
      collectionView: 'list',
      collectionSortBy: 'rarity',
      searchText: 'post draft limited',
      deckSortBy: 'set',
      deckSortDirection: 'asc',
      showSideboard: true,
      deckPanelWidth: 460,
      searchNames: false,
      searchTypes: true,
      searchRules: true,
      uniqueNames: false,
      piles: true,
    });

    await gotoVisual(page, '/visual.html?scenario=post-draft-construction');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const workspace = page.getByTestId('activity-workspace');
    await expect(workspace).toHaveAttribute('data-activity-kind', 'construction');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'construction');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-name', 'Post Draft Construction');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-main-count', '2');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-sideboard-count', '0');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-timer-state', 'running');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-time-initial', '75');
    await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-submit-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-timer')).toHaveText(/01:[0-2]\d/);
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Ready to submit');
    await expect(workspace.getByTestId('activity-deck-payload')).toContainText('Post Draft Construction');
    await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'limited');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Lightning Bolt"]').getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await expect(workspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Naturalize"]').getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
    await expect(workspace.getByTestId('activity-deck-editor-side').getByTestId('activity-deck-editor-row')).toHaveCount(0);
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-main')).toContainText('2/40');
    await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-side')).toContainText('0/any');
    await expect(workspace.getByTestId('construction-submit-deck-button')).toBeEnabled();
    await expect(workspace.getByTestId('construction-add-lands-button')).toBeEnabled();

    await workspace.getByTestId('activity-open-full-editor-button').click();

    await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Post Draft Construction' })).toBeVisible();
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveCount(0);
    await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue('set');
    await expect(page.getByTestId('deck-editor-deck-sort-direction-button')).toHaveText('Asc');
    await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('post draft limited');
    await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('rarity');
    await expect(page.getByTestId('deck-editor-collection-list-button')).toHaveClass(/active/);
    await expect(page.getByTestId('deck-editor-search-names-toggle')).not.toBeChecked();
    await expect(page.getByTestId('deck-editor-search-types-toggle')).toBeChecked();
    await expect(page.getByTestId('deck-editor-search-rules-toggle')).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Unique' })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Piles' })).toBeChecked();
    await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue('460');

    const analytics = page.getByTestId('deck-analytics-panel');
    await expect(analytics.getByTestId('deck-analytics-stat-main')).toContainText('2/40');
    await expect(analytics.getByTestId('deck-analytics-stat-side')).toContainText('0/any');
    await expect(analytics.getByTestId('deck-analytics-stat-total')).toContainText('2');
    await expect(analytics.getByTestId('deck-analytics-stat-unique')).toContainText('2');
    await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();
    await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'construction');
    await expect(page.getByTestId('deck-editor-activity-submit-button')).toBeEnabled();

    await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
      activeMode: 'limited',
      modes: {
        limited: {
          collectionView: 'list',
          collectionSortBy: 'rarity',
          deckSortBy: 'set',
          deckSortDirection: 'asc',
          showSideboard: true,
          deckPanelWidth: 460,
          search: {
            nameContains: 'post draft limited',
            searchNames: false,
            searchTypes: true,
            searchRules: true,
            uniqueNames: false,
            piles: true,
          },
        },
      },
    });
  });

  test('renders deck analytics from resolved card metadata', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);

    await setTestClipboard(page, [
      '1 Lightning Bolt',
      '1 Serra Angel',
      '1 Divination',
      '1 Pacifism',
      '1 Juggernaut',
      '1 Evolving Wilds',
    ].join('\n'));
    await page.getByTestId('deck-editor-import-menu-button').click();
    await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
    await page.getByTestId('deck-editor-import-clipboard-replace-option').click();
    await expect(page.getByRole('heading', { name: 'Clipboard Deck' })).toBeVisible();

    const analytics = page.getByTestId('deck-analytics-panel');
    await expect(analytics).toBeVisible();
    await expect(analytics.getByTestId('deck-analytics-status')).toHaveText('Ready');
    await expect(analytics.getByTestId('deck-analytics-stat-main')).toContainText('6/60');
    await expect(analytics.getByTestId('deck-analytics-stat-side')).toContainText('0/15');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-format', 'Pauper');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-main-remaining', '54');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-sideboard-over', '0');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-sideboard-target', '15');
    await expect(analytics.getByTestId('deck-analytics-format-requirement-main')).toHaveText('Needs 54');
    await expect(analytics.getByTestId('deck-analytics-format-requirement-side')).toHaveText('Within 15');
    await expect(analytics.getByTestId('deck-analytics-stat-total')).toContainText('6');
    await expect(analytics.getByTestId('deck-analytics-stat-unique')).toContainText('6');
    await expect(analytics.getByTestId('deck-analytics-stat-nonland')).toContainText('5');
    await expect(analytics.getByTestId('deck-analytics-stat-average-mana')).toContainText('3');
    await expect(analytics.getByTestId('deck-analytics-color-white')).toContainText('2');
    await expect(analytics.getByTestId('deck-analytics-color-blue')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-color-red')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-color-colorless')).toContainText('2');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('aria-label', 'Pauper requirements: Needs 54, Within 15');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('title', 'Pauper requirements: Needs 54, Within 15');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-main-state', 'incomplete');
    await expect(analytics.getByTestId('deck-analytics-format-requirements')).toHaveAttribute('data-sideboard-state', 'within');
    await expect(analytics.getByTestId('deck-analytics-curve-1')).toHaveAttribute('title', 'Mana value 1: 1');
    await expect(analytics.getByTestId('deck-analytics-curve-2')).toHaveAttribute('title', 'Mana value 2: 1');
    await expect(analytics.getByTestId('deck-analytics-curve-3')).toHaveAttribute('title', 'Mana value 3: 1');
    await expect(analytics.getByTestId('deck-analytics-curve-4')).toHaveAttribute('title', 'Mana value 4: 1');
    await expect(analytics.getByTestId('deck-analytics-curve-5')).toHaveAttribute('title', 'Mana value 5: 1');
    await expect(analytics.getByTestId('deck-analytics-mana-pips')).toHaveAttribute('data-desktop-label', 'Casting Costs found');
    await expect(analytics.getByTestId('deck-analytics-land-sources')).toHaveAttribute('data-desktop-label', 'Basic Land types found');
    await expect(analytics.getByTestId('deck-analytics-mana-sources')).toHaveAttribute('data-desktop-label', 'Mana sources found');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution')).toHaveAttribute('data-desktop-label', 'Mana distribution');
    await expect(analytics.getByTestId('deck-analytics-mana-pips')).toContainText('Casting Costs');
    await expect(analytics.getByTestId('deck-analytics-land-sources')).toContainText('Basic Lands');
    await expect(analytics.getByTestId('deck-analytics-mana-sources')).toContainText('Mana Sources');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution')).toContainText('Distribution');
    await expect(analytics.getByTestId('deck-analytics-mana-pip-white')).toHaveAttribute('aria-label', 'Casting Costs White: 3');
    await expect(analytics.getByTestId('deck-analytics-mana-pip-blue')).toHaveAttribute('aria-label', 'Casting Costs Blue: 1');
    await expect(analytics.getByTestId('deck-analytics-mana-pip-red')).toHaveAttribute('aria-label', 'Casting Costs Red: 1');
    await expect(analytics.getByTestId('deck-analytics-mana-pip-colorless')).toHaveAttribute('aria-label', 'Casting Costs Colorless: 10');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-summary')).toHaveAttribute('aria-label', 'Mana value 5 pips: 5');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-white')).toHaveAttribute('title', '5 White: 2');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-white')).toHaveAttribute('aria-label', 'Mana value 5 White: 2');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-colorless')).toHaveAttribute('title', '5 Colorless: 3');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-1-red')).toHaveAttribute('title', '1 Red: 1');
    await expect(analytics.getByTestId('deck-analytics-type-creature')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-type-land')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-type-sorcery')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-type-instant')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-type-enchantment')).toContainText('1');
    await expect(analytics.getByTestId('deck-analytics-type-artifact')).toContainText('1');

    await analytics.getByTestId('deck-analytics-type-creature').click();
    await expect(analytics.getByTestId('deck-analytics-type-creature')).toHaveAttribute('aria-pressed', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toBeVisible();
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Creatures');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('1');
    await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Serra Angel');

    await analytics.getByTestId('deck-analytics-type-land').click();
    await expect(analytics.getByTestId('deck-analytics-type-creature')).toHaveAttribute('aria-pressed', 'false');
    await expect(analytics.getByTestId('deck-analytics-type-land')).toHaveAttribute('aria-pressed', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-curve-5').click();
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-curve-1').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-color-white').click();
    await expect(analytics.getByTestId('deck-analytics-color-white')).toHaveAttribute('aria-pressed', 'true');
    await expect(analytics.getByTestId('deck-analytics-color-white')).toHaveAttribute('data-active', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Pacifism')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-main-count', '2');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-sideboard-count', '0');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-total-count', '2');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-count-unit', 'cards');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('aria-label', 'White cards analytics detail: 2 cards, Main 2, Side 0, Total 2. Press Escape to clear.');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('White cards');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('2');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count-unit')).toHaveText('cards');
    await expect(analytics.getByTestId('deck-analytics-active-detail-main-count')).toHaveText('Main 2');
    await expect(analytics.getByTestId('deck-analytics-active-detail-sideboard-count')).toHaveText('Side 0');
    await expect(analytics.getByTestId('deck-analytics-active-detail-total-count')).toHaveText('Total 2');
    await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Serra Angel, Pacifism');
    await expect(analytics.getByTestId('deck-analytics-active-detail-card')).toHaveCount(2);
    const whiteDetailSerra = analytics.getByTestId('deck-analytics-active-detail-card').filter({ hasText: 'Serra Angel' });
    await expect(whiteDetailSerra).toHaveAttribute('data-main-count', '1');
    await expect(whiteDetailSerra).toHaveAttribute('data-sideboard-count', '0');
    await expect(whiteDetailSerra).toHaveAttribute('data-total-count', '1');
    await expect(whiteDetailSerra).toHaveAttribute('title', 'Select Serra Angel: 1 main, 0 sideboard');
    await expect(whiteDetailSerra.locator('strong')).toHaveText('1');
    const whiteDetailPacifism = analytics.getByTestId('deck-analytics-active-detail-card').filter({ hasText: 'Pacifism' });
    await expect(whiteDetailPacifism).toHaveAttribute('data-main-count', '1');
    await expect(whiteDetailPacifism).toHaveAttribute('data-sideboard-count', '0');
    await expect(whiteDetailPacifism).toHaveAttribute('data-total-count', '1');
    await analytics.getByTestId('deck-analytics-color-white').click();
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(analytics.getByTestId('deck-analytics-color-white')).toHaveAttribute('aria-pressed', 'false');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Pacifism')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-color-white').click();
    await expect(analytics.getByTestId('deck-analytics-color-white')).toHaveAttribute('aria-pressed', 'true');
    await whiteDetailSerra.focus();
    await page.keyboard.press('Enter');
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Pacifism')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('White cards');
    await page.keyboard.press('Escape');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(analytics.getByTestId('deck-analytics-color-white')).toBeFocused();
    await expect(analytics.getByTestId('deck-analytics-color-white')).toHaveAttribute('aria-pressed', 'false');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Pacifism')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-color-white').click();
    await analytics.getByTestId('deck-analytics-active-detail-card').filter({ hasText: 'Pacifism' }).click();
    await expect(deckRow(page, 'main', 'Pacifism')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await analytics.getByTestId('deck-analytics-active-detail').focus();
    await page.keyboard.press('Escape');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Pacifism')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-color-colorless').click();
    await expect(deckRow(page, 'main', 'Juggernaut')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');
    await analytics.getByTestId('deck-analytics-active-detail-clear').click();
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(analytics.getByTestId('deck-analytics-color-colorless')).toBeFocused();
    await expect(deckRow(page, 'main', 'Juggernaut')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-mana-pip-white').click();
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Pacifism')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-mana-pip-colorless').click();
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Juggernaut')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Evolving Wilds')).not.toHaveAttribute('data-selected', 'true');

    await analytics.getByTestId('deck-analytics-mana-distribution-5-summary').click();
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Juggernaut')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Mana value 5 spread');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('5');

    await analytics.getByTestId('deck-analytics-mana-distribution-5-white').click();
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-white')).toHaveAttribute('aria-pressed', 'true');
    await expect(analytics.getByTestId('deck-analytics-mana-distribution-5-white')).toHaveAttribute('data-active', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Juggernaut')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Mana value 5 White spread');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('2');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count-unit')).toHaveText('pips');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-count-unit', 'pips');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('aria-label', 'Mana value 5 White spread analytics detail: 2 pips, Main 1, Side 0, Total 1. Press Escape to clear.');
    await expect(analytics.getByTestId('deck-analytics-active-detail-total-count')).toHaveText('Total 1');
    await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Serra Angel');

    await analytics.getByTestId('deck-analytics-mana-distribution-5-colorless').click();
    await expect(deckRow(page, 'main', 'Serra Angel')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Juggernaut')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Mana value 5 Colorless spread');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('3');

    await analytics.getByTestId('deck-analytics-mana-distribution-1-summary').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Serra Angel')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Mana value 1 spread');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('1');
    await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Lightning Bolt');
    await deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-remove-all-button').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveCount(0);
    await startCollectionCardDrag(page, 'Lightning Bolt');
    await finishCollectionCardDragToZone(page, 'main');
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
  });

  test('surfaces missing metadata as an actionable analytics detail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);

    await setTestClipboard(page, [
      '1 Lightning Bolt',
      '1 Sideboard Ghost',
    ].join('\n'));
    await page.getByTestId('deck-editor-import-menu-button').click();
    await page.getByTestId('deck-editor-import-clipboard-replace-option').click();
    const fixer = page.getByTestId('deck-import-fixer-modal');
    await expect(fixer).toBeVisible();
    await expect(fixer.getByTestId('deck-import-unresolved-card')).toContainText('Sideboard Ghost');
    await fixer.getByTestId('deck-import-save-unresolved-button').click();
    await expect(fixer).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Sideboard Ghost').getByTestId('deck-card-count-input')).toHaveValue('1');

    const analytics = page.getByTestId('deck-analytics-panel');
    await expect(analytics.getByTestId('deck-analytics-status')).toHaveText('Partial');
    const missingMetadata = analytics.getByTestId('deck-analytics-metadata-detail');
    await expect(missingMetadata).toHaveAttribute('data-unresolved-count', '1');
    await expect(missingMetadata).toHaveAttribute('aria-label', 'Missing metadata: 1');
    await expect(missingMetadata.getByTestId('deck-analytics-unresolved-names')).toContainText('Sideboard Ghost');

    await missingMetadata.focus();
    await page.keyboard.press('Enter');
    await expect(missingMetadata).toHaveAttribute('aria-pressed', 'true');
    await expect(missingMetadata).toHaveAttribute('data-active', 'true');
    await expect(deckRow(page, 'main', 'Sideboard Ghost')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Missing metadata');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('1');
    await expect(analytics.getByTestId('deck-analytics-active-detail-count-unit')).toHaveText('cards');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('data-count-unit', 'cards');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveAttribute('aria-label', 'Missing metadata analytics detail: 1 cards, Main 1, Side 0, Total 1. Press Escape to clear.');
    await expect(analytics.getByTestId('deck-analytics-active-detail-total-count')).toHaveText('Total 1');
    await expect(analytics.getByTestId('deck-analytics-active-detail-card')).toHaveAttribute('data-main-count', '1');

    await missingMetadata.click();
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(missingMetadata).toHaveAttribute('aria-pressed', 'false');
    await expect(deckRow(page, 'main', 'Sideboard Ghost')).not.toHaveAttribute('data-selected', 'true');

    await missingMetadata.click();
    await expect(missingMetadata).toHaveAttribute('aria-pressed', 'true');

    await analytics.getByTestId('deck-analytics-active-detail-card').focus();
    await page.keyboard.press('Space');
    await expect(deckRow(page, 'main', 'Sideboard Ghost')).toHaveAttribute('data-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);
    await expect(missingMetadata).toHaveAttribute('aria-pressed', 'false');
    await expect(deckRow(page, 'main', 'Sideboard Ghost')).not.toHaveAttribute('data-selected', 'true');
  });

  test('marks legality issues and selects offending deck rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const legality = page.getByTestId('deck-legality-panel');
    await expect(legality).toBeVisible();
    const pauperLabel = legality.getByTestId('deck-legality-label').filter({ hasText: 'Pauper' });
    await expect(pauperLabel).toHaveAttribute('data-legality-status', 'not-legal');
    await expect(pauperLabel).toHaveAttribute('data-validation-source', 'server');
    await expect(pauperLabel).toHaveAttribute('data-deck-type', 'Constructed - Pauper');
    await expect(pauperLabel).toHaveAttribute('data-issue-count', '5');
    await expect(pauperLabel).toHaveAttribute('data-selectable-card-count', '3');
    await expect(pauperLabel).toHaveAttribute('title', /Click to select 3 problem cards/);

    const analytics = page.getByTestId('deck-analytics-panel');
    await analytics.getByTestId('deck-analytics-color-red').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await pauperLabel.click();
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-kind', 'format');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-status', 'not-legal');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-validation-source', 'server');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-issue-count', '5');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-selectable-card-count', '3');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-deck-issue-count', '2');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('aria-label', 'Pauper legality details: Invalid, 5 issues, 3 selectable cards, 2 deck errors, Source Server validator. Press Escape to clear the current drilldown.');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Pauper');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Main min 60');
    await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-status', 'not-legal');
    await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-format', 'Pauper');
    await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-validation-source', 'server');
    await expect(legality.getByTestId('deck-legality-detail-status')).toContainText('Invalid');
    await expect(legality.getByTestId('deck-legality-detail-source')).toHaveText('Server validator');
    await expect(legality.getByTestId('deck-legality-detail-card-issue-count')).toHaveAttribute('data-card-issue-count', '3');
    await expect(legality.getByTestId('deck-legality-detail-deck-issue-count')).toHaveAttribute('data-deck-issue-count', '2');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-format-invalid', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-format-invalid', 'true');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-format-invalid', 'true');
    await pauperLabel.click();
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Pauper');
    await expect(deckRow(page, 'main', 'Mountain')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-format-invalid', 'true');
    await pauperLabel.click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await analytics.getByTestId('deck-analytics-active-detail-clear').click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    const tooltipMirror = legality.getByTestId('deck-legality-desktop-tooltip');
    await expect(tooltipMirror).toHaveAttribute('data-status', 'not-legal');
    await expect(tooltipMirror).toHaveAttribute('data-tooltip-max-errors', '20');
    await expect(tooltipMirror).toHaveAttribute('data-preview-issue-count', '5');
    await expect(tooltipMirror).toHaveAttribute('data-overflow-count', '0');
    await expect(tooltipMirror).toHaveAttribute('data-selectable-card-count', '3');
    await expect(tooltipMirror).toContainText('Deck is INVALID');
    await expect(tooltipMirror.getByTestId('deck-legality-tooltip-select-all')).toHaveText('Select 3 problem cards');
    await expect(tooltipMirror.getByTestId('deck-legality-tooltip-issue').filter({ hasText: 'Must contain at least 60 cards' })).toHaveAttribute('data-issue-kind', 'deck');
    await expect(tooltipMirror.getByTestId('deck-legality-tooltip-issue').filter({ hasText: 'Mountain' })).toHaveAttribute('data-issue-kind', 'card');
    await tooltipMirror.getByTestId('deck-legality-tooltip-select-all').click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-remove-all-button').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveCount(0);
    await startCollectionCardDrag(page, 'Lightning Bolt');
    await finishCollectionCardDragToZone(page, 'main');
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await pauperLabel.click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    const deckIssueList = legality.getByTestId('deck-legality-deck-issue-list');
    await expect(deckIssueList).toHaveAttribute('data-deck-issue-count', '2');
    await expect(deckIssueList).toContainText('Deck errors');
    await expect(deckIssueList.locator(':scope > span')).toHaveCount(1);
    await expect(deckIssueList.getByTestId('deck-legality-deck-issue')).toHaveCount(2);
    await expect(deckIssueList.locator(':scope > div')).toHaveCSS('display', 'grid');
    await expect(deckIssueList.getByTestId('deck-legality-deck-issue').filter({ hasText: 'Must contain at least 60 cards' })).toHaveAttribute('data-issue-type', 'DECK_SIZE');
    await expect(deckIssueList.getByTestId('deck-legality-deck-issue').filter({ hasText: 'Sideboard contains unsupported cards' })).toHaveAttribute('data-issue-group', 'Sideboard');
    await expect(legality.getByTestId('deck-legality-card-list')).toContainText('Problem cards');
    await expect(legality.getByTestId('deck-legality-card')).toHaveCount(3);
    await legality.getByTestId('deck-legality-card').filter({ hasText: 'Lightning Bolt' }).focus();
    await page.keyboard.press('Enter');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).not.toHaveAttribute('data-selected', 'true');
    await expect(legality.getByTestId('deck-legality-detail-status')).toContainText('Pauper');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-format-invalid', 'true');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-format-invalid', 'true');
    await pauperLabel.click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-selected', 'true');

    const mountainIssue = legality.getByTestId('deck-legality-issue').filter({ hasText: 'Mountain' });
    await expect(mountainIssue).toContainText('Card not found');
    await mountainIssue.click();
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(legality.getByTestId('deck-legality-expand-issues-button')).toHaveCount(0);
    await expect(legality.getByTestId('deck-legality-issue').filter({ hasText: 'Sideboard contains unsupported cards' })).toHaveCount(0);
    await expect(legality.getByTestId('deck-legality-issue')).toHaveCount(3);

    const edhPowerLabel = legality.getByTestId('deck-legality-edh-power-label');
    await expect(edhPowerLabel).toBeVisible();
    await expect(edhPowerLabel).toHaveAttribute('data-edh-power-level', '4');
    await expect(edhPowerLabel).toHaveAttribute('data-validation-source', 'server');
    await expect(edhPowerLabel).toHaveAttribute('data-edh-power-card-count', '1');
    await expect(edhPowerLabel).toHaveAttribute('data-edh-power-detail-count', '1');
    await expect(edhPowerLabel).toHaveAttribute('title', /Click to select 1 contributing card/);
    await expect(edhPowerLabel).toHaveAttribute('aria-label', /Click to select 1 contributing card/);
    await edhPowerLabel.click();
    await expect(edhPowerLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'false');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-kind', 'edh-power');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-status', 'not-legal');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-validation-source', 'server');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-issue-count', '1');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-selectable-card-count', '1');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('aria-label', 'EDH Power legality details: level 4, 1 contributing card, 1 detail, Source Server validator. Press Escape to clear the current drilldown.');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('EDH Power');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('4');
    await expect(legality.getByTestId('deck-legality-issue').filter({ hasText: '+4 from Lightning Bolt' })).toBeVisible();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).not.toHaveAttribute('data-selected', 'true');
    await edhPowerLabel.click();
    await expect(edhPowerLabel).toHaveAttribute('aria-pressed', 'false');
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Pauper');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');

    const bracketOne = legality.getByTestId('deck-legality-bracket-label').filter({ hasText: 'B1' });
    await expect(bracketOne).toHaveAttribute('data-bracket-status', 'invalid');
    await expect(bracketOne).toHaveAttribute('data-validation-source', 'server');
    await expect(bracketOne).toHaveAttribute('data-bracket-bad-card-count', '1');
    await expect(bracketOne).toHaveAttribute('data-bracket-group-count', '1');
    await expect(bracketOne).toHaveAttribute('title', /Click to select 1 bad card/);
    await expect(bracketOne).toHaveAttribute('aria-label', /Click to select 1 bad card/);
    await bracketOne.click();
    await expect(bracketOne).toHaveAttribute('aria-pressed', 'true');
    await expect(edhPowerLabel).toHaveAttribute('aria-pressed', 'false');
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'false');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-kind', 'commander-bracket');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-detail-status', 'invalid');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-validation-source', 'server');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-issue-count', '1');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('data-selectable-card-count', '1');
    await expect(legality.getByTestId('deck-legality-details')).toHaveAttribute('aria-label', 'B1 legality details: Bad, 1 bad card, 1 group, Source Server validator. Press Escape to clear the current drilldown.');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('B1');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Bad');
    const bracketIssue = legality.getByTestId('deck-legality-issue').filter({ hasText: 'Game Changers' });
    await expect(bracketIssue).toContainText('Lightning Bolt');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await bracketOne.click();
    await expect(bracketOne).toHaveAttribute('aria-pressed', 'false');
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Pauper');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await bracketOne.click();
    await expect(bracketOne).toHaveAttribute('aria-pressed', 'true');
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'false');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('B1');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await bracketIssue.focus();
    await page.keyboard.press('Escape');
    await expect(bracketOne).toHaveAttribute('aria-pressed', 'false');
    await expect(bracketOne).toBeFocused();
    await expect(pauperLabel).toHaveAttribute('aria-pressed', 'true');
    await expect(legality.getByTestId('deck-legality-detail-summary')).toContainText('Pauper');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).not.toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-format-invalid', 'true');
    const bracketFour = legality.getByTestId('deck-legality-bracket-label').filter({ hasText: 'B4' });
    await expect(bracketFour).toHaveAttribute('data-bracket-status', 'valid');

    await legality.getByTestId('deck-legality-hide-button').click();
    await expect(legality.getByTestId('deck-legality-label')).toHaveCount(0);
    await legality.getByTestId('deck-legality-show-button').click();
    await expect(legality.getByTestId('deck-legality-label').filter({ hasText: 'Pauper' })).toBeVisible();
  });

  test('caps desktop legality tooltip details and reports overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor&legalityOverflow=1');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    const legality = page.getByTestId('deck-legality-panel');
    await expect(legality).toBeVisible();
    const pauperLabel = legality.getByTestId('deck-legality-label').filter({ hasText: 'Pauper' });
    await expect(pauperLabel).toHaveAttribute('data-legality-status', 'not-legal');
    await expect(pauperLabel).toHaveAttribute('data-validation-source', 'server');
    await expect(pauperLabel).toHaveAttribute('data-issue-count', '26');
    await pauperLabel.click();

    const tooltipMirror = legality.getByTestId('deck-legality-desktop-tooltip');
    await expect(tooltipMirror).toHaveAttribute('data-tooltip-max-errors', '20');
    await expect(tooltipMirror).toHaveAttribute('data-preview-issue-count', '20');
    await expect(tooltipMirror).toHaveAttribute('data-overflow-count', '6');
    await expect(tooltipMirror).toHaveAttribute('data-selectable-card-count', '3');
    await expect(tooltipMirror.getByTestId('deck-legality-tooltip-issue')).toHaveCount(20);
    await expect(tooltipMirror.getByTestId('deck-legality-tooltip-overflow')).toHaveText('6 more hidden by the desktop tooltip limit.');

    await tooltipMirror.getByTestId('deck-legality-tooltip-select-all').click();
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveAttribute('data-selected', 'true');
    await expect(deckRow(page, 'side', 'Naturalize')).toHaveAttribute('data-selected', 'true');
  });

  test('applies and remembers unresolved import fixes across editor and manager imports', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);

    await setTestClipboard(page, '1 Sideboard Ghost');
    const appendButton = page.getByTestId('deck-editor-paste-append-button');
    await appendButton.focus();
    await page.keyboard.press('Enter');
    const clipboardFixer = page.getByTestId('deck-import-fixer-modal');
    await expect(clipboardFixer).toBeVisible();
    await expect(clipboardFixer.getByTestId('deck-import-unresolved-card')).toContainText('Sideboard Ghost');
    await page.keyboard.press('Escape');
    await expect(clipboardFixer).toHaveCount(0);
    await expect(appendButton).toBeFocused();
    await expect(deckRow(page, 'main', 'Sideboard Ghost')).toHaveCount(0);

    await dropDeckText(page.getByTestId('deck-editor-drop-zone'), '1 Mystery Bolt');
    const fixer = page.getByTestId('deck-import-fixer-modal');
    await expect(fixer).toBeVisible();
    await expect(fixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Bolt');
    await expect(fixer).toHaveAttribute('role', 'dialog');
    const replacementSelect = fixer.getByTestId('deck-import-replacement-select');
    const importAnywayButton = fixer.getByTestId('deck-import-save-unresolved-button');
    await expect(replacementSelect).toBeFocused();
    await importAnywayButton.focus();
    await page.keyboard.press('Tab');
    await expect(replacementSelect).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(importAnywayButton).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fixer).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Mystery Bolt')).toHaveCount(0);
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('4');

    await dropDeckText(page.getByTestId('deck-editor-drop-zone'), '1 Mystery Bolt');
    await expect(fixer).toBeVisible();
    await expect(fixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Bolt');

    await fixer.getByTestId('deck-import-alternate-search-input').fill('Lightning Bolt');
    await fixer.getByTestId('deck-import-alternate-search-button').click();
    await expect(fixer.getByTestId('deck-import-search-status')).toHaveText('1 replacement option loaded.');
    await fixer.getByTestId('deck-import-replacement-select').selectOption({ label: 'Lightning Bolt [M11:149]' });
    await fixer.getByTestId('deck-import-apply-fixes-button').click();

    await expect(fixer).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Appended Dropped Deck.');
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('5');
    await expect.poll(async () => readCardResolverFixes(page)).toMatchObject({
      'mystery bolt||': {
        name: 'Lightning Bolt',
        setCode: 'M11',
        cardNumber: '149',
      },
    });

    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await dropDeckText(page.getByTestId('deck-manager-drop-zone'), '1 Mystery Bolt');
    await expect(page.getByTestId('deck-import-fixer-modal')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Imported Dropped Deck.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Dropped Deck' })).toBeVisible();

    await expect.poll(async () => readStoredDeck(page, 'Dropped Deck')).toMatchObject({
      cards: [
        expect.objectContaining({
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
    });

    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await dropDeckFile(page.getByTestId('deck-editor-drop-zone'), 'Dropped Mystery Growth.dck', '1 Mystery Growth');
    const fileFixer = page.getByTestId('deck-import-fixer-modal');
    await expect(fileFixer).toBeVisible();
    await expect(fileFixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Growth');

    await fileFixer.getByTestId('deck-import-alternate-search-input').fill('Giant Growth');
    await fileFixer.getByTestId('deck-import-alternate-search-button').click();
    await fileFixer.getByTestId('deck-import-replacement-select').selectOption({ label: 'Giant Growth [M11:183]' });
    await fileFixer.getByTestId('deck-import-apply-fixes-button').click();

    await expect(fileFixer).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Appended Dropped Mystery Growth.');
    await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');

    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Manager Remembered Growth.dck',
      '1 Mystery Growth',
    );

    await expect(page.getByTestId('deck-import-fixer-modal')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Imported Manager Remembered Growth.');
    await expect.poll(async () => readStoredDeck(page, 'Manager Remembered Growth')).toMatchObject({
      cards: [
        expect.objectContaining({
          cardName: 'Giant Growth',
          setCode: 'M11',
          cardNumber: '183',
        }),
      ],
    });
  });

  test('imports deck files through editor replace and manager new-deck flows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');

    await page.getByTestId('deck-editor-import-menu-button').click();
    await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
    await expect(page.getByTestId('deck-editor-import-file-option')).toContainText('Replace from file');
    await expect(page.getByTestId('deck-editor-import-clipboard-replace-option')).toContainText('Replace from clipboard');
    await expect(page.getByTestId('deck-editor-import-clipboard-append-option')).toContainText('Append from clipboard');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-editor-import-source-dialog')).toHaveCount(0);

    await page.getByTestId('deck-description-input').fill('Unsaved before import');
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Discard unsaved changes and replace the current deck with the imported file?');
      await dialog.accept();
    });
    await uploadDeckFile(
      page.getByTestId('deck-editor-file-import-input'),
      'Browser File Replace.dck',
      '1 Lightning Bolt',
    );

    await expect(page.getByRole('heading', { name: 'Browser File Replace' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Imported Browser File Replace.');
    await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Mountain')).toHaveCount(0);
    await expect.poll(async () => readDeckFileHistory(page)).toMatchObject({
      lastImport: {
        fileName: 'Browser File Replace.dck',
        deckName: 'Browser File Replace',
      },
    });

    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await page.getByTestId('deck-manager-import-menu-button').click();
    await expect(page.getByTestId('deck-manager-import-source-dialog')).toBeVisible();
    await expect(page.getByTestId('deck-manager-last-import-note')).toContainText('Browser File Replace.dck');
    await expect(page.getByTestId('deck-manager-import-file-option')).toContainText('New deck from file');
    await expect(page.getByTestId('deck-manager-import-clipboard-option')).toContainText('New deck from clipboard');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('deck-manager-import-source-dialog')).toHaveCount(0);

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser Manager File.dck',
      '2 Llanowar Elves\nSB: 1 Naturalize',
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser Manager File.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser Manager File' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser Manager File')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 2,
          cardName: 'Llanowar Elves',
          setCode: 'M12',
          cardNumber: '182',
        }),
      ],
      sideboard: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Naturalize',
          setCode: 'M11',
          cardNumber: '190',
        }),
      ],
    });

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser Stale DCK.dck',
      '1 [M11:999] Lightning Bolt',
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser Stale DCK.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser Stale DCK' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser Stale DCK')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
    });

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser Cockatrice.cod',
      `<?xml version="1.0" encoding="UTF-8"?>
      <cockatrice_deck version="1">
        <deckname>Ignored Cockatrice Name</deckname>
        <zone name="main">
          <card number="3" name="Lightning Bolt"/>
        </zone>
        <zone name="side">
          <card number="2" name="Naturalize"/>
        </zone>
      </cockatrice_deck>`,
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser Cockatrice.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser Cockatrice' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser Cockatrice')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 3,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
      sideboard: [
        expect.objectContaining({
          amount: 2,
          cardName: 'Naturalize',
          setCode: 'M11',
          cardNumber: '190',
        }),
      ],
    });

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser OCTGN.o8d',
      `<?xml version="1.0" encoding="UTF-8"?>
      <deck>
        <section name="Main">
          <card qty="2">Lightning Bolt</card>
        </section>
        <section name="Sideboard">
          <card qty="1">Naturalize</card>
        </section>
      </deck>`,
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser OCTGN.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser OCTGN' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser OCTGN')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 2,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
      sideboard: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Naturalize',
          setCode: 'M11',
          cardNumber: '190',
        }),
      ],
    });

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser MTGJSON.json',
      JSON.stringify({
        data: {
          code: 'M11',
          name: 'Ignored MTGJSON Name',
          mainBoard: [
            { count: 2, name: 'Lightning Bolt', setCode: 'M11', number: '149' },
          ],
          sideBoard: [
            { count: 1, name: 'Naturalize', number: '190' },
          ],
        },
      }),
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser MTGJSON.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser MTGJSON' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser MTGJSON')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 2,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
      sideboard: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Naturalize',
          setCode: 'M11',
          cardNumber: '190',
        }),
      ],
    });

    await uploadDeckFile(
      page.getByTestId('deck-manager-file-import-input'),
      'Browser Draft Log.draft',
      `Event #: browser-draft
      Players:
          VisualMage

      ------ M11 ------

      Pack 1 pick 1:
          Giant Growth
      --> Lightning Bolt

      Pack 1 pick 2:
      --> Naturalize
          Mountain`,
    );

    await expect(page.getByRole('status')).toContainText('Imported Browser Draft Log.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Browser Draft Log' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Browser Draft Log')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
        expect.objectContaining({
          amount: 1,
          cardName: 'Naturalize',
          setCode: 'M11',
          cardNumber: '190',
        }),
      ],
      sideboard: [],
    });
    await expect.poll(async () => readStoredDeck(page, 'Browser Draft Log')).not.toMatchObject({
      cards: expect.arrayContaining([
        expect.objectContaining({ cardName: 'Giant Growth' }),
        expect.objectContaining({ cardName: 'Mountain' }),
      ]),
    });
  });

  test('exports deck files and clipboard text from the editor and manager', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('deck-editor-export-button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('P0 Visual Smoke.dck');
    const exportedText = await downloadText(download);
    expect(exportedText).toContain('4 [M11:149] Lightning Bolt');
    expect(exportedText).toContain('4 [M12:182] Llanowar Elves');
    expect(exportedText).toContain('SB: 2 [M11:190] Naturalize');
    await expect.poll(async () => readDeckFileHistory(page)).toMatchObject({
      lastExport: {
        fileName: 'P0 Visual Smoke.dck',
        deckName: 'P0 Visual Smoke',
      },
    });

    await page.getByTestId('deck-editor-copy-button').click();
    await expect(page.getByRole('status')).toContainText('Copied P0 Visual Smoke to clipboard.');
    await expect.poll(async () => readTestClipboard(page)).toContain('4 [M11:149] Lightning Bolt');
    await expect.poll(async () => readTestClipboard(page)).toContain('SB: 2 [M11:190] Naturalize');

    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);
    await page.getByTestId('deck-manager-import-menu-button').click();
    await expect(page.getByTestId('deck-manager-last-export-note')).toContainText('P0 Visual Smoke.dck');
    await page.keyboard.press('Escape');

    const managerDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('deck-manager-export-button').click();
    const managerDownload = await managerDownloadPromise;
    expect(managerDownload.suggestedFilename()).toBe('P0 Visual Smoke.dck');
    const managerExportedText = await downloadText(managerDownload);
    expect(managerExportedText).toContain('4 [M11:149] Lightning Bolt');
    expect(managerExportedText).toContain('SB: 2 [M11:190] Naturalize');

    await page.getByTestId('deck-export-clipboard-button').click();
    await expect(page.getByRole('status')).toContainText('Copied P0 Visual Smoke to clipboard.');
    await expect.poll(async () => readTestClipboard(page)).toContain('4 [M11:149] Lightning Bolt');
    await expect.poll(async () => readTestClipboard(page)).toContain('SB: 2 [M11:190] Naturalize');
  });

  test('imports clipboard decks through manager new-deck and editor replace and append flows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoVisual(page, '/visual.html?scenario=deck-manager');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);
    await setTestClipboard(page, '1 Lightning Bolt');
    await page.getByTestId('deck-manager-import-menu-button').click();
    await expect(page.getByTestId('deck-manager-import-source-dialog')).toBeVisible();
    await page.getByTestId('deck-manager-import-clipboard-option').click();

    await expect(page.getByRole('status')).toContainText('Imported Clipboard Deck.');
    await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Clipboard Deck' })).toBeVisible();
    await expect.poll(async () => readStoredDeck(page, 'Clipboard Deck')).toMatchObject({
      cards: [
        expect.objectContaining({
          amount: 1,
          cardName: 'Lightning Bolt',
          setCode: 'M11',
          cardNumber: '149',
        }),
      ],
    });

    await gotoVisual(page, '/visual.html?scenario=deck-editor');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await installClipboardShim(page);
    await expect(page.getByTestId('deck-editor-paste-replace-button')).toHaveText('Replace');
    await expect(page.getByTestId('deck-editor-paste-replace-button')).toHaveAttribute('title', 'Replace current deck from clipboard');
    await expect(page.getByTestId('deck-editor-paste-append-button')).toHaveText('Append');
    await expect(page.getByTestId('deck-editor-paste-append-button')).toHaveAttribute('title', 'Append clipboard deck to current deck');
    await setTestClipboard(page, '1 Giant Growth');
    await page.getByTestId('deck-description-input').fill('Unsaved before paste');
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('Discard unsaved changes and replace the current deck with clipboard contents?');
      await dialog.accept();
    });
    await page.getByTestId('deck-editor-import-menu-button').click();
    await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
    await page.getByTestId('deck-editor-import-clipboard-replace-option').click();

    await expect(page.getByRole('heading', { name: 'Clipboard Deck' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Imported Clipboard Deck.');
    await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveCount(0);

    await setTestClipboard(page, '1 Naturalize');
    await page.getByTestId('deck-editor-import-menu-button').click();
    await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
    await page.getByTestId('deck-editor-import-clipboard-append-option').click();
    await expect(page.getByRole('status')).toContainText('Appended Clipboard Append.');
    await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
    await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
  });
});

function deckRow(page: import('@playwright/test').Page, zone: 'main' | 'side', cardName: string) {
  return page.locator(`[data-testid="deck-card-row"][data-zone="${zone}"]`).filter({ hasText: cardName });
}

function activityDeckRow(page: import('@playwright/test').Page, zone: 'main' | 'side', cardName: string) {
  return page.locator(`[data-testid="activity-deck-editor-row"][data-zone="${zone}"][data-card-name="${cardName}"]`);
}

function collectionCard(page: import('@playwright/test').Page, cardName: string) {
  return page.locator('.collection-browser').getByRole('img', { name: cardName });
}

function collectionCardWrapper(page: import('@playwright/test').Page, cardName: string) {
  return page.locator(`[data-testid="deck-editor-collection-card"][data-card-name="${cardName}"]`).first();
}

function collectionCards(page: import('@playwright/test').Page) {
  return page.locator('.collection-browser [data-testid="deck-editor-collection-card"]');
}

async function dragDeckRowToZone(
  page: import('@playwright/test').Page,
  sourceZone: 'main' | 'side',
  cardName: string,
  targetZone: 'main' | 'side',
) {
  await startDeckRowDrag(page, sourceZone, cardName);
  await finishDeckRowDragToZone(page, targetZone);
}

async function dispatchDeckRowDoubleClick(
  page: import('@playwright/test').Page,
  zone: 'main' | 'side',
  cardName: string,
  options: { altKey?: boolean } = {},
) {
  await deckRow(page, zone, cardName).evaluate((source, eventOptions) => {
    source.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      altKey: Boolean(eventOptions.altKey),
    }));
  }, options);
}

async function dispatchDeckRowCheckboxClick(
  page: import('@playwright/test').Page,
  zone: 'main' | 'side',
  cardName: string,
) {
  await deckRow(page, zone, cardName).getByTestId('deck-card-select-checkbox').evaluate((source) => {
    (source as HTMLInputElement).click();
  });
}

async function startDeckRowDrag(
  page: import('@playwright/test').Page,
  sourceZone: 'main' | 'side',
  cardName: string,
) {
  await deckRow(page, sourceZone, cardName).evaluate((source) => {
    const dataTransfer = new DataTransfer();
    (window as typeof window & { __mageDeckRowDragDataTransfer?: DataTransfer }).__mageDeckRowDragDataTransfer = dataTransfer;
    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    source.dispatchEvent(new DragEvent('dragstart', eventInit));
  });
}

async function finishDeckRowDragToZone(
  page: import('@playwright/test').Page,
  targetZone: 'main' | 'side',
) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) {
      throw new Error(`Missing drop target ${targetSelector}`);
    }

    const dataTransfer = (window as typeof window & { __mageDeckRowDragDataTransfer?: DataTransfer }).__mageDeckRowDragDataTransfer;
    if (!dataTransfer) {
      throw new Error('Missing deck row drag data transfer');
    }

    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    target.dispatchEvent(new DragEvent('dragover', eventInit));
    target.dispatchEvent(new DragEvent('drop', eventInit));
    const source = document.querySelector('[data-testid="deck-card-row"][data-dragging="true"]');
    if (!source) {
      throw new Error('Missing active deck row drag source');
    }
    source.dispatchEvent(new DragEvent('dragend', eventInit));
    delete (window as typeof window & { __mageDeckRowDragDataTransfer?: DataTransfer }).__mageDeckRowDragDataTransfer;
  }, `[data-testid="deck-section-${targetZone === 'main' ? 'main' : 'sideboard'}"]`);
}

async function startCollectionCardDrag(
  page: import('@playwright/test').Page,
  cardName: string,
) {
  await collectionCardWrapper(page, cardName).evaluate((source) => {
    const dataTransfer = new DataTransfer();
    (window as typeof window & { __mageCollectionCardDragDataTransfer?: DataTransfer }).__mageCollectionCardDragDataTransfer = dataTransfer;
    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    source.dispatchEvent(new DragEvent('dragstart', eventInit));
  });
}

async function finishCollectionCardDragToZone(
  page: import('@playwright/test').Page,
  targetZone: 'main' | 'side',
) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) {
      throw new Error(`Missing collection drop target ${targetSelector}`);
    }

    const dataTransfer = (window as typeof window & { __mageCollectionCardDragDataTransfer?: DataTransfer }).__mageCollectionCardDragDataTransfer;
    if (!dataTransfer) {
      throw new Error('Missing collection card drag data transfer');
    }

    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    target.dispatchEvent(new DragEvent('dragover', eventInit));
    target.dispatchEvent(new DragEvent('drop', eventInit));
    const source = document.querySelector('[data-testid="deck-editor-collection-card"][data-dragging="true"]');
    if (!source) {
      throw new Error('Missing active collection card drag source');
    }
    source.dispatchEvent(new DragEvent('dragend', eventInit));
    delete (window as typeof window & { __mageCollectionCardDragDataTransfer?: DataTransfer }).__mageCollectionCardDragDataTransfer;
  }, `[data-testid="deck-section-${targetZone === 'main' ? 'main' : 'sideboard'}"]`);
}

async function startActivityDeckRowDrag(
  page: import('@playwright/test').Page,
  sourceZone: 'main' | 'side',
  cardName: string,
) {
  await activityDeckRow(page, sourceZone, cardName).evaluate((source) => {
    const dataTransfer = new DataTransfer();
    (window as typeof window & { __mageActivityDeckRowDragDataTransfer?: DataTransfer }).__mageActivityDeckRowDragDataTransfer = dataTransfer;
    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    source.dispatchEvent(new DragEvent('dragstart', eventInit));
  });
}

async function finishActivityDeckRowDragToZone(
  page: import('@playwright/test').Page,
  targetZone: 'main' | 'side',
) {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) {
      throw new Error(`Missing activity deck drop target ${targetSelector}`);
    }

    const dataTransfer = (window as typeof window & { __mageActivityDeckRowDragDataTransfer?: DataTransfer }).__mageActivityDeckRowDragDataTransfer;
    if (!dataTransfer) {
      throw new Error('Missing activity deck row drag data transfer');
    }

    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    target.dispatchEvent(new DragEvent('dragover', eventInit));
    target.dispatchEvent(new DragEvent('drop', eventInit));
    const source = document.querySelector('[data-testid="activity-deck-editor-row"][data-dragging="true"]');
    if (!source) {
      throw new Error('Missing active activity deck row drag source');
    }
    source.dispatchEvent(new DragEvent('dragend', eventInit));
    delete (window as typeof window & { __mageActivityDeckRowDragDataTransfer?: DataTransfer }).__mageActivityDeckRowDragDataTransfer;
  }, `[data-testid="activity-deck-editor-${targetZone}"]`);
}

async function dropDeckText(locator: import('@playwright/test').Locator, text: string) {
  await locator.evaluate((target, deckText) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', deckText);
    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    target.dispatchEvent(new DragEvent('dragenter', eventInit));
    target.dispatchEvent(new DragEvent('dragover', eventInit));
    target.dispatchEvent(new DragEvent('drop', eventInit));
  }, text);
}

async function dropDeckFile(locator: import('@playwright/test').Locator, fileName: string, text: string) {
  await locator.evaluate((target, { name, deckText }) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([deckText], name, { type: 'text/plain' }));
    const eventInit: DragEventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    };

    target.dispatchEvent(new DragEvent('dragenter', eventInit));
    target.dispatchEvent(new DragEvent('dragover', eventInit));
    target.dispatchEvent(new DragEvent('drop', eventInit));
  }, { name: fileName, deckText: text });
}

async function uploadDeckFile(locator: import('@playwright/test').Locator, fileName: string, text: string) {
  await locator.setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(text, 'utf8'),
  });
}

async function downloadText(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  if (!stream) return '';

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function installClipboardShim(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => localStorage.getItem('mage.test.clipboard') ?? '',
        writeText: async (text: string) => {
          localStorage.setItem('mage.test.clipboard', text);
        },
      },
    });
  });
}

async function setTestClipboard(page: import('@playwright/test').Page, text: string) {
  await page.evaluate((clipboardText) => {
    localStorage.setItem('mage.test.clipboard', clipboardText);
  }, text);
}

async function setRangeValue(locator: import('@playwright/test').Locator, value: string) {
  await locator.evaluate((input, nextValue) => {
    if (!(input instanceof HTMLInputElement)) return;
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function readStoredDecksMeta(page: import('@playwright/test').Page): Promise<Array<{ id: string; name: string }>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mage_decks_meta') ?? '[]'));
}

async function readStoredDeck(page: import('@playwright/test').Page, name: string): Promise<Record<string, unknown> | null> {
  return page.evaluate((deckName) => {
    const meta = JSON.parse(localStorage.getItem('mage_decks_meta') ?? '[]') as Array<{ id: string; name: string }>;
    const entry = meta.find(deck => deck.name === deckName);
    if (!entry) return null;
    return JSON.parse(localStorage.getItem(`mage_deck_${entry.id}`) ?? 'null') as Record<string, unknown> | null;
  }, name);
}

async function readGeneratorSettings(page: import('@playwright/test').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckGenerator.v1') ?? 'null') as Record<string, unknown> | null);
}

async function readDeckFileHistory(page: import('@playwright/test').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckFileHistory.v1') ?? 'null') as Record<string, unknown> | null);
}

async function seedPromotedActivityEditorConfig(
  page: import('@playwright/test').Page,
  options: {
    mode: 'normal' | 'limited' | 'sideboard' | 'draft';
    collectionView: 'grid' | 'list';
    collectionSortBy: 'name' | 'cardType' | 'manaValue' | 'color' | 'rarity' | 'cardNumber';
    searchText: string;
    deckSortBy: 'custom' | 'name' | 'amount' | 'set' | 'type' | 'color' | 'manaValue';
    deckSortDirection: 'asc' | 'desc';
    showSideboard: boolean;
    deckPanelWidth: number;
    searchNames: boolean;
    searchTypes: boolean;
    searchRules: boolean;
    uniqueNames: boolean;
    piles: boolean;
  },
) {
  await page.addInitScript((configOptions) => {
    localStorage.setItem('mage.client.deckEditor.v1', JSON.stringify({
      activeMode: configOptions.mode,
      modes: {
        [configOptions.mode]: {
          collectionView: configOptions.collectionView,
          collectionSortBy: configOptions.collectionSortBy,
          deckSortBy: configOptions.deckSortBy,
          deckSortDirection: configOptions.deckSortDirection,
          showSideboard: configOptions.showSideboard,
          deckPanelWidth: configOptions.deckPanelWidth,
          search: {
            searchText: configOptions.searchText,
            nameContains: configOptions.searchText,
            searchNames: configOptions.searchNames,
            searchTypes: configOptions.searchTypes,
            searchRules: configOptions.searchRules,
            uniqueNames: configOptions.uniqueNames,
            piles: configOptions.piles,
          },
        },
      },
    }));
  }, options);
}

async function readDeckEditorConfig(page: import('@playwright/test').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckEditor.v1') ?? 'null') as Record<string, unknown> | null);
}

async function readCardResolverFixes(page: import('@playwright/test').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.cardResolverFixes.v1') ?? 'null') as Record<string, unknown> | null);
}

async function readTestClipboard(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('mage.test.clipboard') ?? '');
}
