import {
    configureLocalServerSuite,
    expect,
    LocalServerFixtureSession,
    LocalServerHarness,
    SMOKE_DECK,
    SMOKE_DECK_LIST,
    test,
} from './helpers/localServerHarness';

test.describe('local Mage server normal match smoke', () => {
    configureLocalServerSuite();

    let harness: LocalServerHarness;

    test.beforeEach(async ({ page }, testInfo) => {
        harness = new LocalServerHarness(page, testInfo);
        await harness.login();
    });

    test.afterEach(async () => {
        await harness.cleanup();
    });

    test('creates a table with a configured AI seat and carries it into the waiting room', async ({ page }) => {
        const name = harness.tableName('create with ai');
        const aiName = 'Create Flow AI';

        await page.getByRole('button', { name: /Create Table/i }).click();
        const createDialog = page.getByRole('dialog', { name: 'Create Game Table' });
        await createDialog.getByTestId('create-table-name-input').fill(name);
        await createDialog.getByLabel('Format').selectOption('Constructed - Pauper');

        await createDialog.getByRole('button', { name: 'AI' }).click();

        await createDialog.getByTestId('create-table-seat-2-ai-name').fill(aiName);
        await createDialog.getByTestId('create-table-seat-2-ai-skill').fill('4');
        await createDialog.getByRole('button', { name: 'Paste Deck' }).click();
        const pasteDialog = await harness.expectZoneDialogReady('Paste Deck');
        await pasteDialog.locator('textarea.deck-picker-textarea').fill(SMOKE_DECK);
        await pasteDialog.getByRole('button', { name: 'Import' }).click();
        await expect(pasteDialog).toBeHidden({ timeout: 20_000 });
        await expect(createDialog.getByText(/60 cards/)).toBeVisible({ timeout: 20_000 });

        await createDialog.getByRole('button', { name: 'Create Table' }).click();
        await expect(createDialog).toBeHidden({ timeout: 20_000 });

        const row = harness.tableRow(name);
        await expect(row).toBeVisible({ timeout: 20_000 });
        harness.trackCreatedTable(name, await row.getAttribute('data-table-id'));
        await expect(row).toContainText(/1\/2/, { timeout: 20_000 });
        await row.click();
        await expect(page.getByTestId('table-details')).toContainText(aiName, { timeout: 20_000 });

        await harness.joinSelectedTableWithDeck(name, /2\/2/);
        const waitingRoom = page.getByTestId('waiting-room');
        await expect(waitingRoom).toContainText(aiName);
        await harness.expectWaitingRoomReady(/2\/2/);
        await expect(waitingRoom.getByTestId('waiting-room-start-match-button')).toBeEnabled();
    });

    test('refreshes waiting room state from a live table update without losing local selection', async ({ page }) => {
        const name = harness.tableName('waiting refresh');
        const row = await harness.createPauperTable(name);
        const tableId = await row.getAttribute('data-table-id');
        if (!tableId) throw new Error(`Created table "${name}" did not expose data-table-id`);

        await harness.joinSelectedTableWithDeck(name);
        const waitingRoom = page.getByTestId('waiting-room');
        await harness.expectWaitingRoomReady(/1\/2/);

        const firstSeat = waitingRoom.getByTestId('waiting-room-seat').first();
        await firstSeat.click();
        await expect(firstSeat).toHaveAttribute('data-selected', 'true');

        let joiner: LocalServerFixtureSession | null = null;
        try {
            joiner = await LocalServerFixtureSession.connect('waiting-refresh-joiner');
            const joined = await joiner.joinTable(tableId, joiner.userName, 'Human', SMOKE_DECK_LIST);
            expect(joined).toBe(true);

            await expect(waitingRoom.getByTestId('waiting-room-seats')).toContainText(joiner.userName, { timeout: 20_000 });
            await harness.expectWaitingRoomReady(/2\/2/);
            await expect(firstSeat).toHaveAttribute('data-selected', 'true');
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(waitingRoom.getByTestId('waiting-room-start-match-button')).toBeEnabled();
        } finally {
            await joiner?.disconnect(false);
        }
    });

    test('adds AI, starts a match, sends a priority shortcut, and opens a zone through the real server', async ({ page }) => {
        const name = harness.tableName('normal match');
        const aiName = 'P0.5 Smoke AI';

        await harness.createPauperTable(name);
        await harness.joinSelectedTableWithDeck(name);
        await harness.addAiOpponent(aiName);

        const waitingRoom = page.getByTestId('waiting-room');
        await waitingRoom.getByRole('button', { name: 'Start Match' }).click();

        await harness.expectNormalGameReady(aiName);

        await page.keyboard.press('F2');
        await expect(page.getByTestId('game-page')).toBeVisible();

        await page.getByTestId('player-zone-library').click();
        const libraryDialog = await harness.expectZoneDialogReady(/Library/);
        await expect(libraryDialog.getByText('No cards to display')).toBeVisible();
        await libraryDialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(libraryDialog).toBeHidden();

        await page.getByTestId('game-sidebar-toggle').click();
        await expect(page.getByRole('button', { name: 'Concede Game' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Concede / Leave' })).toBeVisible();
        await page.getByRole('button', { name: 'Concede / Leave' }).click();
    });
});
