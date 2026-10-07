import {
    configureLocalServerSuite,
    escapeRegExp,
    expect,
    type LocalServerFixture,
    LocalServerFixtureManager,
    LocalServerHarness,
    RUN_ADVANCED_LOCAL_SERVER_FLOWS,
    USERNAME,
    test,
} from './helpers/localServerHarness';
import type { Page } from '@playwright/test';

test.describe('local Mage server tournament smoke', () => {
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

    test('creates a deterministic tournament table before promoting tournament playthroughs', async () => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 after tournament activity selectors and quit cleanup are ready.',
        );

        const fixture = await fixtures.createTournamentTable('constructed tournament');
        await harness.login();
        await harness.expectTableDetails(fixture.tableName, /Waiting for players|WAITING/i);
    });

    test('creates a constructed tournament through the browser dialog', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify the browser create-tournament dialog against a rebuilt local server.',
        );

        const tableName = harness.tableName('browser constructed tournament');
        await harness.login();
        await page.getByRole('button', { name: /Create Tournament/i }).click();
        const dialog = page.getByRole('dialog', { name: 'Create Tournament' });
        await dialog.getByTestId('create-tournament-name-input').fill(tableName);
        await dialog.getByTestId('create-tournament-type-select').selectOption('Constructed Swiss');
        await dialog.getByTestId('create-tournament-game-type-select').selectOption('Two Player Duel');
        await dialog.getByTestId('create-tournament-deck-type-select').selectOption('Constructed - Pauper');
        await dialog.getByTestId('create-tournament-wins-needed-input').fill('2');
        await dialog.getByTestId('create-tournament-rounds-input').fill('3');
        await dialog.getByTestId('create-tournament-time-limit-select').selectOption('MIN__25');
        await dialog.getByTestId('create-tournament-buffer-time-select').selectOption('NONE');
        await dialog.getByTestId('create-tournament-skill-level-select').selectOption('CASUAL');
        await dialog.getByTestId('create-tournament-seat-2-skill').fill('4');
        await dialog.getByRole('button', { name: 'Create Tournament' }).click();

        const row = await harness.expectTableDetails(tableName, /Waiting for players|WAITING/i);
        await expect(row).toContainText(/Tourney|Constructed Swiss|Constructed - Pauper/);
        harness.trackCreatedTable(tableName, await row.getAttribute('data-table-id'));
    });

    test('drives constructed tournament activity controls from live callbacks', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify tournament activity controls against a rebuilt local server.',
        );
        test.setTimeout(180_000);

        const { fixture, tableName, aiName } = await joinBrowserToConstructedTournament(page, harness, fixtures, 'browser tournament activity');

        await openTournamentActivity(page);
        let workspace = await harness.expectActivityWorkspace('tournament');
        let tournamentPanel = workspace.getByTestId('activity-tournament-panel');
        await expect(tournamentPanel).toHaveAttribute('data-tournament-player-count', '2', { timeout: 60_000 });
        await expect(tournamentPanel).toHaveAttribute('data-tournament-match-count', /^[1-9]\d*$/, { timeout: 60_000 });
        await expect(tournamentPanel).toHaveAttribute('data-tournament-timer-kind', /elapsed|remaining|none/);
        await expect(workspace.getByTestId('tournament-name')).toContainText(tableName, { timeout: 60_000 });
        await expect(workspace.getByTestId('tournament-type')).toContainText('Constructed Swiss');
        await expect(workspace.getByTestId('tournament-start-time')).not.toHaveText('-');
        await expect(workspace.getByTestId('tournament-step-timer')).toBeVisible();
        await expect(workspace.getByTestId('activity-tournament-chat')).toBeVisible();

        const standings = tournamentPanel.getByTestId('tournament-standing-row');
        await expect(standings).toHaveCount(2, { timeout: 60_000 });
        await expect(standings.filter({ hasText: USERNAME })).toBeVisible();
        await expect(standings.filter({ hasText: aiName })).toBeVisible();

        const matchRow = tournamentPanel.getByTestId('tournament-match-row').first();
        await expect(matchRow).toBeVisible({ timeout: 60_000 });
        await expect(matchRow).toHaveAttribute('data-can-watch', 'true', { timeout: 60_000 });
        await expect(matchRow.getByTestId('tournament-match-watch-button')).toBeEnabled();
        await matchRow.getByTestId('tournament-match-watch-button').click();

        await openTournamentActivity(page);
        workspace = await harness.expectActivityWorkspace('tournament');
        tournamentPanel = workspace.getByTestId('activity-tournament-panel');

        await expect(workspace.getByTestId('tournament-join-button')).toBeEnabled();
        await workspace.getByTestId('tournament-join-button').click();
        await expect(workspace.getByRole('status')).toContainText(/Tournament joined|Tournament join was rejected/i, { timeout: 20_000 });
        await expect(workspace.getByTestId('tournament-quit-button')).toBeEnabled({ timeout: 20_000 });

        await fixtures.endConstructedTournamentMatch(fixture);
        await openTournamentActivity(page);
        workspace = await harness.expectActivityWorkspace('tournament');
        await expect(workspace).toHaveAttribute('data-activity-status', 'completed', { timeout: 60_000 });
        await expect(page.locator('[data-testid="tracked-activity"][data-activity-kind="tournament"]').first()).toHaveAttribute('data-activity-status', 'completed');
        tournamentPanel = workspace.getByTestId('activity-tournament-panel');
        await expect(tournamentPanel).toHaveAttribute('data-tournament-state', /Completed|FINISHED|Tournament/i);
        await expect(workspace.getByTestId('tournament-over-message')).toBeVisible();

        await workspace.getByTestId('tournament-close-button').click();
        await expect(page.locator('[data-testid="tracked-activity"][data-activity-kind="tournament"]')).toHaveCount(0);
    });

    test('requests constructed tournament quit through live activity controls', async ({ page }) => {
        test.fixme(
            !RUN_ADVANCED_LOCAL_SERVER_FLOWS,
            'Set MAGE_E2E_ADVANCED_FLOWS=1 to verify tournament quit controls against a rebuilt local server.',
        );
        test.setTimeout(180_000);

        await joinBrowserToConstructedTournament(page, harness, fixtures, 'browser tournament quit');

        await openTournamentActivity(page);
        const workspace = await harness.expectActivityWorkspace('tournament');
        const tournamentPanel = workspace.getByTestId('activity-tournament-panel');
        await expect(tournamentPanel).toHaveAttribute('data-tournament-player-count', '2', { timeout: 60_000 });

        await expect(workspace.getByTestId('tournament-quit-button')).toBeEnabled({ timeout: 20_000 });
        await workspace.getByTestId('tournament-quit-button').click();
        const quitDialog = page.getByRole('dialog', { name: 'Confirm quit tournament' });
        await expect(quitDialog).toBeVisible({ timeout: 10_000 });
        await quitDialog.getByRole('button', { name: 'Yes' }).click();
        await expect(workspace.getByRole('status')).toContainText(/Tournament quit requested|Tournament quit was rejected/i, { timeout: 20_000 });
        await expect(workspace.getByTestId('activity-tournament-chat')).toContainText(`${USERNAME} has quit the tournament`, { timeout: 20_000 });

        await workspace.getByTestId('tournament-close-button').click();
        await expect(page.locator('[data-testid="tracked-activity"][data-activity-kind="tournament"]')).toHaveCount(0);
    });
});

async function joinBrowserToConstructedTournament(
    page: Page,
    harness: LocalServerHarness,
    fixtures: LocalServerFixtureManager,
    label: string,
): Promise<{ fixture: LocalServerFixture; tableName: string; aiName: string }> {
    const fixture = await fixtures.createTournamentTable(label);
    const tableName = fixture.tableName;

    await harness.login();
    await harness.expectTableDetails(tableName, /Waiting for players|WAITING/i);
    await page.getByRole('button', { name: 'Join Table' }).click();
    const joinDialog = await harness.expectZoneDialogReady(new RegExp(`Join: ${escapeRegExp(tableName)}`));
    await harness.pasteDeck();
    await expect(joinDialog.getByText(/60 cards/)).toBeVisible({ timeout: 20_000 });
    await joinDialog.getByRole('button', { name: 'Join Table' }).click();
    await harness.expectWaitingRoomReady(/1\/2/);

    await fixtures.startConstructedTournament(fixture);

    return {
        fixture,
        tableName,
        aiName: fixture.aiName ?? `${tableName} AI`,
    };
}

async function openTournamentActivity(page: Page): Promise<void> {
    const tournamentChip = page.locator('[data-testid="activity-chip"][data-activity-kind="tournament"]').first();
    await expect(tournamentChip).toBeVisible({ timeout: 60_000 });
    await tournamentChip.click();
}
