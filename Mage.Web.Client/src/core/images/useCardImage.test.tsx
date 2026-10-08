import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { CardImageRef } from './imageLinks';
import { useCardImage } from './useCardImage';

const renders = new Map<string, number>();

function Probe({ card }: { card: CardImageRef }) {
  const src = useCardImage(card);
  renders.set(card.name!, (renders.get(card.name!) ?? 0) + 1);
  return <span data-testid={card.name}>{src === null ? 'loading' : String(src)}</span>;
}

const BOLT = { name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' };
const BEAR = { name: 'Grizzly Bears', expansionSetCode: 'M10', cardNumber: '168' };
const OPT = { name: 'Opt', expansionSetCode: 'XLN', cardNumber: '65' };

describe('useCardImage', () => {
  test('a card re-renders when its own picture resolves, not when other cards do', async () => {
    // fetch answers 404 (see setupDom): every printing falls back to a name link once its lookup fails
    const { rerender } = render(<><Probe card={BOLT} /><Probe card={BEAR} /></>);
    await waitFor(() => expect(screen.getByTestId('Lightning Bolt').textContent).toContain('cards/named'));
    await waitFor(() => expect(screen.getByTestId('Grizzly Bears').textContent).toContain('cards/named'));
    const bolt = renders.get('Lightning Bolt')!;
    const bear = renders.get('Grizzly Bears')!;

    // a third card mounts and resolves: the first two hear nothing
    rerender(<><Probe card={BOLT} /><Probe card={BEAR} /><Probe card={OPT} /></>);
    await waitFor(() => expect(screen.getByTestId('Opt').textContent).toContain('cards/named'));
    // the rerender itself renders each probe once more, nothing beyond that
    expect(renders.get('Lightning Bolt')).toBe(bolt + 1);
    expect(renders.get('Grizzly Bears')).toBe(bear + 1);
  });
});
