import {
    configureLocalServerSuite,
    escapeRegExp,
    expect,
    LocalServerFixtureManager,
    LocalServerHarness,
    RUN_ADVANCED_LOCAL_SERVER_FLOWS,
    test,
} from './helpers/localServerHarness';
import type { Locator, Page } from '@playwright/test';

test.describe('local Mage server draft and limited smoke', () => {
    configureLocalServerSuite();

    let fixtures: LocalServerFixtureManager;
    let harness: LocalServerHarness;

    test.beforeEach(async ({ page }, testInfo) => {
        fixtures = new LocalServerFixtureManager(testInfo);
        harness = new LocalServerHarness(page, testInfo);
    });

    test.afterEach(async () => {
        await harness.cleanup();
        await fixtures.cleanup();
    });

    test('creates a deterministic draft table before promoting draft and limited playthroughs', async () => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after draft table selectors are ready.',
        );

        const fixture = await fixtures.createDraftTable('booster draft');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
    });

    test('marks, loads, and picks a deterministic booster draft card before promoting draft controls', async () => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after draft controls are wired to live booster payloads.',
        );

        const fixture = await fixtures.createDraftPickSeed('booster draft pick');

        expect(fixture.kind).toBe('draft-pick');
        expect(fixture.expectedState).toBe('DRAFTING');
        expect(fixture.tournamentId).toBeTruthy();
        expect(fixture.draftId).toBeTruthy();
        expect(fixture.draftCardId).toBeTruthy();
        expect(fixture.draftCardMarked).toBe(true);
        expect(fixture.boosterLoaded).toBe(true);
        expect(fixture.draftPickSubmitted).toBe(true);
        expect(fixture.draftPickBoosterSize).toBeGreaterThan(0);
        expect(fixture.draftPicksSize).toBeGreaterThan(0);

        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Drafting|DRAFTING/i);
    });

    test('picks a live booster draft card and opens the picked cards in the full editor', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify live draft picked-card editor promotion against a rebuilt local server.',
        );
        await seedDraftEditorConfig(page);

        const fixture = await fixtures.createDraftTable('booster draft browser payload');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
        await page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(fixture.tableName)}`));
        await harness.pasteDeck();
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectWaitingRoomReady(/1\/2|2\/2/);

        await fixtures.startDraft(fixture);

        const workspace = await harness.expectActivityWorkspace('draft', /Draft/i);
        await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-activity-command-kind', 'draft');
        await expect(workspace.getByTestId('draft-booster-loaded-button')).toBeEnabled({ timeout: 45_000 });
        await workspace.getByTestId('draft-booster-loaded-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft booster loaded.');
        await expect(workspace.getByTestId('draft-mark-button')).toBeEnabled();
        await workspace.getByTestId('draft-mark-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft card marked.');
        await expect(workspace.getByTestId('draft-pick-button')).toBeEnabled();
        await workspace.getByTestId('draft-pick-button').click();
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'draft');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-main-count', '1');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-draft-pick-count', '1');
        await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('1');
        await expect.poll(
            async () => ({
                picking: await workspace.getByTestId('activity-deck-payload').getAttribute('data-draft-picking'),
                boosterCount: Number(await workspace.getByTestId('activity-deck-payload').getAttribute('data-draft-booster-count')),
                mainCount: await workspace.getByTestId('activity-deck-payload').getAttribute('data-main-count'),
            }),
            { timeout: 45_000 },
        ).toMatchObject({ picking: 'true', boosterCount: expect.any(Number), mainCount: '1' });
        await expect.poll(
            async () => Number(await workspace.getByTestId('activity-deck-payload').getAttribute('data-draft-booster-count')),
            { timeout: 45_000 },
        ).toBeGreaterThan(0);
        await expect(workspace.getByTestId('draft-booster-loaded-button')).toBeEnabled();
        await workspace.getByTestId('draft-booster-loaded-button').click();
        await expect(workspace.getByTestId('draft-pick-button')).toBeEnabled();
        await workspace.getByTestId('draft-pick-button').click();
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-main-count', '2');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-draft-pick-count', '2');
        await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('2');
        await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
        await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-panel')).toBeVisible();

        await workspace.getByTestId('activity-open-full-editor-button').click();
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveCount(0);
        await expect(page.getByTestId('deck-editor-add-lands-button')).toHaveCount(0);
        await expect(page.getByTestId('deck-editor-collection-list-button')).toHaveClass(/active/);
        await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('cardNumber');
        await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue('set');
        await expect(page.getByTestId('deck-editor-deck-sort-direction-button')).toHaveText('Desc');
        await expect(page.getByTestId('deck-editor-sideboard-toggle')).not.toBeChecked();
        await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue('420');
        await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('draft live');
        await expect(page.getByTestId('deck-editor-search-names-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-editor-search-types-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-editor-search-rules-toggle')).not.toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Unique' })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Piles' })).toBeChecked();
        await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
            activeMode: 'draft',
            modes: {
                draft: {
                    collectionView: 'list',
                    collectionSortBy: 'cardNumber',
                    deckSortBy: 'set',
                    deckSortDirection: 'desc',
                    showSideboard: false,
                    deckPanelWidth: 420,
                    search: {
                        nameContains: 'draft live',
                        searchNames: true,
                        searchTypes: true,
                        searchRules: false,
                        uniqueNames: true,
                        piles: true,
                    },
                },
            },
        });
        await expect(page.getByTestId('deck-analytics-panel')).toBeVisible();
        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('2/60');
        await expect(page.getByTestId('deck-section-main')).not.toContainText('Unknown Card');
        await expect.poll(async () => page.getByTestId('deck-section-main').getByTestId('deck-card-row').count()).toBeGreaterThan(0);

        await page.getByRole('button', { name: 'Reset' }).click();
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
        for (const card of await collectionCardMetadata(page)) {
            expect(card.setCode).toBe('M11');
            expect(card.red).toBe(true);
            expect(card.manaValue).toBeLessThanOrEqual(1);
        }
    });

    test('carries completed live draft picks into construction and submits from the full editor', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify DRAFT_OVER to CONSTRUCT deck-submit handoff against a rebuilt local server.',
        );
        test.setTimeout(180_000);
        await seedLimitedEditorConfig(page);

        const fixture = await fixtures.createDraftConstructionTable('post draft construction browser payload');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
        await page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(fixture.tableName)}`));
        await harness.pasteDeck();
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectWaitingRoomReady(/1\/2|2\/2/);

        await fixtures.startDraft(fixture);

        const draftWorkspace = await harness.expectActivityWorkspace('draft', /Draft/i);
        await expect(draftWorkspace.getByTestId('draft-booster-loaded-button')).toBeEnabled({ timeout: 45_000 });
        const pickedCount = await finishLiveDraftFromBrowser(page);
        expect(pickedCount).toBeGreaterThan(0);

        const constructionWorkspace = await harness.expectActivityWorkspace('construction', /construction/i);
        await expect(constructionWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'construction');
        await expect(constructionWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
        await expectLiveDeckSubmitTimer(constructionWorkspace);
        const constructionCounts = await readActivityDeckCounts(constructionWorkspace);
        expect(constructionCounts.main + constructionCounts.sideboard).toBeGreaterThanOrEqual(pickedCount);
        await expect(constructionWorkspace.getByTestId('construction-submit-deck-button')).toBeEnabled();
        await expect(constructionWorkspace.getByTestId('construction-add-lands-button')).toBeEnabled();
        await expect(constructionWorkspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-panel')).toBeVisible();

        await constructionWorkspace.getByTestId('activity-open-full-editor-button').click();
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'construction');
        await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();
        await expect(page.getByTestId('deck-editor-sideboard-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-section-main')).not.toContainText('Unknown Card');
        await expect(page.getByTestId('deck-section-sideboard')).not.toContainText('Unknown Card');
        const initialMainCount = await readDeckSectionCount(page, 'main');
        const initialSideboardCount = await readDeckSectionCount(page, 'side');
        expect(initialMainCount + initialSideboardCount).toBeGreaterThanOrEqual(pickedCount);

        const landsToAdd = Math.max(0, 40 - initialMainCount);
        if (landsToAdd > 0) {
            await page.getByTestId('deck-editor-add-lands-button').click();
            const addLandsModal = page.getByTestId('deck-add-lands-modal');
            await expect(addLandsModal).toBeVisible();
            await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
            await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
            await addLandsModal.getByLabel('Mountain count').fill(String(landsToAdd));
            await addLandsModal.getByTestId('deck-add-lands-submit-button').click();
            await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
        }

        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('40/40', { timeout: 20_000 });
        await page.getByTestId('deck-editor-activity-submit-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 45_000 });
        await expect(page.getByText(/Mulligan down to|Turn 1/i)).toBeVisible();
    });

    test('submits a deterministic sealed construction deck before promoting limited construction UI', async () => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after limited construction controls are wired to live payloads.',
        );

        const fixture = await fixtures.createLimitedConstructionSubmit('sealed construction');

        expect(fixture.kind).toBe('construction');
        expect(fixture.expectedState).toBe('DUELING');
        expect(fixture.tournamentId).toBeTruthy();
        expect(fixture.gameId).toBeTruthy();
        expect(fixture.deckSubmitted).toBe(true);

        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /In Game|Game in progress|Dueling|DUELING/i);
    });

    test('renders a live sealed construction deck payload in the browser activity workspace', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after limited construction activity payload selectors are ready.',
        );
        test.setTimeout(120_000);
        await seedLimitedEditorConfig(page);
        const fixture = await fixtures.createLimitedConstructionTable('sealed construction browser payload');

        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
        await page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(fixture.tableName)}`));
        await harness.pasteDeck();
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectWaitingRoomReady(/1\/2|2\/2/);

        await fixtures.startLimitedConstruction(fixture);

        const workspace = await harness.expectActivityWorkspace('construction', /construction|sealed/i);
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'construction');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-dirty', 'false');
        await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
        await expectLiveDeckSubmitTimer(workspace);
        await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
        await expect(workspace.getByTestId('activity-deck-editor-toolbar')).toHaveAttribute('data-editor-mode', 'limited');
        await expect(workspace.getByTestId('construction-submit-deck-button')).toBeEnabled();
        await expect(workspace.getByTestId('construction-add-lands-button')).toBeEnabled();
        await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-panel')).toBeVisible();
        await expect(workspace.getByTestId('activity-deck-legality').getByTestId('deck-legality-panel')).toBeVisible();
        await expectLiveServerLegality(workspace.getByTestId('activity-deck-legality'), 'Standard', 'Constructed - Standard');

        await workspace.getByTestId('activity-open-full-editor-button').click();
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'construction');
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toBeEnabled();
        await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();
        await expect(page.getByTestId('deck-editor-collection-list-button')).toHaveClass(/active/);
        await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('rarity');
        await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue('set');
        await expect(page.getByTestId('deck-editor-deck-sort-direction-button')).toHaveText('Asc');
        await expect(page.getByTestId('deck-editor-sideboard-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue('460');
        await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('limited live');
        await expect(page.getByTestId('deck-editor-search-names-toggle')).not.toBeChecked();
        await expect(page.getByTestId('deck-editor-search-types-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-editor-search-rules-toggle')).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Unique' })).not.toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Piles' })).toBeChecked();
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
                        nameContains: 'limited live',
                        searchNames: false,
                        searchTypes: true,
                        searchRules: true,
                        uniqueNames: false,
                        piles: true,
                    },
                },
            },
        });
        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('0/40');
        await expectLiveServerLegality(page.getByTestId('deck-legality-panel'), 'Standard', 'Constructed - Standard');

        await page.getByRole('button', { name: 'Reset' }).click();
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
        for (const card of await collectionCardMetadata(page)) {
            expect(card.setCode).toBe('M11');
            expect(card.red).toBe(true);
            expect(card.manaValue).toBeLessThanOrEqual(1);
        }

        const editorStatus = page.locator('.deck-editor-status');
        await page.getByTestId('deck-editor-add-lands-button').click();
        const addLandsModal = page.getByTestId('deck-add-lands-modal');
        await expect(addLandsModal).toBeVisible();
        await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
        await expect(addLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
        await addLandsModal.getByLabel('Mountain count').fill('40');
        await addLandsModal.getByTestId('deck-add-lands-submit-button').click();
        await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
        await expect(editorStatus).toContainText('Added 40 basic lands to main deck.', { timeout: 20_000 });
        await expect(page.locator('[data-testid="deck-card-row"][data-zone="main"][data-card-name="Mountain"]').getByTestId('deck-card-count-input')).toHaveValue('40');
        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('40/40');
        await expectLiveServerLegality(page.getByTestId('deck-legality-panel'), 'Standard', 'Constructed - Standard');

        await page.getByTestId('deck-editor-activity-submit-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/Mulligan down to|Turn 1/i)).toBeVisible();

        await fixtures.endCurrentFixtureGame(fixture);
        const sideboardWorkspace = await harness.expectActivityWorkspace('sideboard', /Limited sideboarding|Sideboarding/i);
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'sideboard');
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-limited-sideboard', 'true');
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
        await expectLiveDeckSubmitTimer(sideboardWorkspace);
        await expect(sideboardWorkspace.getByTestId('sideboard-add-lands-button')).toBeEnabled();
        await sideboardWorkspace.getByTestId('sideboard-add-lands-button').click();
        const sideboardAddLandsModal = page.getByTestId('deck-add-lands-modal');
        await expect(sideboardAddLandsModal).toBeVisible();
        await expect(sideboardAddLandsModal.getByTestId('deck-add-lands-zone-select')).toHaveValue('main');
        await expect(sideboardAddLandsModal.getByTestId('deck-add-lands-zone-select')).toBeDisabled();
        await sideboardAddLandsModal.getByLabel('Forest count').fill('1');
        await sideboardAddLandsModal.getByTestId('deck-add-lands-submit-button').click();
        await expect(page.getByTestId('deck-add-lands-modal')).toHaveCount(0);
        await expect(sideboardWorkspace.getByTestId('activity-deck-dirty-state')).toHaveText('Edited');
        await expect(sideboardWorkspace.getByTestId('activity-deck-delta')).toHaveText('Main +1 / Side 0');
        await expect(sideboardWorkspace.locator('[data-testid="activity-deck-editor-row"][data-zone="main"][data-card-name="Forest"]').getByTestId('activity-deck-editor-count-input')).toHaveValue('1');
        await expect(sideboardWorkspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-main')).toContainText('41/40');

        await sideboardWorkspace.getByTestId('sideboard-submit-deck-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 30_000 });

        await page.getByRole('button', { name: /Sideboard Limited sideboarding Waiting/i }).click();
        const submittedSideboardWorkspace = await harness.expectActivityWorkspace('sideboard', /Limited sideboarding|Sideboarding/i);
        await expect(submittedSideboardWorkspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
        await expect(submittedSideboardWorkspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    });
});

async function seedLimitedEditorConfig(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('mage.client.deckEditor.v1', JSON.stringify({
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
                        searchText: 'limited live',
                        nameContains: 'limited live',
                        searchNames: false,
                        searchTypes: true,
                        searchRules: true,
                        uniqueNames: false,
                        piles: true,
                    },
                },
            },
        }));
    });
}

async function seedDraftEditorConfig(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('mage.client.deckEditor.v1', JSON.stringify({
            activeMode: 'draft',
            modes: {
                draft: {
                    collectionView: 'list',
                    collectionSortBy: 'cardNumber',
                    deckSortBy: 'set',
                    deckSortDirection: 'desc',
                    showSideboard: false,
                    deckPanelWidth: 420,
                    search: {
                        searchText: 'draft live',
                        nameContains: 'draft live',
                        searchNames: true,
                        searchTypes: true,
                        searchRules: false,
                        uniqueNames: true,
                        piles: true,
                    },
                },
            },
        }));
    });
}

async function readDeckEditorConfig(page: Page): Promise<Record<string, unknown> | null> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('mage.client.deckEditor.v1') ?? 'null') as Record<string, unknown> | null);
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

async function finishLiveDraftFromBrowser(page: Page): Promise<number> {
    let pickedCount = 0;

    for (let pickIndex = 0; pickIndex < 20; pickIndex += 1) {
        const currentKind = await page.getByTestId('activity-workspace').getAttribute('data-activity-kind');
        if (currentKind === 'construction') {
            return pickedCount;
        }

        const workspace = page.getByTestId('activity-workspace');
        await expect(workspace).toHaveAttribute('data-activity-kind', 'draft');
        const payload = workspace.getByTestId('activity-deck-payload');
        const beforePickCount = Number(await payload.getAttribute('data-draft-pick-count') ?? '0');

        await expect(workspace.getByTestId('draft-booster-loaded-button')).toBeEnabled({ timeout: 45_000 });
        await workspace.getByTestId('draft-booster-loaded-button').click();
        await expect(workspace.getByTestId('draft-pick-button')).toBeEnabled({ timeout: 45_000 });
        await workspace.getByTestId('draft-pick-button').click();

        await expect.poll(async () => {
            const nextWorkspace = page.getByTestId('activity-workspace');
            const kind = await nextWorkspace.getAttribute('data-activity-kind');
            if (kind === 'construction') return 'construction';
            if (kind !== 'draft') return kind ?? 'none';
            const nextPayload = nextWorkspace.getByTestId('activity-deck-payload');
            const nextPickCount = Number(await nextPayload.getAttribute('data-draft-pick-count') ?? '0');
            return nextPickCount > beforePickCount ? 'picked' : `draft:${nextPickCount}`;
        }, { timeout: 60_000 }).toMatch(/^(construction|picked)$/);

        const nextKind = await page.getByTestId('activity-workspace').getAttribute('data-activity-kind');
        if (nextKind === 'construction') {
            return Math.max(pickedCount, beforePickCount + 1);
        }

        pickedCount = Number(await page
            .getByTestId('activity-workspace')
            .getByTestId('activity-deck-payload')
            .getAttribute('data-draft-pick-count') ?? '0');
    }

    throw new Error('Live draft did not reach construction after 20 browser picks.');
}

async function readActivityDeckCounts(workspace: Locator): Promise<{ main: number; sideboard: number }> {
    const payload = workspace.getByTestId('activity-deck-payload');
    return {
        main: Number(await payload.getAttribute('data-main-count') ?? '0'),
        sideboard: Number(await payload.getAttribute('data-sideboard-count') ?? '0'),
    };
}

async function readDeckSectionCount(page: Page, zone: 'main' | 'side'): Promise<number> {
    return page
        .locator(`[data-testid="deck-card-row"][data-zone="${zone}"]`)
        .evaluateAll(rows => rows.reduce((sum, row) => {
            const input = row.querySelector<HTMLInputElement>('[data-testid="deck-card-count-input"]');
            return sum + Number(input?.value ?? '0');
        }, 0));
}

async function expectLiveServerLegality(scope: Locator, labelText: string, deckType: string) {
    const label = scope.getByTestId('deck-legality-label').filter({ hasText: labelText });
    await expect(label).toHaveAttribute('data-validation-source', 'server', { timeout: 20_000 });
    await expect(label).toHaveAttribute('data-deck-type', deckType);
    await expect(label).toHaveAttribute('data-legality-status', /legal|partly-legal|not-legal/);
    await expect(label).toHaveAttribute('data-issue-count', /^\d+$/);
    await expect(label).toHaveAttribute('data-selectable-card-count', /^\d+$/);
    await label.click();
    await expect(scope.getByTestId('deck-legality-detail-summary')).toContainText(labelText);
    await expect(scope.getByTestId('deck-legality-detail-summary')).toContainText('Main min 60');
    await expect(scope.getByTestId('deck-legality-detail-source')).toHaveText('Server validator');
}

async function expectLiveDeckSubmitTimer(workspace: Locator) {
    const payload = workspace.getByTestId('activity-deck-payload');
    await expect(payload).toHaveAttribute('data-submit-ready', 'true');
    await expect(payload).toHaveAttribute('data-timer-state', 'running');
    await expect(payload).toHaveAttribute('data-time-initial', /^[1-9]\d*$/);
    await expect(payload).toHaveAttribute('data-time-remaining', /^\d+$/);

    const initialSeconds = Number(await payload.getAttribute('data-time-initial'));
    const remainingSeconds = Number(await payload.getAttribute('data-time-remaining'));
    expect(remainingSeconds).toBeGreaterThan(0);
    expect(remainingSeconds).toBeLessThanOrEqual(initialSeconds);

    await expect(workspace.getByTestId('activity-deck-timer')).toHaveAttribute('data-timer-state', 'running');
    await expect(workspace.getByTestId('activity-deck-timer')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveAttribute('data-submit-ready', 'true');
    await expect(workspace.getByTestId('activity-deck-submit-state')).toHaveText('Ready to submit');
}
