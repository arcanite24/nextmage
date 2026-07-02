import {
    configureLocalServerSuite,
    escapeRegExp,
    expect,
    LocalServerFixtureManager,
    LocalServerHarness,
    RUN_ADVANCED_LOCAL_SERVER_FLOWS,
    RUN_REPLAY_LOCAL_SERVER_FLOWS,
    SMOKE_SIDEBOARD_DECK,
    test,
} from './helpers/localServerHarness';
import type { Locator, Page } from '@playwright/test';

test.describe('local Mage server sideboard, watch, and replay smoke', () => {
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

    test('opens and submits a live sideboard payload through the promoted full editor', async ({ page }) => {
        test.setTimeout(90_000);
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify live sideboard full-editor submit against a rebuilt local server.',
        );
        await seedSideboardEditorConfig(page);

        const fixture = await fixtures.createSideboardSeed('sideboard seed');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
        await page.getByRole('button', { name: 'Join Table' }).click();
        const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(fixture.tableName)}`));
        await harness.pasteDeck(SMOKE_SIDEBOARD_DECK);
        await joinDialog.getByRole('button', { name: 'Join Table' }).click();
        await harness.expectWaitingRoomReady(/2\/2/);

        await fixtures.startSideboardMatch(fixture);
        await harness.expectNormalGameReady(fixture.aiName ?? 'sideboard seed AI');

        await fixtures.endSideboardGameOne(fixture);
        await fixtures.waitForFixtureTableState(fixture, 'SIDEBOARDING', 30_000);
        await expect(page.getByTestId('activity-workspace')).toBeVisible({ timeout: 30_000 });
        const workspace = await harness.expectActivityWorkspace('sideboard', /Sideboarding/i);
        await expect(workspace.getByTestId('activity-deck-payload')).toHaveAttribute('data-deck-payload-kind', 'sideboard');
        await expect(workspace.getByTestId('activity-deck-main-count')).toHaveText('60');
        await expect(workspace.getByTestId('activity-deck-sideboard-count')).toHaveText('15');
        await expect(workspace.getByTestId('activity-deck-dirty-state')).toHaveText('Callback');
        await expectLiveDeckSubmitTimer(workspace);
        await expect(workspace.getByTestId('sideboard-submit-deck-button')).toBeEnabled();
        await expect(workspace.getByTestId('sideboard-reset-button')).toBeEnabled();
        await expect(workspace.getByTestId('activity-deck-analytics').getByTestId('deck-analytics-stat-side')).toContainText('15/15');
        await expectLiveServerLegality(workspace.getByTestId('activity-deck-legality'), 'Standard', 'Constructed - Standard');

        await workspace.getByTestId('activity-open-full-editor-button').click();
        await expect(page.getByTestId('deck-editor-drop-zone')).toBeVisible();
        await expect(page.getByTestId('deck-editor-activity-submit-button')).toHaveAttribute('data-activity-kind', 'sideboard');
        await expect(page.getByTestId('deck-editor-add-lands-button')).toHaveCount(0);
        await expect(page.getByTestId('deck-editor-collection-list-button')).toHaveClass(/active/);
        await expect(page.getByTestId('deck-editor-collection-sort-select')).toHaveValue('manaValue');
        await expect(page.getByTestId('deck-editor-deck-sort-select')).toHaveValue('amount');
        await expect(page.getByTestId('deck-editor-deck-sort-direction-button')).toHaveText('Desc');
        await expect(page.getByTestId('deck-editor-panel-width-input')).toHaveValue('500');
        await expect(page.getByTestId('deck-editor-card-name-filter')).toHaveValue('sideboard live');
        await expect(page.getByTestId('deck-editor-search-names-toggle')).toBeChecked();
        await expect(page.getByTestId('deck-editor-search-types-toggle')).not.toBeChecked();
        await expect(page.getByTestId('deck-editor-search-rules-toggle')).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Unique' })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Piles' })).not.toBeChecked();
        await expect.poll(async () => readDeckEditorConfig(page)).toMatchObject({
            activeMode: 'sideboard',
            modes: {
                sideboard: {
                    collectionView: 'list',
                    collectionSortBy: 'manaValue',
                    deckSortBy: 'amount',
                    deckSortDirection: 'desc',
                    showSideboard: true,
                    deckPanelWidth: 500,
                    search: {
                        nameContains: 'sideboard live',
                        searchNames: true,
                        searchTypes: false,
                        searchRules: true,
                        uniqueNames: true,
                        piles: false,
                    },
                },
            },
        });
        const sideboardToggle = page.getByTestId('deck-editor-sideboard-toggle');
        await expect(sideboardToggle).toBeVisible();
        if (!(await sideboardToggle.isChecked())) {
            await sideboardToggle.check();
        }
        await expect(page.getByTestId('deck-analytics-stat-main')).toContainText('60/60');
        await expect(page.getByTestId('deck-analytics-stat-side')).toContainText('15/15');
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

        await expect(page.getByTestId('deck-section-main')).not.toContainText('Unknown Card');
        await expect(page.getByTestId('deck-section-sideboard')).not.toContainText('Unknown Card');
        const sideboardCard = page
            .getByTestId('deck-section-sideboard')
            .getByTestId('deck-card-row')
            .filter({ hasText: 'Mountain' });
        await expect(sideboardCard.getByTestId('deck-card-count-input')).toHaveValue('15');
        await sideboardCard.getByTestId('deck-card-count-input').fill('14');
        await expect(page.getByTestId('deck-analytics-stat-side')).toContainText('14/15');
        await sideboardCard.getByTestId('deck-card-count-input').fill('15');
        await expect(page.getByTestId('deck-analytics-stat-side')).toContainText('15/15');

        await page.getByTestId('deck-editor-activity-submit-button').click();
        await expect(page.locator('.deck-editor-status')).toContainText('Sideboard submitted.');
        expect(await fixtures.submitFixtureSideboard(fixture)).toBe(true);
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 45_000 });
        await expect(page.getByTestId('game-phase-region')).toContainText(/Turn \d+|Mulligan/i);
    });

    test('watches a normal match and exits watcher mode cleanly', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after watcher-only game selectors are ready.',
        );

        const fixture = await fixtures.createWatchableMatch('watchable match');
        expect(fixture.gameId).toBeTruthy();
        await harness.login();
        await harness.expectWatchActionForTable(fixture.tableName);
        await page.getByTestId('watch-table-button').click();
        await expect(page.getByTestId('game-page')).toBeVisible({ timeout: 45_000 });
        await expect(page.getByTestId('match-watch-banner')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Hold' })).toBeDisabled();
        await page.getByRole('button', { name: 'Stop Watching' }).click();
        await expect(page.getByRole('dialog', { name: 'Stop watching' })).toBeVisible();
        await page.getByRole('button', { name: 'Yes' }).click();
        await harness.expectLobbyReady();
    });

    test('creates a deterministic finished normal-match fixture before promoting replay controls', async () => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after finished-match cleanup/state assertions are ready.',
        );

        const fixture = await fixtures.createFinishedMatch('finished match');

        expect(fixture.kind).toBe('finished-match');
        expect(fixture.expectedState).toBe('FINISHED');
        expect(fixture.gameId).toBeTruthy();
        expect(fixture.matchId).toBeTruthy();
        expect(typeof fixture.replayAvailable).toBe('boolean');
    });

    test('opens a replayable normal match and drives replay controls', async ({ page }) => {
        test.fixme(
            !RUN_REPLAY_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_REPLAY_FLOWS=1 against a saveGameActivated=true local server to verify replay callbacks.',
        );

        const fixture = await fixtures.createReplayableFinishedMatch('replayable match');

        expect(fixture.kind).toBe('replay');
        expect(fixture.expectedState).toBe('FINISHED');
        expect(fixture.gameId).toBeTruthy();
        expect(fixture.matchId).toBeTruthy();
        expect(fixture.replayAvailable).toBe(true);
        expect(fixture.replayInitialized).toBe(true);
        expect(['REPLAY_UPDATE', 'REPLAY_DONE']).toContain(fixture.replayAdvanceCallback);

        await harness.login();
        const replayRow = page.getByTestId('finished-match-row').filter({ hasText: fixture.tableName });
        await expect(replayRow).toBeVisible({ timeout: 30_000 });
        const replayButton = replayRow.getByRole('button', { name: 'Replay' });
        await expect(replayButton).toBeEnabled();
        await replayButton.click();

        const workspace = await harness.expectActivityWorkspace('replay', /Replay/i);
        await expect(workspace.getByTestId('activity-command-panel')).toHaveAttribute('data-activity-command-kind', 'replay');
        await expect(workspace.getByTestId('activity-replay-payload')).toHaveAttribute('data-replay-state', /requested|ready|updated|done/);
        await expect(workspace.getByTestId('replay-previous-button')).toBeEnabled();
        await expect(workspace.getByTestId('replay-next-button')).toBeEnabled();
        await expect(workspace.getByTestId('replay-skip-forward-button')).toBeEnabled();
        await expect(workspace.getByTestId('replay-autoplay-button')).toBeEnabled();
        await expect(workspace.getByTestId('replay-stop-button')).toBeEnabled();
    });
});

async function seedSideboardEditorConfig(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('mage.client.deckEditor.v1', JSON.stringify({
            activeMode: 'sideboard',
            modes: {
                sideboard: {
                    collectionView: 'list',
                    collectionSortBy: 'manaValue',
                    deckSortBy: 'amount',
                    deckSortDirection: 'desc',
                    showSideboard: true,
                    deckPanelWidth: 500,
                    search: {
                        searchText: 'sideboard live',
                        nameContains: 'sideboard live',
                        searchNames: true,
                        searchTypes: false,
                        searchRules: true,
                        uniqueNames: true,
                        piles: false,
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
