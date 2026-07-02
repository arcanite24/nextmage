import { expect, test } from '@playwright/test';

const CORE_SCREEN_SCENARIOS = [
  'login',
  'lobby',
  'waiting-room',
  'game',
  'multi-opponent-game',
  'deck-manager',
  'deck-editor',
  'draft',
  'tournament',
  'settings',
  'card-viewer',
  'notifications',
] as const;

const ACTIVITY_COMMAND_CONTRACTS = [
  {
    scenario: 'replay',
    kind: 'replay',
    status: 'active',
    buttons: [
      'replay-previous-button',
      'replay-next-button',
      'replay-skip-forward-button',
      'replay-autoplay-button',
      'replay-stop-button',
    ],
  },
  {
    scenario: 'tournament',
    kind: 'tournament',
    status: 'waiting',
    buttons: [
      'tournament-join-button',
      'tournament-watch-button',
      'tournament-quit-button',
    ],
  },
  {
    scenario: 'draft',
    kind: 'draft',
    status: 'active',
    buttons: [
      'draft-pick-button',
      'draft-mark-button',
      'draft-booster-loaded-button',
      'draft-quit-button',
    ],
  },
  {
    scenario: 'sideboard',
    kind: 'sideboard',
    status: 'waiting',
    buttons: [
      'sideboard-submit-deck-button',
      'sideboard-reset-button',
    ],
  },
  {
    scenario: 'construction',
    kind: 'construction',
    status: 'waiting',
    buttons: [
      'construction-submit-deck-button',
      'construction-add-lands-button',
    ],
  },
] as const;

test.describe('core Arena screen visual regression', () => {
  for (const scenario of CORE_SCREEN_SCENARIOS) {
    test(`${scenario} screen`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
      await page.goto(`/visual.html?scenario=${scenario}`);
      await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });
      const horizontalOverflow = await page.evaluate(() =>
        Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth)
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
      await expect(page).toHaveScreenshot(`${scenario}-${testInfo.project.name}.png`, {
        fullPage: true,
      });
    });
  }
});

test.describe('activity workspace promotion selectors', () => {
  for (const contract of ACTIVITY_COMMAND_CONTRACTS) {
    test(`${contract.kind} controls expose stable disabled selectors`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
      await page.goto(`/visual.html?scenario=${contract.scenario}`);
      await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

      const workspace = page.getByTestId('activity-workspace');
      await expect(workspace).toHaveAttribute('data-activity-kind', contract.kind);
      await expect(workspace).toHaveAttribute('data-activity-status', contract.status);
      await expect(workspace).not.toHaveAttribute('data-activity-object-id', 'none');

      const commandPanel = page.getByTestId('activity-command-panel');
      await expect(commandPanel).toHaveAttribute('data-activity-command-kind', contract.kind);
      await expect(commandPanel).toHaveAttribute('data-controls-ready', 'false');
      await expect(commandPanel).toHaveAttribute('data-command-count', String(contract.buttons.length));

      for (const buttonTestId of contract.buttons) {
        const button = page.getByTestId(buttonTestId);
        await expect(button).toBeVisible();
        await expect(button).toBeDisabled();
      }
    });
  }
});
