import type { CareerOpponent } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { playCareer } from './careerData';
import { DECK_MIN } from './careerModel';
import type { useCareerDeck } from './useCareerDeck';
import { Versus } from './Versus';

/** The versus screen before a roster duel; Fight starts the table with the Career deck. */
export function RosterVersus({ opponent, deck, onClose }: {
  opponent: CareerOpponent;
  deck: ReturnType<typeof useCareerDeck>;
  onClose(): void;
}) {
  const t = useT();
  return (
    <Versus
      kicker={t('career.tier', { tier: opponent.tier ?? 1, name: opponent.tierName ?? '' })}
      opponent={{ name: opponent.name ?? '', tagline: opponent.tagline, colors: opponent.colors, cover: opponent.cover, line: opponent.lines?.intro }}
      deck={{ name: deck.deck?.name ?? t('career.nav.deck'), art: deck.cover, colors: deck.colors }}
      stakes={[t('career.versus.pays', { coins: opponent.winCoins ?? 0 }), t('career.versus.record', { count: opponent.wins ?? 0 })]}
      onFight={async () => {
        if (!deck.deck) throw new Error(t('career.deck.notReady', { min: DECK_MIN, count: 0 }));
        await playCareer(opponent.id!, deck.deck, opponent.lines ?? null);
      }}
      onClose={onClose}
    />
  );
}
