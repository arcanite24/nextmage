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

test.describe('battlefield parity selectors', () => {
  test('multi-opponent fixture exposes desktop battlefield layout cases', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    await expect(myBattlefield).toHaveAttribute('data-hidden-phased-count', '1');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000307"]')).toHaveCount(0);
    const stackSizesForCardName = async (cardName: string) => myBattlefield
      .locator(`.card-stack:has([data-card-name="${cardName}"])`)
      .evaluateAll((stacks) => stacks
        .map(stack => Number(stack.getAttribute('data-stack-size') ?? 0))
        .sort((first, second) => second - first));
    await expect.poll(() => stackSizesForCardName('Forest')).toEqual([5, 2]);
    await expect.poll(() => stackSizesForCardName('Saproling Token')).toEqual([5, 2]);
    await expect(myBattlefield.locator('.card-stack[data-attachment-count="2"]')).toHaveCount(1);
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000301"]')).toHaveAttribute('data-attachment-host', 'true');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000304"]')).toHaveAttribute('data-attached-card', 'true');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000306"]')).toHaveAttribute('data-controller-differs', 'true');
    await expect(myBattlefield).toHaveAttribute('data-attached-permanent-count', '3');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000303"]')).toHaveAttribute('data-attachment-host', 'true');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000335"]')).toHaveAttribute('data-attached-card', 'true');
    const auraAttachment = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000304"]');
    const equipmentAttachment = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000306"]');
    const fortificationAttachment = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000335"]');
    await expect(auraAttachment).toHaveAttribute('data-attachment-depth', '1');
    await expect(equipmentAttachment).toHaveAttribute('data-attached-card', 'true');
    await expect(equipmentAttachment).toHaveAttribute('data-attachment-depth', '2');
    await expect(fortificationAttachment).toHaveAttribute('data-attachment-depth', '1');
    await expect(fortificationAttachment).toHaveAttribute('data-card-name', 'Darksteel Garrison');
    await expect(fortificationAttachment).toHaveAttribute('data-controller-differs', 'false');
    const attachmentHitTargets = await myBattlefield.evaluate((battlefield) => {
      const hitCardAtCenter = (cardId: string) => {
        const card = battlefield.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null;
      };
      return {
        aura: hitCardAtCenter('00000000-0000-0000-0000-000000000304'),
        equipment: hitCardAtCenter('00000000-0000-0000-0000-000000000306'),
      };
    });
    expect(attachmentHitTargets.aura).toBe('00000000-0000-0000-0000-000000000304');
    expect(attachmentHitTargets.equipment).toBe('00000000-0000-0000-0000-000000000306');
    const backRow = myBattlefield.locator('[data-row-role="back"]');
    const landZone = backRow.locator('[data-zone-key="LANDS"]');
    const artifactZone = backRow.locator('[data-zone-key="ARTIFACTS"]');
    await expect(landZone).toHaveAttribute('data-zone-alignment', 'center');
    await expect(artifactZone).toHaveAttribute('data-zone-alignment', 'center');
    await expect(artifactZone).toHaveAttribute('data-zone-starts-alignment-group', 'false');
    await expect.poll(async () => artifactZone.evaluate((zone) => ({
      justifyContent: getComputedStyle(zone).justifyContent,
      marginLeft: getComputedStyle(zone).marginLeft,
    }))).toEqual({
      justifyContent: 'center',
      marginLeft: '0px',
    });
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000334"]')).toBeVisible();
    await expect(landZone.locator('[data-card-id="00000000-0000-0000-0000-000000000335"]')).toHaveCount(1);
    await expect(artifactZone.locator('[data-card-id="00000000-0000-0000-0000-000000000335"]')).toHaveCount(0);
    await fortificationAttachment.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const fortificationHitTarget = await fortificationAttachment.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null;
    });
    expect(fortificationHitTarget).toBe('00000000-0000-0000-0000-000000000335');
    await expect(myBattlefield).toHaveAttribute('data-battlefield-card-size', '14');
    await expect(page.getByTestId('player-avatar-life')).toHaveCount(1);
    expect(await page.getByTestId('opponent-avatar-life').count()).toBeGreaterThan(0);
    await page.getByTestId('match-life-on-avatar-toggle').evaluate((element) => {
      (element as HTMLInputElement).click();
    });
    await expect(page.getByTestId('player-avatar-life')).toHaveCount(0);
    await expect(page.getByTestId('opponent-avatar-life')).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) >= 700) {
      const rowGeometry = await backRow.evaluate((row) => {
        const lands = row.querySelector<HTMLElement>('[data-zone-key="LANDS"]');
        const artifacts = row.querySelector<HTMLElement>('[data-zone-key="ARTIFACTS"]');
        return {
          landRight: lands?.getBoundingClientRect().right ?? 0,
          artifactLeft: artifacts?.getBoundingClientRect().left ?? 0,
        };
      });
      expect(rowGeometry.artifactLeft).toBeGreaterThan(rowGeometry.landRight);

      const attacker = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000301"]');
      const initialCardBox = await attacker.boundingBox();
      expect(initialCardBox?.width ?? 0).toBeGreaterThan(0);
      await page.getByTestId('match-battlefield-card-size').fill('28');
      await expect(myBattlefield).toHaveAttribute('data-battlefield-card-size', '28');
      await expect.poll(async () => (await attacker.boundingBox())?.width ?? 0).toBeGreaterThan((initialCardBox?.width ?? 0) * 1.4);
    }
    const attachmentLayering = await myBattlefield.evaluate((battlefield) => {
      const host = battlefield.querySelector<HTMLElement>('[data-card-id="00000000-0000-0000-0000-000000000301"]');
      const attachment = battlefield.querySelector<HTMLElement>('[data-card-id="00000000-0000-0000-0000-000000000304"]');
      return {
        hostZIndex: host ? Number(getComputedStyle(host).zIndex) : 0,
        attachmentZIndex: attachment ? Number(getComputedStyle(attachment).zIndex) : 0,
      };
    });
    expect(attachmentLayering.hostZIndex).toBeGreaterThan(attachmentLayering.attachmentZIndex);
    for (const faceDownVariant of [
      { id: '00000000-0000-0000-0000-000000000308', state: 'Morph', badge: 'Mo' },
      { id: '00000000-0000-0000-0000-000000000336', state: 'Manifest', badge: 'Mf' },
      { id: '00000000-0000-0000-0000-000000000337', state: 'Disguise', badge: 'Dg' },
      { id: '00000000-0000-0000-0000-000000000338', state: 'Cloak', badge: 'Cl' },
    ]) {
      const permanent = myBattlefield.locator(`[data-card-id="${faceDownVariant.id}"]`);
      await expect(permanent).toHaveAttribute('data-face-down-state', faceDownVariant.state);
      await expect(permanent.getByTestId('battlefield-facedown-badge')).toHaveText(faceDownVariant.badge);
    }
    await expect(myBattlefield.locator('[data-card-icon-type="ABILITY_TRAMPLE"]')).toHaveText('Tr');
    await expect(myBattlefield.locator('[data-card-icon-type="ABILITY_TRAMPLE"]')).toHaveAttribute('title', 'Trample');
    await expect(myBattlefield.locator('[data-card-icon-type="COMMANDER"]')).toHaveText('Cmd');
    await expect(myBattlefield.locator('[data-card-icon-type="COMMANDER"]')).toHaveAttribute('data-card-icon-category', 'commander');
    const selectedPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000301"]');
    await expect(selectedPermanent).toHaveAttribute('data-selected-state', 'true');
    await expect(selectedPermanent).toHaveAttribute('data-choosable-state', 'true');
    await expect(selectedPermanent).toHaveAttribute('data-playable-amount', '2');
    await expect(selectedPermanent.getByTestId('battlefield-selected-badge')).toHaveText('Sel');
    await expect(selectedPermanent.getByTestId('battlefield-choosable-badge')).toHaveText('Ch');
    await expect(selectedPermanent.getByTestId('battlefield-playable-badge')).toHaveText('P2');
    await expect(myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000331"]')).toHaveAttribute('data-mutated', 'true');
    const transformedPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000332"]');
    await expect(transformedPermanent).toHaveAttribute('data-transformed-state', 'true');
    await expect(transformedPermanent.getByTestId('battlefield-double-faced-badge')).toHaveText('B');
    const flippedPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000349"]');
    await expect(flippedPermanent).toHaveAttribute('data-flipped-state', 'true');
    await expect(flippedPermanent.getByTestId('battlefield-flipped-badge')).toHaveText('FL');
    await expect.poll(async () => flippedPermanent.locator('img').evaluate((image) => getComputedStyle(image).transform)).not.toBe('none');
    await expect(myBattlefield.getByTestId('battlefield-copy-source-button')).toHaveCount(1);
    await expect(myBattlefield.getByTestId('battlefield-alternate-button')).toHaveCount(1);
    await expect(myBattlefield.getByTestId('battlefield-mutate-button')).toHaveCount(1);
    await expect(page.getByTestId('combat-overlay')).toBeVisible();
    await expect(page.getByTestId('combat-line-attack')).toHaveCount(1);
    await expect(page.getByTestId('combat-line-block')).toHaveCount(1);

    const mutatedPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000331"]');
    await mutatedPermanent.hover();
    await mutatedPermanent.getByTestId('battlefield-mutate-button').click();
    await expect(page.getByTestId('card-preview-mutate-stack')).toContainText('Auspicious Starrix');
    await page.getByLabel('Close card preview').click();

    const doubleFacedPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000332"]');
    await doubleFacedPermanent.hover();
    await doubleFacedPermanent.getByTestId('battlefield-alternate-button').click();
    await expect(page.getByRole('heading', { name: 'Insectile Aberration' })).toBeVisible();
    await page.getByLabel('Close card preview').click();

    const copyPermanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000305"]');
    await copyPermanent.hover();
    await copyPermanent.getByTestId('battlefield-copy-source-button').click();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Runeclaw Bear' })).toBeVisible();
    await page.getByLabel('Close card preview').click();

    await page.evaluate(() => {
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends = [];
    });
    await auraAttachment.hover();
    await auraAttachment.getByTestId('battlefield-inspect-button').click();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Rancor' })).toBeVisible();
    await page.getByLabel('Close card preview').click();

    await equipmentAttachment.dblclick();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Runechanter Pike' })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ))).toEqual([]);
    await page.getByLabel('Close card preview').click();

    await fortificationAttachment.hover();
    await fortificationAttachment.getByTestId('battlefield-inspect-button').click();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Darksteel Garrison' })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ))).toEqual([]);
    await page.getByLabel('Close card preview').click();

    const horizontalOverflow = await page.evaluate(() =>
      Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth)
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });

  test('multi-opponent fixture applies battlefield grouping settings', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&cardTypes=java');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    const groupingSelect = page.getByTestId('match-battlefield-grouping');
    await expect(myBattlefield).toHaveClass(/grouping-separate/);
    await expect(groupingSelect).toHaveValue('separate');
    const frontRow = myBattlefield.locator('[data-row-role="front"]');
    const backRow = myBattlefield.locator('[data-row-role="back"]');
    await expect(frontRow.locator('[data-zone-key="CREATURES"]')).toBeVisible();
    await expect(frontRow.locator('[data-zone-key="CREATURES"] [data-card-id="00000000-0000-0000-0000-000000000301"]')).toHaveCount(1);
    await expect(backRow.locator('[data-zone-key="LANDS"]')).toBeVisible();
    await expect(backRow.locator('[data-zone-key="LANDS"] [data-card-id="00000000-0000-0000-0000-000000000303"]')).toHaveCount(1);
    await expect(backRow.locator('[data-zone-key="ARTIFACTS"]')).toBeVisible();
    await expect(backRow.locator('[data-zone-key="ARTIFACTS"] [data-card-id="00000000-0000-0000-0000-000000000334"]')).toHaveCount(1);
    await expect(frontRow).toHaveAttribute('data-zone-count', '1');
    await expect.poll(async () => Number(await backRow.getAttribute('data-zone-count'))).toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends = [];
    });

    await groupingSelect.selectOption('nonlands');
    await expect(myBattlefield).toHaveClass(/grouping-nonlands/);
    await expect(frontRow.locator('[data-zone-key="NONLANDS"]')).toBeVisible();
    await expect(frontRow.locator('[data-zone-key="NONLANDS"] [data-card-id="00000000-0000-0000-0000-000000000301"]')).toHaveCount(1);
    await expect(frontRow.locator('[data-zone-key="NONLANDS"] [data-card-id="00000000-0000-0000-0000-000000000334"]')).toHaveCount(1);
    await expect(frontRow.locator('[data-zone-key="CREATURES"]')).toHaveCount(0);
    await expect(backRow.locator('[data-zone-key="LANDS"]')).toBeVisible();
    await expect(backRow.locator('[data-zone-key="LANDS"] [data-card-id="00000000-0000-0000-0000-000000000303"]')).toHaveCount(1);
    await expect(backRow.locator('[data-zone-key="ARTIFACTS"]')).toHaveCount(0);

    await groupingSelect.selectOption('creature-land-other');
    await expect(myBattlefield).toHaveClass(/grouping-creature-land-other/);
    await expect(frontRow.locator('[data-zone-key="CREATURES"]')).toBeVisible();
    await expect(frontRow.locator('[data-zone-key="CREATURES"] [data-card-id="00000000-0000-0000-0000-000000000301"]')).toHaveCount(1);
    await expect(frontRow.locator('[data-zone-key="NONLANDS"]')).toHaveCount(0);
    await expect(backRow.locator('[data-zone-key="LANDS"]')).toBeVisible();
    await expect(backRow.locator('[data-zone-key="LANDS"] [data-card-id="00000000-0000-0000-0000-000000000303"]')).toHaveCount(1);
    await expect(backRow.locator('[data-zone-key="OTHER"]')).toBeVisible();
    await expect(backRow.locator('[data-zone-key="OTHER"] [data-card-id="00000000-0000-0000-0000-000000000334"]')).toHaveCount(1);
    await expect(backRow.locator('[data-zone-key="ARTIFACTS"]')).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ))).toEqual([]);

    const horizontalOverflow = await page.evaluate(() =>
      Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth)
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });

  test('large Commander fixture keeps crowded battlefield reachable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&board=large-commander');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    const visiblePermanentCount = Number(await myBattlefield.getAttribute('data-visible-permanent-count'));
    const rootPermanentCount = Number(await myBattlefield.getAttribute('data-root-permanent-count'));
    expect(visiblePermanentCount).toBeGreaterThanOrEqual(80);
    expect(rootPermanentCount).toBeGreaterThanOrEqual(78);

    const layoutMetrics = await myBattlefield.evaluate((battlefield) => {
      const largeCards = Array.from(battlefield.querySelectorAll<HTMLElement>('[data-card-id^="00000000-0000-0000-0000-0000000007"]'));
      const frontCards = largeCards.filter(card => Boolean(card.closest('[data-row-role="front"]')));
      const backCards = largeCards.filter(card => Boolean(card.closest('[data-row-role="back"]')));
      const wrappedRows = (cards: HTMLElement[]) => new Set(cards.map(card => {
        const stack = card.closest<HTMLElement>('.card-stack, .stack-expanded-wrapper') ?? card;
        return Math.round(stack.getBoundingClientRect().top / 8);
      })).size;
      return {
        largeCardCount: largeCards.length,
        frontWrappedRows: wrappedRows(frontCards),
        backWrappedRows: wrappedRows(backCards),
        scrollHeight: battlefield.scrollHeight,
        clientHeight: battlefield.clientHeight,
        horizontalOverflow: Math.ceil(battlefield.scrollWidth - battlefield.clientWidth),
      };
    });
    expect(layoutMetrics.largeCardCount).toBe(62);
    expect(layoutMetrics.frontWrappedRows).toBeGreaterThan(1);
    expect(layoutMetrics.backWrappedRows).toBeGreaterThan(2);
    expect(layoutMetrics.scrollHeight).toBeGreaterThan(layoutMetrics.clientHeight);
    expect(layoutMetrics.horizontalOverflow).toBeLessThanOrEqual(1);

    for (const cardId of [
      '00000000-0000-0000-0000-000000000700',
      '00000000-0000-0000-0000-000000000717',
      '00000000-0000-0000-0000-000000000729',
      '00000000-0000-0000-0000-000000000747',
      '00000000-0000-0000-0000-000000000763',
      '00000000-0000-0000-0000-000000000773',
      '00000000-0000-0000-0000-000000000797',
    ]) {
      const card = myBattlefield.locator(`[data-card-id="${cardId}"]`);
      await expect(card).toHaveCount(1);
      await card.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const hitCardId = await card.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null;
      });
      expect(hitCardId).toBe(cardId);
    }

    const horizontalOverflow = await page.evaluate(() =>
      Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth)
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });

  test('controllable fixture routes battlefield card interactions through guarded callback paths', async ({ page }, testInfo) => {
    const gameId = '00000000-0000-0000-0000-000000000103';
    const sessionId = 'visual-session';
    const attackerId = '00000000-0000-0000-0000-000000000301';
    const copyId = '00000000-0000-0000-0000-000000000305';
    const mutateId = '00000000-0000-0000-0000-000000000331';
    const doubleFacedId = '00000000-0000-0000-0000-000000000332';
    const readSends = async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ));
    const resetSends = async () => page.evaluate(() => {
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends = [];
    });
    const wheelInspect = async (card: ReturnType<typeof page.locator>) => {
      await card.dispatchEvent('wheel', { deltaY: 180, bubbles: true, cancelable: true });
    };
    const closePreview = async () => {
      await page.getByLabel('Close card preview').click();
      await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);
    };

    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator(`[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]`);
    const attacker = myBattlefield.locator(`[data-card-id="${attackerId}"]`);
    await expect(attacker).toHaveCount(1);

    await resetSends();
    await attacker.click();
    await expect.poll(async () => readSends()).toEqual([
      { method: 'sendPlayerUUID', params: [gameId, sessionId, attackerId] },
    ]);
    await expect(page.getByTestId('card-preview-modal')).toHaveCount(0);

    await resetSends();
    await attacker.dblclick();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Llanowar Elves' })).toBeVisible();
    await page.waitForTimeout(260);
    expect(await readSends()).toEqual([]);
    await closePreview();

    if (testInfo.project.name === 'chromium-desktop') {
      await resetSends();
      await attacker.click({ button: 'right' });
      await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Llanowar Elves' })).toBeVisible();
      await page.waitForTimeout(260);
      expect(await readSends()).toEqual([]);
      await closePreview();
    }

    await resetSends();
    await attacker.hover();
    await expect(page.getByTestId('match-hover-preview')).toBeVisible();
    await page.waitForTimeout(260);
    expect(await readSends()).toEqual([]);

    await resetSends();
    await attacker.click({ modifiers: ['Meta'] });
    await expect.poll(async () => readSends()).toEqual([
      { method: 'sendPlayerAction', params: ['HOLD_PRIORITY', gameId, sessionId, null] },
      { method: 'sendPlayerUUID', params: [gameId, sessionId, attackerId] },
    ]);

    const doubleFacedPermanent = myBattlefield.locator(`[data-card-id="${doubleFacedId}"]`);
    await resetSends();
    await doubleFacedPermanent.hover();
    await wheelInspect(doubleFacedPermanent);
    await expect(page.getByRole('heading', { name: 'Insectile Aberration' })).toBeVisible();
    await page.waitForTimeout(260);
    expect(await readSends()).toEqual([]);
    await closePreview();

    const copyPermanent = myBattlefield.locator(`[data-card-id="${copyId}"]`);
    await resetSends();
    await copyPermanent.hover();
    await wheelInspect(copyPermanent);
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Runeclaw Bear' })).toBeVisible();
    await page.waitForTimeout(260);
    expect(await readSends()).toEqual([]);
    await closePreview();

    const mutatedPermanent = myBattlefield.locator(`[data-card-id="${mutateId}"]`);
    await resetSends();
    await mutatedPermanent.hover();
    await wheelInspect(mutatedPermanent);
    await expect(page.getByTestId('card-preview-mutate-stack')).toContainText('Auspicious Starrix');
    await page.waitForTimeout(260);
    expect(await readSends()).toEqual([]);
    await closePreview();
  });

  test('multi-opponent fixture exposes battlefield departure feedback', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&feedback=departure');
    const eventMessage = page.getByTestId('battlefield-event-message').filter({ hasText: 'Llanowar Elves died' });
    await Promise.all([
      expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 }),
      expect(eventMessage).toBeVisible(),
    ]);
    await expect(eventMessage).toHaveAttribute('data-event-kind', 'died');
  });

  test('multi-opponent fixture exposes player life and counter feedback', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&feedback=player-state');
    const damageNumber = page.getByTestId('damage-number').filter({ hasText: '-3' });
    const poisonGain = page.locator('[data-testid="player-counter-effect"][data-counter-name="poison"][data-effect-type="counterGain"]');
    const poisonLoss = page.locator('[data-testid="player-counter-effect"][data-counter-name="poison"][data-effect-type="counterLoss"]');
    await Promise.all([
      expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 }),
      expect(damageNumber).toBeVisible(),
      expect(poisonGain).toHaveAttribute('data-player-id', '00000000-0000-0000-0000-000000000201'),
      expect(poisonGain).toHaveAttribute('data-previous-value', '0'),
      expect(poisonGain).toHaveAttribute('data-current-value', '3'),
      expect(poisonLoss).toHaveAttribute('data-player-id', '00000000-0000-0000-0000-000000000202'),
    ]);
  });

  test('multi-opponent fixture exposes battlefield state-change feedback', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mage.client.settings.v1', JSON.stringify({
        animationsEnabled: true,
        animationSpeed: 0.5,
      }));
    });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&feedback=state-change');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    await expect.poll(async () => myBattlefield.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--battlefield-feedback-duration').trim()
    )).toBe('1520ms');

    const feedbackCases = [
      { id: '00000000-0000-0000-0000-000000000301', kind: 'untapped' },
      { id: '00000000-0000-0000-0000-000000000303', kind: 'attachment' },
      { id: '00000000-0000-0000-0000-000000000305', kind: 'damaged' },
      { id: '00000000-0000-0000-0000-000000000332', kind: 'transformed' },
      { id: '00000000-0000-0000-0000-000000000349', kind: 'flipped' },
      { id: '00000000-0000-0000-0000-000000000350', kind: 'entered' },
    ];
    for (const { id, kind } of feedbackCases) {
      const card = myBattlefield.locator(`[data-card-id="${id}"]`);
      await expect(card).toHaveAttribute('data-feedback-kind', kind);
      await expect(card).toHaveClass(new RegExp(`battlefield-feedback-${kind}`));
    }

    const opponentBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000202"]');
    const blocker = opponentBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000302"]');
    await expect(blocker).toHaveAttribute('data-feedback-kind', 'combat');
    await expect(blocker).toHaveClass(/battlefield-feedback-combat/);

    const attackerImageAnimation = await myBattlefield
      .locator('[data-card-id="00000000-0000-0000-0000-000000000301"] img')
      .evaluate((image) => getComputedStyle(image).animationName);
    expect(attackerImageAnimation).toBe('none');
  });

  test('replay fixture keeps battlefield inspection read-only', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game&replay=1');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    const permanent = myBattlefield.locator('[data-card-id="00000000-0000-0000-0000-000000000301"]');

    const hitTestTarget = await permanent.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        cardId: hit?.closest('[data-card-id]')?.getAttribute('data-card-id') ?? null,
        blockedByPlayerHud: Boolean(hit?.closest('.arena-avatar-container, .arena-player-info-left, .arena-hand-area')),
      };
    });
    expect(hitTestTarget.cardId).toBe('00000000-0000-0000-0000-000000000301');
    expect(hitTestTarget.blockedByPlayerHud).toBe(false);

    await page.evaluate(() => {
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends = [];
    });

    await permanent.dblclick();
    await expect(page.getByTestId('card-preview-modal').getByRole('heading', { name: 'Llanowar Elves' })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ))).toEqual([]);
    await page.getByLabel('Close card preview').click();

    await page.evaluate(() => {
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends = [];
    });
    await permanent.click({ modifiers: ['Control'] });
    await page.waitForTimeout(300);
    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> }).__mageVisualSends ?? []
    ))).toEqual([]);
  });

  test('combat overlay redraws after battlefield scroll movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/visual.html?scenario=multi-opponent-game');
    await expect(page.locator('body')).toHaveAttribute('data-visual-ready', 'true', { timeout: 10_000 });

    const myBattlefield = page.locator('[data-testid="battlefield"][data-player-id="00000000-0000-0000-0000-000000000201"]');
    const attackLine = page.getByTestId('combat-line-attack').locator('line.combat-line-attack');
    await expect(attackLine).toHaveCount(1);
    const startingY = await attackLine.getAttribute('y1');

    const scrollState = await myBattlefield.evaluate((element) => {
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      const startingScrollTop = element.scrollTop;
      element.scrollTop = Math.min(maxScrollTop, startingScrollTop + Math.max(24, Math.floor(maxScrollTop / 2)));
      element.dispatchEvent(new Event('scroll'));

      return {
        maxScrollTop,
        startingScrollTop,
        endingScrollTop: element.scrollTop,
      };
    });

    expect(scrollState.maxScrollTop).toBeGreaterThan(0);
    expect(scrollState.endingScrollTop).toBeGreaterThan(scrollState.startingScrollTop);
    await expect.poll(async () => attackLine.getAttribute('y1'), { timeout: 2_000 }).not.toBe(startingY);
  });
});
