import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
    configureLocalServerSuite,
    escapeRegExp,
    expect,
    LocalServerFixtureManager,
    LocalServerHarness,
    MageRpcClient,
    PASSWORD,
    RUN_ADVANCED_LOCAL_SERVER_FLOWS,
    SERVER_URL,
    test,
    USERNAME,
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
        test.setTimeout(120_000);

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
        const draftPanel = await expectDraftActivityPanelReady(workspace);
        await expect(draftPanel).toHaveAttribute('data-draft-picked-count', '0');
        await expect(draftPanel).toHaveAttribute('data-draft-hidden-count', '0');
        await expect(draftPanel).toHaveAttribute('data-draft-log-ready', 'false');
        await expect(workspace.getByTestId('draft-show-hidden-button')).toBeDisabled();
        await expect(workspace.getByTestId('draft-log-export-button')).toBeDisabled();

        const firstBoosterCard = workspace.getByTestId('draft-booster-card').nth(0);
        const secondBoosterCard = workspace.getByTestId('draft-booster-card').nth(1);
        await expect(firstBoosterCard).toHaveAttribute('data-selected', 'true');
        await expect(firstBoosterCard).toHaveAttribute('data-marked', 'false');
        await expect(workspace.getByTestId('draft-booster-loaded-button')).toBeEnabled({ timeout: 45_000 });
        await workspace.getByTestId('draft-booster-loaded-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft booster loaded.');
        await expect(workspace.getByTestId('draft-mark-button')).toBeEnabled();
        await workspace.getByTestId('draft-mark-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft card marked.');
        await expect(firstBoosterCard).toHaveAttribute('data-marked', 'true');
        await expect(workspace.getByTestId('draft-mark-button')).toContainText('Unmark Card');
        await workspace.getByTestId('draft-mark-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft card unmarked.');
        await expect(firstBoosterCard).toHaveAttribute('data-marked', 'false');
        await expect(workspace.getByTestId('draft-mark-button')).toContainText('Mark Card');
        await secondBoosterCard.click();
        await expect(secondBoosterCard).toHaveAttribute('data-selected', 'true');
        await workspace.getByTestId('draft-mark-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft card marked.');
        await expect(secondBoosterCard).toHaveAttribute('data-marked', 'true');
        await expect(firstBoosterCard).toHaveAttribute('data-marked', 'false');
        await expect(workspace.getByTestId('draft-pick-button')).toBeEnabled();
        await workspace.getByTestId('draft-pick-button').click();
        await expect(draftPanel).toHaveAttribute('data-draft-picked-count', '1');
        await expect(draftPanel).toHaveAttribute('data-draft-log-ready', 'true');
        await expect(workspace.getByTestId('draft-picked-card')).toHaveCount(1);
        await expect(workspace.getByTestId('draft-log-export-button')).toBeEnabled();
        const draftLogDownloadPromise = page.waitForEvent('download');
        await workspace.getByTestId('draft-log-export-button').click();
        const draftLogDownload = await draftLogDownloadPromise;
        expect(draftLogDownload.suggestedFilename()).toMatch(/^mage-draft-.+\.draft$/);
        const draftLogPath = await draftLogDownload.path();
        expect(draftLogPath).toBeTruthy();
        const draftLogContent = await readFile(draftLogPath!, 'utf8');
        expect(draftLogContent).toContain('Event #:');
        expect(draftLogContent).toContain('Players:');
        expect(draftLogContent).toContain('------');
        expect(draftLogContent).toMatch(/-->\s+\S/);
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft log exported.');
        const firstPickedCard = workspace.getByTestId('draft-picked-card').first();
        await expect(firstPickedCard).toHaveAttribute('data-hidden', 'false');
        await firstPickedCard.getByTestId('draft-picked-hidden-toggle').check();
        await expect(firstPickedCard).toHaveAttribute('data-hidden', 'true');
        await expect(draftPanel).toHaveAttribute('data-draft-hidden-count', '1');
        await expect(workspace.getByTestId('draft-hidden-count')).toHaveText('1');
        await expect(workspace.getByTestId('draft-show-hidden-button')).toBeEnabled();
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
        await expect(draftPanel).toHaveAttribute('data-draft-picked-count', '2');
        await expect(workspace.getByTestId('draft-picked-card')).toHaveCount(2);
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-main-count', '2');
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-draft-pick-count', '2');
        await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('2');
        await expect(workspace.getByTestId('activity-deck-editor')).toBeVisible();
        await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-panel')).toBeVisible();
        const cleanupDraftId = await workspace.getAttribute('data-activity-object-id');

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
        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('2/40');
        await expect(page.getByTestId('deck-section-main')).not.toContainText('Unknown Card');
        await expect.poll(async () => page.getByTestId('deck-section-main').getByTestId('deck-card-row').count()).toBeGreaterThan(0);

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
        for (const card of await collectionCardMetadata(page)) {
            expect(card.setCode).toBe('M11');
            expect(card.red).toBe(true);
            expect(card.manaValue).toBeLessThanOrEqual(1);
        }

        expect(cleanupDraftId).toBeTruthy();
        expect(cleanupDraftId).not.toBe('none');
        await quitDraftByRpc(cleanupDraftId!);
    });

    test('quits a live draft activity from the browser workspace', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify live draft quit controls against a rebuilt local server.',
        );

        const fixture = await fixtures.createDraftTable('booster draft browser quit');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
        await page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(fixture.tableName)}`));
        await harness.pasteDeck();
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectWaitingRoomReady(/1\/2|2\/2/);

        await fixtures.startDraft(fixture);

        const workspace = await harness.expectActivityWorkspace('draft', /Draft/i);
        await expectDraftActivityPanelReady(workspace);
        await expect(workspace.getByTestId('draft-quit-button')).toBeEnabled();
        await workspace.getByTestId('draft-quit-button').click();
        await expect(workspace.getByTestId('activity-command-status')).toContainText('Draft quit.');
    });

    test('picks a live draft booster into the server waiting state before construction handoff', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify live browser draft picking into the local server waiting state.',
        );
        test.setTimeout(300_000);
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
        const draftResult = await pickLiveDraftUntilWaitingOrConstruction(page);
        expect(draftResult.pickedCount).toBeGreaterThan(0);

        if (draftResult.state === 'construction') {
            const constructionWorkspace = await harness.expectActivityWorkspace('construction', /construction/i);
            await expect(constructionWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'construction');
            await expect(constructionWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
            await expectLiveDeckSubmitTimer(constructionWorkspace);
            return;
        }

        const waitingWorkspace = await harness.expectActivityWorkspace('draft', /Draft/i);
        const waitingDraftPanel = waitingWorkspace.getByTestId('activity-draft-panel');
        await expect(waitingDraftPanel).toHaveAttribute('data-draft-picking', 'false');
        await expect(waitingDraftPanel).toHaveAttribute('data-draft-booster-count', '0');
        await expect(waitingWorkspace.getByTestId('draft-message')).toContainText('Waiting for other players');
        await expect(waitingWorkspace.getByTestId('draft-booster-empty')).toContainText('Waiting for other players');
        await expect(waitingWorkspace.getByTestId('draft-picked-card')).toHaveCount(draftResult.pickedCount);
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
        await expect(workspace.getByTestId('activity-deck-autosave-state')).toHaveAttribute('data-autosave-state', 'saved', { timeout: 20_000 });

        await workspace.getByTestId('activity-open-full-editor-button').click();
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'construction');
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toBeEnabled();
        await expect(page.getByTestId('deck-editor-add-lands-button')).toBeVisible();
        await expect(page.getByTestId('deck-editor-limited-autosave-state')).toHaveAttribute('data-autosave-state', 'saved', { timeout: 20_000 });
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

        await page.getByTestId('deck-editor-activity-submit-button').click();
        await expect(page.getByTestId('deck-editor-status')).toContainText(
            'Limited deck needs at least 40 main-deck cards before submit (0/40).',
        );
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();

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
        for (const card of await collectionCardMetadata(page)) {
            expect(card.setCode).toBe('M11');
            expect(card.red).toBe(true);
            expect(card.manaValue).toBeLessThanOrEqual(1);
        }

        const editorStatus = page.getByTestId('deck-editor-status');
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
        await expectLiveLegality(page.getByTestId('deck-legality-panel'), 'Standard', 'Constructed - Standard');
        await expect(page.getByTestId('deck-editor-limited-autosave-state')).toHaveAttribute('data-autosave-state', 'saved', { timeout: 20_000 });

        await page.getByTestId('deck-editor-activity-submit-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('game-phase-region').getByText(/Mulligan down to|Turn 1/i)).toBeVisible();
        await page.getByTestId('game-sidebar-toggle').click();
        await expect(page.getByTestId('match-action-panel')).toBeVisible();
        await expect(page.getByTestId('match-view-limited-deck-button')).toBeEnabled();
        await expect(page.getByTestId('match-view-sideboard-button')).toBeEnabled();
        const viewedLimitedDeckChip = await openViewedLimitedDeckActivity(page);
        await viewedLimitedDeckChip.click();
        const viewedLimitedDeckWorkspace = await harness.expectActivityWorkspace('card-viewer', /Viewed limited deck/i);
        await expect(viewedLimitedDeckWorkspace).toHaveAttribute('data-activity-last-callback', 'viewLimitedDeck');
        await expect(viewedLimitedDeckWorkspace.getByTestId('activity-command-panel')).toHaveAttribute('data-deck-read-only', 'true');
        await expect(viewedLimitedDeckWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'view');
        await expect(viewedLimitedDeckWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
        await expect(viewedLimitedDeckWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-read-only', 'true');
        await expect.poll(async () => {
            const counts = await readActivityDeckCounts(viewedLimitedDeckWorkspace);
            return counts.main + counts.sideboard;
        }, { timeout: 20_000 }).toBeGreaterThan(0);
        await page.locator('[data-testid="activity-chip"][data-activity-kind="game"]').first().click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 20_000 });

        await fixtures.endCurrentFixtureGame(fixture);
        const sideboardWorkspace = await harness.expectActivityWorkspace('sideboard', /Limited sideboarding|Sideboarding/i);
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'sideboard');
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-limited-sideboard', 'true');
        await expect(sideboardWorkspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-format', 'Limited');
        await expectLiveDeckSubmitTimer(sideboardWorkspace);
        await expect(sideboardWorkspace.getByTestId('sideboard-add-lands-button')).toBeEnabled();
        await expect(sideboardWorkspace.getByTestId('activity-deck-autosave-state')).toHaveAttribute('data-autosave-state', 'saved', { timeout: 20_000 });
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
        await expect(sideboardWorkspace.getByTestId('activity-deck-autosave-state')).toHaveAttribute('data-autosave-state', 'saved', { timeout: 20_000 });

        await sideboardWorkspace.getByTestId('sideboard-submit-deck-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 30_000 });

        await page.getByRole('button', { name: /Sideboard Limited sideboarding Waiting/i }).click();
        const submittedSideboardWorkspace = await harness.expectActivityWorkspace('sideboard', /Limited sideboarding|Sideboarding/i);
        await expect(submittedSideboardWorkspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
        await expect(submittedSideboardWorkspace.getByTestId('activity-deck-delta')).toHaveText('Main 0 / Side 0');
    });
});

async function expectDraftActivityPanelReady(workspace: Locator): Promise<Locator> {
    const draftPanel = workspace.getByTestId('activity-draft-panel');

    await expect(draftPanel).toBeVisible();
    await expect(draftPanel).toHaveAttribute('data-draft-picking', 'true');
    await expect(draftPanel).toHaveAttribute('data-draft-pack-number', /^[1-9]\d*$/);
    await expect(draftPanel).toHaveAttribute('data-draft-pick-number', /^[1-9]\d*$/);
    await expect(draftPanel).toHaveAttribute('data-draft-pass-direction', /^(left|right)$/);
    await expect(draftPanel).toHaveAttribute('data-draft-booster-count', /^[1-9]\d*$/);
    await expect(workspace.getByTestId('draft-message')).toContainText(/Pick a card|Waiting for other players/);
    await expect(workspace.getByTestId('draft-countdown')).toHaveAttribute('data-timer-state', 'running');
    await expect(workspace.getByTestId('draft-countdown')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(workspace.getByTestId('draft-pack-pick')).toContainText(/^[1-9]\d* \/ [1-9]\d*$/);
    await expect(workspace.getByTestId('draft-pass-direction')).toContainText(/Pass left|Pass right/);
    await expect(workspace.getByTestId('draft-pack-row')).toHaveCount(3);
    await expect(workspace.getByTestId('draft-selected-card')).not.toHaveText('No card selected');
    await expect.poll(
        async () => workspace.getByTestId('draft-booster-card').count(),
        { timeout: 45_000 },
    ).toBeGreaterThan(1);
    await expect.poll(
        async () => workspace.getByTestId('draft-player').count(),
        { timeout: 45_000 },
    ).toBeGreaterThan(1);

    return draftPanel;
}

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

async function quitDraftByRpc(draftId: string): Promise<void> {
    const client = await MageRpcClient.connect(SERVER_URL);
    const sessionId = randomUUID();

    try {
        client.listen();
        await client.send<boolean>('connectUser', [USERNAME, PASSWORD, sessionId, '', '', '']);
        await client.send<boolean>('draftQuit', [draftId, sessionId]);
        await client.send<boolean>('disconnectSession', [sessionId, false]).catch(() => undefined);
    } finally {
        client.close();
    }
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

async function pickLiveDraftUntilWaitingOrConstruction(page: Page): Promise<{ pickedCount: number; state: 'waiting' | 'construction' }> {
    let pickedCount = 0;

    for (let pickIndex = 0; pickIndex < 60; pickIndex += 1) {
        const currentKind = await page.getByTestId('activity-workspace').getAttribute('data-activity-kind');
        if (currentKind === 'construction') {
            return { pickedCount, state: 'construction' };
        }

        const workspace = page.getByTestId('activity-workspace');
        await expect(workspace).toHaveAttribute('data-activity-kind', 'draft');
        const draftPanel = workspace.getByTestId('activity-draft-panel');
        const beforePickCount = Number(await draftPanel.getAttribute('data-draft-picked-count') ?? '0');
        const isPicking = await draftPanel.getAttribute('data-draft-picking');
        const boosterCount = Number(await draftPanel.getAttribute('data-draft-booster-count') ?? '0');
        if (isPicking === 'false' || boosterCount === 0) {
            if (beforePickCount === 0) {
                const initialState = await waitForDraftBoosterOrProgress(page, beforePickCount, 45_000);
                if (initialState === 'ready' || initialState === 'picked') {
                    continue;
                }
                if (initialState === 'construction') {
                    return { pickedCount: pickedCount, state: 'construction' };
                }
            }
            const latestPickCount = Number(await draftPanel.getAttribute('data-draft-picked-count') ?? beforePickCount);
            return { pickedCount: Math.max(pickedCount, latestPickCount), state: 'waiting' };
        }
        let progress: 'construction' | 'picked' | null = null;

        for (let attempt = 0; attempt < 3 && !progress; attempt += 1) {
            const currentWorkspace = page.getByTestId('activity-workspace');
            const firstBoosterCard = currentWorkspace.getByTestId('draft-booster-card').first();

            await expect(firstBoosterCard).toBeVisible({ timeout: 45_000 });
            await firstBoosterCard.click();
            await expect(firstBoosterCard).toHaveAttribute('data-selected', 'true');
            await expect(currentWorkspace.getByTestId('draft-pick-button')).toBeEnabled({ timeout: 45_000 });
            await currentWorkspace.getByTestId('draft-pick-button').click();

            progress = await waitForDraftPickProgress(page, beforePickCount, 12_000);
        }

        if (!progress) {
            throw new Error(`Live draft pick ${pickIndex + 1} did not advance beyond ${beforePickCount} picked cards.`);
        }

        const nextKind = await page.getByTestId('activity-workspace').getAttribute('data-activity-kind');
        if (nextKind === 'construction') {
            return { pickedCount: Math.max(pickedCount, beforePickCount + 1), state: 'construction' };
        }

        pickedCount = Number(await page
            .getByTestId('activity-workspace')
            .getByTestId('activity-draft-panel')
            .getAttribute('data-draft-picked-count') ?? '0');
    }

    throw new Error('Live draft did not reach waiting or construction after 60 browser picks.');
}

async function waitForDraftBoosterOrProgress(
    page: Page,
    beforePickCount: number,
    timeoutMs: number,
): Promise<'ready' | 'picked' | 'construction' | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const workspace = page.getByTestId('activity-workspace');
        const kind = await workspace.getAttribute('data-activity-kind').catch(() => null);
        if (kind === 'construction') return 'construction';
        if (kind !== 'draft') return null;

        const draftPanel = workspace.getByTestId('activity-draft-panel');
        const isPicking = await draftPanel.getAttribute('data-draft-picking').catch(() => null);
        const boosterCount = Number(await draftPanel.getAttribute('data-draft-booster-count').catch(() => '0') ?? '0');
        const nextPickCount = Number(await draftPanel.getAttribute('data-draft-picked-count').catch(() => '0') ?? '0');
        if (nextPickCount > beforePickCount) return 'picked';
        if (isPicking !== 'false' && boosterCount > 0) return 'ready';

        await page.waitForTimeout(500);
    }

    return null;
}

async function waitForDraftPickProgress(page: Page, beforePickCount: number, timeoutMs: number): Promise<'construction' | 'picked' | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const workspace = page.getByTestId('activity-workspace');
        const kind = await workspace.getAttribute('data-activity-kind');
        if (kind === 'construction') return 'construction';
        if (kind !== 'draft') return null;

        const draftPanel = workspace.getByTestId('activity-draft-panel');
        const nextPickCount = Number(await draftPanel.getAttribute('data-draft-picked-count') ?? '0');
        if (nextPickCount > beforePickCount) return 'picked';

        await page.waitForTimeout(500);
    }

    return null;
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

async function expectLiveLegality(scope: Locator, labelText: string, deckType: string) {
    const label = scope.getByTestId('deck-legality-label').filter({ hasText: labelText });
    await expect(label).toHaveAttribute('data-validation-source', /^(server|browser)$/, { timeout: 20_000 });
    await expect(label).toHaveAttribute('data-deck-type', deckType);
    await expect(label).toHaveAttribute('data-legality-status', /legal|partly-legal|not-legal/);
    await expect(label).toHaveAttribute('data-issue-count', /^\d+$/);
    await expect(label).toHaveAttribute('data-selectable-card-count', /^\d+$/);
    await label.click();
    await expect(scope.getByTestId('deck-legality-detail-summary')).toContainText(labelText);
    await expect(scope.getByTestId('deck-legality-detail-summary')).toContainText('Main min 60');
    await expect(scope.getByTestId('deck-legality-detail-source')).toHaveText(/Server validator|Browser fallback/);
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

async function openViewedLimitedDeckActivity(page: Page): Promise<Locator> {
    const callbackLimitedDeckChip = page.locator(
        '[data-testid="activity-chip"][data-activity-kind="card-viewer"][data-activity-last-callback="viewLimitedDeck"]',
    ).first();
    const titledLimitedDeckChip = page.locator('[data-testid="activity-chip"][data-activity-kind="card-viewer"]')
        .filter({ hasText: /Viewed limited deck/i })
        .first();
    const limitedDeckButton = page.getByTestId('match-view-limited-deck-button');
    const deadline = Date.now() + 45_000;

    while (Date.now() < deadline) {
        if (await callbackLimitedDeckChip.isVisible().catch(() => false)) {
            return callbackLimitedDeckChip;
        }

        if (await titledLimitedDeckChip.isVisible().catch(() => false)) {
            return titledLimitedDeckChip;
        }

        if (await limitedDeckButton.isEnabled().catch(() => false)) {
            await limitedDeckButton.click().catch(() => undefined);
        }
        await page.waitForTimeout(1_500);
    }

    await expect(titledLimitedDeckChip).toBeVisible({ timeout: 1_000 });
    return titledLimitedDeckChip;
}
