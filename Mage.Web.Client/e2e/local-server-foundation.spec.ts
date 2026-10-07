import {
    configureLocalServerSuite,
    escapeRegExp,
    expect,
    LocalServerHarness,
    SMOKE_DECK,
    test,
} from './helpers/localServerHarness';
import type { Download, Locator, Page } from '@playwright/test';

test.describe('local Mage server foundation smoke', () => {
    configureLocalServerSuite();

    let harness: LocalServerHarness;

    test.beforeEach(async ({ page }, testInfo) => {
        harness = new LocalServerHarness(page, testInfo);
        await harness.login();
    });

    test.afterEach(async () => {
        await harness.cleanup();
    });

    test('logs in and reaches the lobby shell', async ({ page }) => {
        await harness.expectLobbyReady();
        await expect(page.getByText(/Disconnected|Connected|Reconnecting/)).not.toBeVisible();
    });

    test('imports a deck through the deck manager and exposes it for export/edit', async ({ page }) => {
        await page.getByRole('button', { name: 'Decks' }).click();
        await harness.expectDeckManagerReady();

        await page.getByTestId('deck-manager-import-menu-button').click();
        await expect(page.getByTestId('deck-manager-import-source-dialog')).toBeVisible();
        await expect(page.getByTestId('deck-manager-import-file-option')).toContainText('New deck from file');
        await expect(page.getByTestId('deck-manager-import-clipboard-option')).toContainText('New deck from clipboard');
        await page.keyboard.press('Escape');

        await page.locator('input[type="file"]').setInputFiles({
            name: 'web-p05-smoke.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from(SMOKE_DECK),
        });

        const importedDeckCard = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'web-p05-smoke' });
        await expect(importedDeckCard).toBeVisible({ timeout: 15_000 });
        await expect(importedDeckCard).toHaveClass(/selected/);
        await expect(page.getByRole('button', { name: 'EXPORT' })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'COPY' })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Edit Deck' })).toBeEnabled();

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'EXPORT' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('web-p05-smoke.dck');
        const exportedText = await downloadText(download);
        expect(exportedText).toContain('4 [M11:149] Lightning Bolt');
        expect(exportedText).toContain('56 [M11:244] Mountain');

        await installClipboardShim(page);
        await page.getByRole('button', { name: 'COPY' }).click();
        await expect(page.getByRole('status')).toContainText('Copied web-p05-smoke to clipboard.');
        await expect.poll(async () => readTestClipboard(page)).toContain('4 [M11:149] Lightning Bolt');
        await expect.poll(async () => readTestClipboard(page)).toContain('56 [M11:244] Mountain');

        await page.getByTestId('deck-manager-file-import-input').setInputFiles({
            name: 'web-p05-stale-dck.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from('1 [M11:999] Lightning Bolt'),
        });

        await expect(page.getByRole('status')).toContainText('Imported web-p05-stale-dck.');
        const staleDeckCard = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'web-p05-stale-dck' });
        await expect(staleDeckCard).toBeVisible({ timeout: 15_000 });
        await expect(staleDeckCard).toHaveClass(/selected/);

        const staleDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'EXPORT' }).click();
        const staleDownload = await staleDownloadPromise;
        expect(staleDownload.suggestedFilename()).toBe('web-p05-stale-dck.dck');
        const staleExportedText = await downloadText(staleDownload);
        expect(staleExportedText).toContain('1 [M11:149] Lightning Bolt');
        expect(staleExportedText).not.toContain('M11:999');

        await importManagerFileAndExpectExport(page, {
            fileName: 'web-p05-stale-name.dck',
            statusName: 'web-p05-stale-name',
            content: '1 [M11:149] Old Bolt Name',
            expectedExportLines: [
                '1 [M11:149] Lightning Bolt',
            ],
            unexpectedExportLines: [
                'Old Bolt Name',
            ],
        });

        await importManagerFileAndExpectExport(page, {
            fileName: 'web-p05-cockatrice.cod',
            statusName: 'web-p05-cockatrice',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1">
  <deckname>Ignored Cockatrice Name</deckname>
  <zone name="main">
    <card number="3" name="Lightning Bolt"/>
  </zone>
  <zone name="side">
    <card number="2" name="Naturalize"/>
  </zone>
</cockatrice_deck>`,
            expectedExportPatterns: [
                /^3 \[[A-Z0-9]+:[^\]]+\] Lightning Bolt$/m,
                /^SB: 2 \[[A-Z0-9]+:[^\]]+\] Naturalize$/m,
            ],
        });

        await importManagerFileAndExpectExport(page, {
            fileName: 'web-p05-octgn.o8d',
            statusName: 'web-p05-octgn',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<deck>
  <section name="Main">
    <card qty="2">Lightning Bolt</card>
  </section>
  <section name="Sideboard">
    <card qty="1">Naturalize</card>
  </section>
</deck>`,
            expectedExportPatterns: [
                /^2 \[[A-Z0-9]+:[^\]]+\] Lightning Bolt$/m,
                /^SB: 1 \[[A-Z0-9]+:[^\]]+\] Naturalize$/m,
            ],
        });

        await importManagerFileAndExpectExport(page, {
            fileName: 'web-p05-mtgjson.json',
            statusName: 'web-p05-mtgjson',
            content: JSON.stringify({
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
            expectedExportLines: [
                '2 [M11:149] Lightning Bolt',
            ],
            expectedExportPatterns: [
                /^SB: 1 \[[A-Z0-9]+:[^\]]+\] Naturalize$/m,
            ],
        });

        await importManagerFileAndExpectExport(page, {
            fileName: 'web-p05-draft-log.draft',
            statusName: 'web-p05-draft-log',
            content: `Event #: web-p05-draft
Players:
    LocalMage

------ M11 ------

Pack 1 pick 1:
    Giant Growth
--> Lightning Bolt

Pack 1 pick 2:
--> Naturalize
    Mountain`,
            expectedExportLines: [
                '1 [M11:149] Lightning Bolt',
            ],
            expectedExportPatterns: [
                /^1 \[M11:[^\]]+\] Naturalize$/m,
            ],
            unexpectedExportLines: [
                'Giant Growth',
                'Mountain',
            ],
        });

        await importedDeckCard.click();
        await expect(importedDeckCard).toHaveClass(/selected/);
        await page.getByRole('button', { name: 'Edit Deck' }).click();
        await expect(page.getByRole('heading', { name: 'web-p05-smoke' })).toBeVisible({ timeout: 15_000 });

        const analytics = page.getByTestId('deck-analytics-panel');
        await expect(analytics).toBeVisible();
        await expect(analytics.getByTestId('deck-analytics-status')).toHaveText(/Ready|Partial/, { timeout: 15_000 });
        await expect(analytics.getByTestId('deck-analytics-stat-main')).toContainText('60/60');
        await expect(analytics.getByTestId('deck-analytics-stat-side')).toContainText('0/15');
        await expect(analytics.getByTestId('deck-analytics-stat-total')).toContainText('60');
        await expect(analytics.getByTestId('deck-analytics-stat-unique')).toContainText('2');
        await expect(analytics.getByTestId('deck-analytics-stat-nonland')).toContainText('4');
        await expect(analytics.getByTestId('deck-analytics-stat-average-mana')).toContainText('1');
        await expect(analytics.getByTestId('deck-analytics-color-red')).toContainText('4');
        await expect(analytics.getByTestId('deck-analytics-color-colorless')).toContainText('56');
        await expect(analytics.getByTestId('deck-analytics-curve-1')).toHaveAttribute('title', 'Mana value 1: 4');
        await expect(analytics.getByTestId('deck-analytics-mana-pip-red')).toHaveAttribute('aria-label', 'Casting Costs Red: 4');
        await expect(analytics.getByTestId('deck-analytics-land-source-mountain')).toHaveAttribute('aria-label', 'Basic Lands Mountain: 56');
        await expect(analytics.getByTestId('deck-analytics-mana-source-red')).toHaveAttribute('aria-label', 'Mana Sources Red: 56');
        await expect(analytics.getByTestId('deck-analytics-mana-distribution-1')).toHaveAttribute('aria-label', 'Mana value 1 pips: 4');
        await expect(analytics.getByTestId('deck-analytics-mana-distribution-1-red')).toHaveAttribute('title', '1 Red: 4');
        await expect(analytics.getByTestId('deck-analytics-type-instant')).toContainText('4');
        await expect(analytics.getByTestId('deck-analytics-type-land')).toContainText('56');
        await analytics.getByTestId('deck-analytics-color-red').click();
        await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Red cards');
        await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('4');
        await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Lightning Bolt');
        await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');
        await expect(deckRow(page, 'main', 'Mountain')).not.toHaveAttribute('data-selected', 'true');
        await analytics.getByTestId('deck-analytics-mana-distribution-1').click();
        await expect(analytics.getByTestId('deck-analytics-active-detail-title')).toHaveText('Mana value 1 spread');
        await expect(analytics.getByTestId('deck-analytics-active-detail-count')).toHaveText('4');
        await expect(analytics.getByTestId('deck-analytics-active-detail-names')).toContainText('Lightning Bolt');
        await analytics.getByTestId('deck-analytics-active-detail-clear').click();
        await expect(analytics.getByTestId('deck-analytics-active-detail')).toHaveCount(0);

        const legality = page.getByTestId('deck-legality-panel');
        await expect(legality).toBeVisible();
        await deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input').fill('5');
        const standardLabel = legality.getByTestId('deck-legality-label').filter({ hasText: 'Standard' });
        await expect(standardLabel).toHaveAttribute('data-legality-status', 'not-legal', { timeout: 20_000 });
        await standardLabel.click();
        await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-status', 'not-legal');
        await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-format', 'Standard');
        await expect(legality.getByTestId('deck-legality-detail-status')).toHaveAttribute('data-validation-source', 'server');
        await expect(legality.getByTestId('deck-legality-detail-status')).toContainText('Invalid');
        const tooManyBoltIssue = legality.getByTestId('deck-legality-issue').filter({ hasText: 'Lightning Bolt' }).filter({ hasText: 'Too many: 5' });
        await expect(tooManyBoltIssue).toBeVisible({ timeout: 15_000 });
        await tooManyBoltIssue.click();
        await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveAttribute('data-selected', 'true');

        await page.getByTestId('deck-editor-import-menu-button').click();
        await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
        await expect(page.getByTestId('deck-editor-import-file-option')).toContainText('Replace from file');
        await expect(page.getByTestId('deck-editor-import-clipboard-replace-option')).toContainText('Replace from clipboard');
        await expect(page.getByTestId('deck-editor-import-clipboard-append-option')).toContainText('Append from clipboard');
        await page.keyboard.press('Escape');

        await page.getByTestId('deck-description-input').fill('Unsaved before live editor import');
        page.once('dialog', async dialog => {
            expect(dialog.message()).toBe('Discard unsaved changes and replace the current deck with the imported file?');
            await dialog.accept();
        });
        await page.getByTestId('deck-editor-file-import-input').setInputFiles({
            name: 'web-p05-editor-replace.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from('1 Giant Growth\n'),
        });

        await expect(page.getByRole('heading', { name: 'web-p05-editor-replace' })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('status')).toContainText('Imported web-p05-editor-replace.');
        await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(deckRow(page, 'main', 'Lightning Bolt')).toHaveCount(0);

        await setTestClipboard(page, '1 Naturalize');
        await page.getByTestId('deck-editor-import-menu-button').click();
        await expect(page.getByTestId('deck-editor-import-source-dialog')).toBeVisible();
        await page.getByTestId('deck-editor-import-clipboard-append-option').click();
        await expect(page.getByRole('status')).toContainText('Appended Clipboard Append.');
        await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');

        await page.getByTestId('deck-editor-add-lands-button').click();
        const addLandsModal = page.getByTestId('deck-add-lands-modal');
        await expect(addLandsModal).toBeVisible();
        await addLandsModal.getByTestId('deck-add-lands-set-search-input').fill('m11');
        await expect(addLandsModal.getByTestId('deck-add-lands-set-option-any')).toBeVisible();
        await addLandsModal.getByTestId('deck-add-lands-set-option-any').click();
        await expect(addLandsModal.getByTestId('deck-add-lands-set-input')).toHaveValue('');
        await addLandsModal.getByLabel('Mountain count').fill('1');
        await addLandsModal.getByTestId('deck-add-lands-zone-select').selectOption('side');
        await addLandsModal.getByTestId('deck-add-lands-submit-button').click();
        await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Added 1 basic land to sideboard.');
        await expect(deckRow(page, 'side', 'Mountain').getByTestId('deck-card-count-input')).toHaveValue('1');

        const mainGiantGrowth = deckRow(page, 'main', 'Giant Growth');
        const mainNaturalize = deckRow(page, 'main', 'Naturalize');
        const sideNaturalize = deckRow(page, 'side', 'Naturalize');

        await mainNaturalize.getByTestId('deck-card-count-input').fill('2');
        await expect(mainNaturalize.getByTestId('deck-card-count-input')).toHaveValue('2');

        await startDeckRowDrag(page, 'main', 'Naturalize');
        await expect(mainNaturalize).toHaveAttribute('data-dragging', 'true');
        await expect(mainNaturalize.getByTestId('deck-card-count-input')).toHaveValue('2');
        await finishDeckRowDragToZone(page, 'side');
        await expect(mainNaturalize.getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(sideNaturalize.getByTestId('deck-card-count-input')).toHaveValue('1');

        await mainNaturalize.dblclick({ modifiers: ['Alt'] });
        await expect(mainNaturalize).toHaveCount(0);
        await expect(sideNaturalize.getByTestId('deck-card-count-input')).toHaveValue('2');

        await mainGiantGrowth.dblclick();
        await expect(mainGiantGrowth).toHaveCount(0);

        await sideNaturalize.getByTestId('deck-card-select-checkbox').check();
        await expect(page.getByTestId('deck-selected-count')).toHaveText('1 selected');
        await page.getByTestId('deck-remove-selected-button').click();
        await expect(sideNaturalize).toHaveCount(0);
        await expect(page.getByTestId('deck-selection-toolbar')).toHaveCount(0);

        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await page.getByTestId('deck-editor-card-name-filter').fill('Aang');
        await page.getByTestId('deck-editor-collection-list-button').click();
        await page.getByRole('checkbox', { name: 'Deck' }).uncheck();
        await page.getByRole('checkbox', { name: 'Types' }).uncheck();
        await page.getByRole('checkbox', { name: 'Rules' }).uncheck();
        await page.getByRole('checkbox', { name: 'Unique' }).check();
        await page.getByRole('button', { name: 'Search cards' }).click();
        await expect(collectionCard(page, /Aang/).first()).toBeVisible({ timeout: 20_000 });
        await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
            modes: {
                normal: {
                    collectionView: 'list',
                    search: {
                        nameContains: 'Aang',
                        uniqueNames: true,
                    },
                },
            },
        });

        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await page.getByTestId('deck-editor-collection-list-button').click();
        await page.getByTestId('deck-editor-set-code-filter').fill('M11');
        await page.getByTestId('deck-editor-color-filter-red').click();
        await page.getByTestId('deck-editor-mana-value-operator').selectOption('lte');
        await page.getByTestId('deck-editor-mana-value-filter').fill('1');
        await page.getByRole('button', { name: 'Search cards' }).click();
        await expect.poll(async () => collectionCards(page).count(), { timeout: 20_000 }).toBeGreaterThan(0);
        await expect.poll(async () => collectionCardMetadata(page)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Lightning Bolt', setCode: 'M11', red: true, manaValue: 1 }),
            ]),
        );
        await expect.poll(async () => collectionCardMetadata(page)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ setCode: 'M11', red: true, manaValue: expect.any(Number) }),
            ]),
        );
        for (const card of await collectionCardMetadata(page)) {
            expect(card.setCode).toBe('M11');
            expect(card.red).toBe(true);
            expect(card.manaValue).toBeLessThanOrEqual(1);
        }

        await page.getByTestId('deck-editor-generate-button').click();
        const generatorModal = page.getByTestId('deck-generator-modal');
        await expect(generatorModal).toBeVisible();
        await generatorModal.getByTestId('deck-generator-format-input').fill('TLA');
        await generatorModal.getByLabel('Green').click();
        await generatorModal.getByRole('button', { name: '40' }).click();
        page.once('dialog', async dialog => {
            expect(dialog.message()).toBe('Discard unsaved changes and replace this deck with a generated deck?');
            await dialog.accept();
        });
        await generatorModal.getByTestId('deck-generator-submit-button').click();

        await expect(page.getByTestId('deck-generator-modal')).toHaveCount(0, { timeout: 25_000 });
        await expect(page.getByRole('status')).toContainText(/Generated Generated-Deck-.* from .*green/i, { timeout: 15_000 });
        await expect(page.getByRole('status')).not.toContainText(/timed out|available pool was too small/i);
        await expect(page.getByTestId('deck-section-main').locator('.section-count')).toHaveText('40');
        await expect.poll(async () => page.getByTestId('deck-section-main').getByTestId('deck-card-row').count()).toBeGreaterThan(1);
        await expect(page.getByTestId('deck-section-main').getByTestId('deck-card-row').filter({ hasText: /Forest/ })).toHaveCount(1);
        await expect.poll(async () => (
            page.getByTestId('deck-section-main').locator('[data-set-code="TLA"][data-card-name]:not([data-card-name="Forest"])').count()
        )).toBeGreaterThan(0);
        await expect.poll(async () => readGeneratorSettings(page)).toMatchObject({
            deckSize: 40,
            format: 'TLA',
        });
        await expect.poll(async () => readGeneratorSettings(page)).toHaveProperty('colors', expect.arrayContaining(['green']));
    });

    test('fixes an unresolved imported deck card against the live server', async ({ page }) => {
        await page.getByRole('button', { name: 'Decks' }).click();
        await harness.expectDeckManagerReady();

        await page.getByTestId('deck-manager-file-import-input').setInputFiles({
            name: 'web-p05-unresolved.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from('1 Mystery Bolt\n'),
        });

        const fixer = page.getByTestId('deck-import-fixer-modal');
        await expect(fixer).toBeVisible({ timeout: 15_000 });
        await expect(fixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Bolt');

        await fixer.getByTestId('deck-import-alternate-search-input').fill('Lightning Bolt');
        await fixer.getByTestId('deck-import-alternate-search-button').click();
        await selectReplacementContaining(fixer.getByTestId('deck-import-replacement-select'), 'Lightning Bolt');
        await fixer.getByTestId('deck-import-apply-fixes-button').click();

        await expect(fixer).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Imported web-p05-unresolved.');
        const fixedDeckCard = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'web-p05-unresolved' });
        await expect(fixedDeckCard).toBeVisible({ timeout: 15_000 });
        await expect(fixedDeckCard).toHaveClass(/selected/);

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'EXPORT' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('web-p05-unresolved.dck');
        const exportedText = await downloadText(download);
        expect(exportedText).toContain('1 ');
        expect(exportedText).toContain('Lightning Bolt');
        expect(exportedText).not.toContain('Mystery Bolt');

        await page.getByRole('button', { name: 'Edit Deck' }).click();
        await expect(page.getByRole('heading', { name: 'web-p05-unresolved' })).toBeVisible({ timeout: 15_000 });

        await installClipboardShim(page);
        await setTestClipboard(page, '1 Mystery Bolt');
        await page.getByTestId('deck-editor-import-menu-button').click();
        await page.getByTestId('deck-editor-import-clipboard-append-option').click();
        await expect(page.getByTestId('deck-import-fixer-modal')).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Appended Clipboard Append.');
        await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('2');

        page.once('dialog', async dialog => {
            expect(dialog.message()).toBe('Discard unsaved changes and replace the current deck with the imported file?');
            await dialog.accept();
        });
        await page.getByTestId('deck-editor-file-import-input').setInputFiles({
            name: 'web-p05-editor-unresolved-replace.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from('1 Mystery Growth\n'),
        });

        const replaceFixer = page.getByTestId('deck-import-fixer-modal');
        await expect(replaceFixer).toBeVisible({ timeout: 15_000 });
        await expect(replaceFixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Growth');
        await replaceFixer.getByTestId('deck-import-alternate-search-input').fill('Giant Growth');
        await replaceFixer.getByTestId('deck-import-alternate-search-button').click();
        await selectReplacementContaining(replaceFixer.getByTestId('deck-import-replacement-select'), 'Giant Growth');
        await replaceFixer.getByTestId('deck-import-apply-fixes-button').click();

        await expect(replaceFixer).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'web-p05-editor-unresolved-replace' })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('status')).toContainText('Imported web-p05-editor-unresolved-replace.');
        await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(deckRow(page, 'main', 'Mystery Growth')).toHaveCount(0);

        await setTestClipboard(page, '1 Mystery Naturalize');
        await page.getByTestId('deck-editor-import-menu-button').click();
        await page.getByTestId('deck-editor-import-clipboard-append-option').click();

        const appendFixer = page.getByTestId('deck-import-fixer-modal');
        await expect(appendFixer).toBeVisible({ timeout: 15_000 });
        await expect(appendFixer.getByTestId('deck-import-unresolved-card')).toContainText('Mystery Naturalize');
        await appendFixer.getByTestId('deck-import-alternate-search-input').fill('Naturalize');
        await appendFixer.getByTestId('deck-import-alternate-search-button').click();
        await selectReplacementContaining(appendFixer.getByTestId('deck-import-replacement-select'), 'Naturalize');
        await appendFixer.getByTestId('deck-import-apply-fixes-button').click();

        await expect(appendFixer).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Appended Clipboard Append.');
        await expect(deckRow(page, 'main', 'Giant Growth').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(deckRow(page, 'main', 'Naturalize').getByTestId('deck-card-count-input')).toHaveValue('1');
        await expect(deckRow(page, 'main', 'Mystery Naturalize')).toHaveCount(0);

        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Discard unsaved changes');
            await dialog.accept();
        });
        await page.getByRole('button', { name: 'Decks' }).click();
        await harness.expectDeckManagerReady();

        await dropDeckText(page.getByTestId('deck-manager-drop-zone'), '1 Mystery Naturalize');
        await expect(page.getByTestId('deck-import-fixer-modal')).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Imported Dropped Deck.');
        const droppedTextDeck = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'Dropped Deck' });
        await expect(droppedTextDeck).toBeVisible({ timeout: 15_000 });
        await expect(droppedTextDeck).toHaveClass(/selected/);

        const droppedTextDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'EXPORT' }).click();
        const droppedTextDownload = await droppedTextDownloadPromise;
        expect(await downloadText(droppedTextDownload)).toContain('Naturalize');

        await dropDeckFile(page.getByTestId('deck-manager-drop-zone'), 'web-p05-dropped-growth.dck', '1 Mystery Growth');
        await expect(page.getByTestId('deck-import-fixer-modal')).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('Imported web-p05-dropped-growth.');
        const droppedFileDeck = page.getByTestId('deck-manager-deck-card').filter({ hasText: 'web-p05-dropped-growth' });
        await expect(droppedFileDeck).toBeVisible({ timeout: 15_000 });
        await expect(droppedFileDeck).toHaveClass(/selected/);

        const droppedFileDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'EXPORT' }).click();
        const droppedFileDownload = await droppedFileDownloadPromise;
        const droppedFileExportedText = await downloadText(droppedFileDownload);
        expect(droppedFileExportedText).toContain('Giant Growth');
        expect(droppedFileExportedText).not.toContain('Mystery Growth');
    });

    test('saves, saves as, starts new, and loads decks while connected', async ({ page }) => {
        await page.getByRole('button', { name: 'Decks' }).click();
        await harness.expectDeckManagerReady();

        await page.getByTestId('deck-manager-file-import-input').setInputFiles({
            name: 'web-p1-round-trip.dck',
            mimeType: 'text/plain',
            buffer: Buffer.from(SMOKE_DECK),
        });

        await expect(page.getByTestId('deck-manager-deck-card').filter({ hasText: 'web-p1-round-trip' })).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: 'Edit Deck' }).click();
        await expect(page.getByRole('heading', { name: 'web-p1-round-trip' })).toBeVisible({ timeout: 15_000 });

        await page.getByTestId('deck-description-input').fill('Connected save/load notes');
        await page.getByTestId('deck-editor-save-button').click();
        await expect(page.getByRole('status')).toContainText('Saved web-p1-round-trip.');

        await page.getByTestId('deck-editor-save-as-button').click();
        await page.getByTestId('deck-editor-save-as-name-input').fill('web-p1-round-trip-copy');
        await page.getByTestId('deck-editor-save-as-submit-button').click();
        await expect(page.getByRole('status')).toContainText('Saved copy as web-p1-round-trip-copy.');

        await page.getByTestId('deck-editor-new-button').click();
        await expect(page.getByRole('heading', { name: /New Deck/ })).toBeVisible();

        await page.getByTestId('deck-editor-load-button').click();
        await expect(page.getByTestId('deck-editor-load-dialog')).toBeVisible();
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Discard unsaved changes');
            await dialog.accept();
        });
        await page.getByTestId('deck-editor-load-deck-row').filter({ hasText: 'web-p1-round-trip-copy' }).click();

        await expect(page.getByRole('heading', { name: 'web-p1-round-trip-copy' })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId('deck-description-input')).toHaveValue('Connected save/load notes');
        await expect(page.getByRole('status')).toContainText('Loaded web-p1-round-trip-copy.');
        await expect(deckRow(page, 'main', 'Lightning Bolt').getByTestId('deck-card-count-input')).toHaveValue('4');
    });

    test('creates a table and opens the join/deck-selection flow', async ({ page }) => {
        const name = harness.tableName('join flow');

        await harness.createPauperTable(name);
        await page.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(name)}`));
        await harness.pasteDeck();
        await expect(page.getByText(/60 cards/)).toBeVisible({ timeout: 20_000 });
    });
});

async function downloadText(download: Download): Promise<string> {
    const stream = await download.createReadStream();
    if (!stream) {
        throw new Error('Download stream was not available.');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function importManagerFileAndExpectExport(
    page: Page,
    options: {
        fileName: string;
        statusName: string;
        content: string;
        expectedExportLines?: string[];
        expectedExportPatterns?: RegExp[];
        unexpectedExportLines?: string[];
    },
) {
    await page.getByTestId('deck-manager-file-import-input').setInputFiles({
        name: options.fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(options.content),
    });

    await expect(page.getByRole('status')).toContainText(`Imported ${options.statusName}.`);
    const deckCard = page.getByTestId('deck-manager-deck-card').filter({ hasText: options.statusName });
    await expect(deckCard).toBeVisible({ timeout: 15_000 });
    await expect(deckCard).toHaveClass(/selected/);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'EXPORT' }).click();
    const exportedText = await downloadText(await downloadPromise);
    for (const expectedLine of options.expectedExportLines ?? []) {
        expect(exportedText).toContain(expectedLine);
    }
    for (const expectedPattern of options.expectedExportPatterns ?? []) {
        expect(exportedText).toMatch(expectedPattern);
    }
    for (const unexpectedLine of options.unexpectedExportLines ?? []) {
        expect(exportedText).not.toContain(unexpectedLine);
    }
}

async function installClipboardShim(page: Page) {
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

async function setTestClipboard(page: Page, text: string) {
    await page.evaluate((clipboardText) => {
        localStorage.setItem('mage.test.clipboard', clipboardText);
    }, text);
}

async function readTestClipboard(page: Page): Promise<string> {
    return page.evaluate(() => localStorage.getItem('mage.test.clipboard') ?? '');
}

function deckRow(page: Page, zone: 'main' | 'side', cardName: string) {
    return page.locator(`[data-testid="deck-card-row"][data-zone="${zone}"]`).filter({ hasText: cardName });
}

function collectionCard(page: Page, cardName: string | RegExp) {
    return page.locator('.collection-browser').getByRole('img', { name: cardName });
}

function collectionCards(page: Page) {
    return page.locator('.collection-browser [data-testid="deck-editor-collection-card"]');
}

async function collectionCardMetadata(page: Page): Promise<Array<{ name: string; setCode: string; red: boolean; manaValue: number }>> {
    return collectionCards(page).evaluateAll(cards => cards.map(card => ({
        name: card.getAttribute('data-card-name') ?? '',
        setCode: card.getAttribute('data-set-code') ?? '',
        red: (card.getAttribute('data-card-colors') ?? '').split(/\s+/).includes('red'),
        manaValue: Number(card.getAttribute('data-mana-value') ?? Number.NaN),
    })));
}

async function deckRowCount(page: Page, zone: 'main' | 'side'): Promise<number> {
    return page.locator(`[data-testid="deck-card-row"][data-zone="${zone}"]`).count();
}

async function readDeckEditorConfig(page: Page): Promise<Record<string, unknown> | null> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckEditor.v1') ?? 'null') as Record<string, unknown> | null);
}

async function readGeneratorSettings(page: Page): Promise<Record<string, unknown> | null> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckGenerator.v1') ?? 'null') as Record<string, unknown> | null);
}

async function dropDeckText(locator: Locator, text: string) {
    await locator.evaluate((target, deckText) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', deckText);
        const eventInit: DragEventInit = { bubbles: true, cancelable: true, dataTransfer };
        target.dispatchEvent(new DragEvent('dragenter', eventInit));
        target.dispatchEvent(new DragEvent('dragover', eventInit));
        target.dispatchEvent(new DragEvent('drop', eventInit));
    }, text);
}

async function dropDeckFile(locator: Locator, fileName: string, text: string) {
    await locator.evaluate((target, payload) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([payload.text], payload.fileName, { type: 'text/plain' }));
        const eventInit: DragEventInit = { bubbles: true, cancelable: true, dataTransfer };
        target.dispatchEvent(new DragEvent('dragenter', eventInit));
        target.dispatchEvent(new DragEvent('dragover', eventInit));
        target.dispatchEvent(new DragEvent('drop', eventInit));
    }, { fileName, text });
}

async function startDeckRowDrag(page: Page, sourceZone: 'main' | 'side', cardName: string) {
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

async function finishDeckRowDragToZone(page: Page, targetZone: 'main' | 'side') {
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

async function selectReplacementContaining(select: Locator, text: string) {
    const option = select.locator('option').filter({ hasText: text }).first();
    await expect(option).toBeAttached({ timeout: 15_000 });
    const value = await option.getAttribute('value');
    expect(value, `Expected a replacement option containing ${text}`).toBeTruthy();
    await select.selectOption(value!);
}
