import {
    configureLocalServerSuite,
    LocalServerFixtureManager,
    LocalServerHarness,
    RUN_ADVANCED_LOCAL_SERVER_FLOWS,
    test,
} from './helpers/localServerHarness';

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
});
