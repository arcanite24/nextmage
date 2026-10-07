import { expect, test, type Page } from '@playwright/test';

interface VisualSend {
  method: string;
  params: unknown[];
}

async function gotoPrompt(page: Page, prompt: string): Promise<void> {
  await page.goto(`/visual.html?scenario=game&prompt=${prompt}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
}

async function readVisualSends(page: Page): Promise<VisualSend[]> {
  return page.evaluate(() => (window as typeof window & { __mageVisualSends?: VisualSend[] }).__mageVisualSends ?? []);
}

async function expectLastSend(page: Page, method: string, value: unknown): Promise<void> {
  await expect.poll(async () => {
    const sends = await readVisualSends(page);
    return sends.at(-1);
  }).toMatchObject({
    method,
    params: expect.arrayContaining([value]),
  });
}

async function expectSend(page: Page, method: string, value: unknown): Promise<void> {
  await expect.poll(async () => {
    const sends = await readVisualSends(page);
    return sends.some(send => send.method === method && send.params.includes(value));
  }).toBe(true);
}

test.describe('game prompt dialog parity', () => {
  test('ask prompts expose yes/no and Java-style auto-answer controls', async ({ page }) => {
    await gotoPrompt(page, 'ask');

    await expect(page.getByTestId('game-feedback-panel')).toContainText('Pay 2 life');
    await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No', exact: true })).toBeVisible();
    await page.getByTestId('feedback-auto-answer-text-yes').click();

    await expect.poll(() => readVisualSends(page)).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'sendPlayerAction' }),
      expect.objectContaining({ method: 'sendPlayerBoolean', params: expect.arrayContaining([true]) }),
    ]));
  });

  test('priority prompts pass with boolean false and keep hand cards playable', async ({ page }) => {
    await gotoPrompt(page, 'priority');

    await expect(page.getByTestId('game-feedback-panel')).toContainText('Play spells and abilities');
    const firstHandCard = page.locator('[data-testid="hand-card"][data-card-id="00000000-0000-0000-0000-000000000401"]');
    await expect(firstHandCard).toHaveClass(/playable-card/);
    await firstHandCard.click();
    await expectLastSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000401');

    await gotoPrompt(page, 'priority');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expectLastSend(page, 'sendPlayerBoolean', false);

    await gotoPrompt(page, 'priority');
    await page.getByTestId('priority-next-button').click();
    await expectLastSend(page, 'sendPlayerBoolean', false);
  });

  test('declare attackers Done and Next pass the select prompt with boolean false', async ({ page }) => {
    await gotoPrompt(page, 'attackers');

    await expect(page.getByTestId('game-feedback-panel')).toContainText('Select attackers');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expectLastSend(page, 'sendPlayerBoolean', false);

    await gotoPrompt(page, 'attackers');
    await page.getByTestId('priority-next-button').click();
    await expectLastSend(page, 'sendPlayerBoolean', false);
  });

  test('choice prompts support keys, hints, search, mana colors, optional cancel, and special text', async ({ page }) => {
    await gotoPrompt(page, 'choice');

    const dialog = page.getByRole('dialog', { name: 'Make a Choice' });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('game-feedback-panel')).toHaveCount(0);
    await page.getByTestId('card-selector-toolbar').waitFor({ state: 'detached' }).catch(() => undefined);

    await page.getByPlaceholder('Search...').fill('damage');
    await expect(dialog.getByRole('button', { name: /Red/ })).toBeVisible();
    await expect(page.locator('.choice-mana-dot.mana-red')).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Custom text value' }).fill('visual-special-value');
    await page.keyboard.press('Enter');
    await expectLastSend(page, 'sendPlayerString', 'visual-special-value');

    await gotoPrompt(page, 'choice');
    await page.getByRole('dialog', { name: 'Make a Choice' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expectLastSend(page, 'sendPlayerString', '');
  });

  test('large card target prompts expose search, filter, sort, selected state, and nullable completion', async ({ page }) => {
    await gotoPrompt(page, 'target-list');

    await expect(page.getByTestId('card-selector-toolbar')).toBeVisible();
    await expect(page.getByTestId('card-selector-status')).toContainText('4/4 shown');
    await expect(page.getByTestId('card-selector-status')).toContainText('2 valid');
    await expect(page.getByTestId('card-selector-status')).toContainText('1 selected');
    await expect(page.locator('[data-testid="card-selector-card"][data-card-id="00000000-0000-0000-0000-000000000405"]')).toBeDisabled();

    await page.getByTestId('card-selector-search').fill('Opt');
    await expect(page.getByTestId('card-selector-status')).toContainText('1/4 shown');
    await page.getByTestId('card-selector-clear').click();
    await page.getByTestId('card-selector-filter').selectOption('valid');
    await expect(page.getByTestId('card-selector-status')).toContainText('2/4 shown');
    await page.getByTestId('card-selector-sort').selectOption('name');

    await page.getByTestId('card-selector-done').click();
    await expectLastSend(page, 'sendPlayerUUID', null);
  });

  test('mulligan bottom prompts accept direct hand-card clicks', async ({ page }) => {
    await gotoPrompt(page, 'mulligan-bottom');

    await expect(page.getByTestId('game-feedback-panel')).toContainText('put on the bottom of your library');
    await expect(page.getByTestId('card-selector-toolbar')).toHaveCount(0);

    const firstHandCard = page.locator('[data-testid="hand-card"][data-card-id="00000000-0000-0000-0000-000000000401"]');
    await expect(firstHandCard).toHaveClass(/valid-target/);
    await firstHandCard.click();
    await expectLastSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000401');
  });

  test('hand-card prompts survive a higher layer winning the click target', async ({ page }) => {
    await gotoPrompt(page, 'mulligan-bottom');

    const firstHandCard = page.locator('[data-testid="hand-card"][data-card-id="00000000-0000-0000-0000-000000000401"]');
    await expect(firstHandCard).toHaveClass(/valid-target/);
    const cardBox = await firstHandCard.boundingBox();
    expect(cardBox).not.toBeNull();

    await page.evaluate((box) => {
      if (!box) return;
      const blocker = document.createElement('div');
      blocker.dataset.testid = 'hand-click-blocker';
      Object.assign(blocker.style, {
        position: 'fixed',
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        zIndex: '9999',
        background: 'transparent',
      });
      document.body.appendChild(blocker);
    }, cardBox);

    await page.mouse.click(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await expectLastSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000401');
  });

  test('required player and ordered card prompts avoid accidental done clicks', async ({ page }) => {
    await gotoPrompt(page, 'player-target');
    await expect(page.getByText('Select a Player:')).toBeVisible();
    await expect(page.getByTestId('card-selector-done')).toHaveCount(0);
    await page.locator('[data-testid="player-selector-target"][data-player-id="00000000-0000-0000-0000-000000000202"]').click();
    await expectLastSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000202');

    await gotoPrompt(page, 'order');
    await expect(page.getByTestId('card-selector-order-hint')).toBeVisible();
    await expect(page.getByTestId('card-selector-done')).toHaveCount(0);
    await page.locator('[data-testid="card-selector-card"][data-card-id="00000000-0000-0000-0000-000000000401"]').focus();
    await page.keyboard.press('Enter');
    await expectSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000401');
  });

  test('ability, pile, amount, multi-amount, mana, and X-mana prompts use the correct response channels', async ({ page }) => {
    await gotoPrompt(page, 'ability');
    await expect(page.getByTestId('ability-picker-dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /Choose ability 1/ })).toBeFocused();
    await page.keyboard.press('2');
    await expectLastSend(page, 'sendPlayerUUID', '00000000-0000-0000-0000-000000000902');

    await gotoPrompt(page, 'pile');
    await expect(page.getByRole('dialog', { name: 'Choose a Pile' })).toBeVisible();
    await page.getByRole('button', { name: 'Select Pile 2' }).click();
    await expectLastSend(page, 'sendPlayerBoolean', false);

    await gotoPrompt(page, 'amount');
    await expect(page.getByRole('dialog', { name: 'Choose a Number' })).toBeVisible();
    await page.locator('.amount-input').fill('5');
    await page.keyboard.press('Enter');
    await expectLastSend(page, 'sendPlayerInteger', 5);

    await gotoPrompt(page, 'multi-amount');
    await expect(page.getByRole('dialog', { name: 'Distribute Amount' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Distribution' }).click();
    await expectLastSend(page, 'sendPlayerString', '2,2');

    await gotoPrompt(page, 'mana');
    await page.getByTitle('Pay R from pool').click();
    await expect.poll(() => readVisualSends(page)).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'sendPlayerManaType' }),
    ]));

    await gotoPrompt(page, 'mana');
    await page.getByTestId('mana-auto-pay-button').click();
    await expect.poll(async () => {
      const sends = await readVisualSends(page);
      return sends
        .filter(send => send.method === 'sendPlayerManaType')
        .map(send => send.params.at(-1));
    }).toEqual(['RED', 'GREEN']);
    await expect.poll(async () => {
      const sends = await readVisualSends(page);
      return sends.some(send => send.method === 'sendPlayerBoolean');
    }).toBe(false);

    await gotoPrompt(page, 'xmana');
    await page.getByRole('button', { name: 'Done' }).click();
    await expectLastSend(page, 'sendPlayerBoolean', true);
  });

  test('sideboard, construct, and user request prompt surfaces render complete command UI', async ({ page }) => {
    await page.goto('/visual.html?scenario=sideboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('activity-command-panel')).toHaveAttribute('data-activity-command-kind', 'sideboard');
    await expect(page.getByTestId('sideboard-submit-deck-button')).toBeVisible();
    await expect(page.getByTestId('sideboard-reset-button')).toBeVisible();

    await page.goto('/visual.html?scenario=construction', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByTestId('activity-command-panel')).toHaveAttribute('data-activity-command-kind', 'construction');
    await expect(page.getByTestId('construction-submit-deck-button')).toBeVisible();

    await page.goto('/visual.html?scenario=user-request', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true');
    await expect(page.getByRole('dialog', { name: 'Confirm Concede' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep Playing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concede Game' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-visual-user-request-response', '2');
  });
});
