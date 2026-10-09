import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { CareerOpponent } from '../../protocol/generated/views';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { usePlay } from '../stores/play';
import { Button } from '../ui/Button';
import { useCareerOpponents, useCareerState } from './careerData';
import { WINS_TO_UNLOCK, tiersOf } from './careerModel';
import { useSceneArt } from './careerScene';
import { nextOpponent } from './hubModel';
import { dealStyle } from './motion';
import { PortraitCard } from './Portraits';
import { RosterVersus } from './rosterPlay';
import { useCareerDeck } from './useCareerDeck';
import motion from './motion.module.css';
import styles from './CareerLadder.module.css';

registerMessages(messages);

/** The opponent ladder: each tier a row of portraits, climbed left to right and bottom to top. */
export function CareerOpponentsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const state = useCareerState();
  const profile = state.data?.profile;
  const opponents = useCareerOpponents(!!profile);
  const deck = useCareerDeck(profile);
  const playing = usePlay((play) => play.phase !== 'idle');
  const [versus, setVersus] = useState<CareerOpponent | null>(null);
  const roster = useMemo(() => opponents.data ?? [], [opponents.data]);
  const tiers = useMemo(() => tiersOf(roster), [roster]);
  const next = useMemo(() => nextOpponent(roster), [roster]);
  useSceneArt(next?.cover);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;

  let dealt = 0;
  return (
    <div className={styles.ladder}>
      {deck.problem && (
        <div className={styles.deckWarning} role="status">
          <span>{deck.problem}</span>
          <Button variant="decision" size="sm" onClick={() => navigate('/career/deck')} data-nav>{t('career.deck.fix')}</Button>
        </div>
      )}
      {opponents.isPending && <p className={styles.note}>{t('career.loading')}</p>}
      {opponents.isError && <p className={styles.note} role="alert">{t('career.failed')}</p>}
      {/* the top tier first: the ladder reads upward, toward the champions */}
      {[...tiers].reverse().map((tier, index, all) => {
        const below = all[index + 1];
        const progress = !tier.unlocked
          ? t('career.tier.locked', { needed: WINS_TO_UNLOCK })
          : index > 0 || tiers.length === 1 ? (tier.wins >= WINS_TO_UNLOCK ? t('career.tier.done') : t('career.tier.progress', { wins: tier.wins, needed: WINS_TO_UNLOCK }))
            : null;
        return (
          <section key={tier.tier} className={[styles.tier, tier.unlocked ? '' : styles.tierLocked].join(' ')} aria-labelledby={`tier-${tier.tier}`}>
            <header className={styles.tierHead}>
              <span className={styles.rung} aria-hidden="true">{tier.tier}</span>
              <h2 id={`tier-${tier.tier}`}>{tier.name}</h2>
              {progress && <small>{!tier.unlocked && <Lock size={14} aria-hidden="true" />} {progress}</small>}
              {!tier.unlocked && below && (
                <span className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={WINS_TO_UNLOCK} aria-valuenow={Math.min(below.wins, WINS_TO_UNLOCK)} aria-label={t('career.tier.progress', { wins: Math.min(below.wins, WINS_TO_UNLOCK), needed: WINS_TO_UNLOCK })}>
                  {Array.from({ length: WINS_TO_UNLOCK }, (_, i) => <i key={i} className={i < below.wins ? styles.meterOn : undefined} />)}
                </span>
              )}
            </header>
            <ul className={styles.row}>
              {tier.opponents.map((opponent) => {
                const order = dealt++;
                const locked = !opponent.unlocked;
                return (
                  <li key={opponent.id}>
                    <PortraitCard
                      name={opponent.name ?? ''}
                      tagline={opponent.tagline}
                      colors={opponent.colors}
                      cover={opponent.cover}
                      locked={locked}
                      selected={opponent.id === next?.id}
                      className={motion.deal}
                      style={dealStyle(order)}
                      label={locked ? `${opponent.name}, ${t('career.opponent.locked')}` : t('career.hub.face', { opponent: opponent.name ?? '' })}
                      onPick={locked || playing || !!deck.problem || !deck.deck ? undefined : () => setVersus(opponent)}
                    >
                      <span className={styles.wins}>
                        {t('career.opponent.wins', { count: opponent.wins ?? 0 })}
                      </span>
                      <span className={styles.pays}>+{opponent.winCoins ?? 0}</span>
                    </PortraitCard>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {versus && <RosterVersus opponent={versus} deck={deck} onClose={() => setVersus(null)} />}
    </div>
  );
}
