import { Check, Coins, Crown, Flag, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { CareerGauntletState, CareerOffer, CareerOfferOption, CareerRun, CareerRunReward } from '../../protocol/generated/views';
import { api } from '../connection';
import { formatDate, registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { usePlay } from '../stores/play';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CareerBar } from './CareerBar';
import { useCareerState } from './careerData';
import { abandonGauntlet, pickGauntlet, playMode, startGauntlet, useGauntlet } from './careerModesData';
import { mergeByName, rewardLines, runReward, toggleChoice, twistLines } from './careerModesModel';
import { Crest, Portrait } from './ModeArt';
import { ModeResult, ModesNav } from './ModeParts';
import styles from './CareerModes.module.css';

registerMessages(messages);

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** The gauntlet: pay in, build a deck from starting packs, then climb eight bosses; one loss ends the run. */
export function CareerGauntletScreen() {
  const t = useT();
  const state = useCareerState();
  const profile = state.data?.profile;
  const gauntlet = useGauntlet(!!profile);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  const data = gauntlet.data;
  const run = data?.run;

  return (
    <div className={styles.page}>
      <CareerBar profile={profile} />
      <ModesNav />
      <div className={styles.scroll}>
        <ModeResult kind="gauntlet" />
        <header className={styles.modeHead}>
          <div>
            <h1 className={styles.modeTitle}>{t('career.gauntlet.title')}</h1>
            <p className={styles.lead}>{t('career.gauntlet.lead', { max: data?.maxWins ?? 8 })}</p>
          </div>
          {data && (data.bestWins ?? 0) > 0 && <p className={styles.progressNote}>{t('career.gauntlet.best', { wins: data.bestWins ?? 0 })}</p>}
        </header>
        {gauntlet.isPending && <p className={styles.note}>{t('career.loading')}</p>}
        {gauntlet.isError && <p className={styles.error} role="alert">{t('career.failed')}</p>}
        {data && (
          <div className={styles.split}>
            <div className={styles.mainCol}>
              {run?.offer ? <Offer offer={run.offer} /> : run ? <Ladder run={run} rewards={data.rewards ?? []} /> : <Entry data={data} coins={profile.coins ?? 0} />}
            </div>
            <aside className={styles.sideCol}>
              <Rewards rewards={data.rewards ?? []} wins={run?.wins ?? -1} />
              {run && <RunDeck run={run} />}
              <Recent runs={data.recent ?? []} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Entry({ data, coins }: { data: CareerGauntletState; coins: number }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const price = data.entryCoins ?? 0;
  const short = coins < price;

  async function start() {
    setBusy(true);
    try {
      await startGauntlet();
    } catch (reason) {
      notify(t('career.gauntlet.startFailed'), message(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="gauntlet-entry">
      <h2 id="gauntlet-entry" className={styles.panelTitle}>{t('career.gauntlet.newRun')}</h2>
      <ol className={styles.steps}>
        <li>{t('career.gauntlet.step1')}</li>
        <li>{t('career.gauntlet.step2')}</li>
        <li>{t('career.gauntlet.step3', { max: data.maxWins ?? 8 })}</li>
      </ol>
      <div className={styles.actions}>
        <Button variant="decision" size="lg" icon={<Coins size={18} />} busy={busy} disabled={short} aria-describedby={short ? 'gauntlet-short' : undefined} onClick={() => void start()}>
          {t('career.gauntlet.start', { price })}
        </Button>
        {short && <span id="gauntlet-short" className={styles.warn}>{t('career.shop.short')}</span>}
      </div>
    </section>
  );
}

/** The waiting pick: starting packs (pick two of three) or a bundle after a win (pick one). */
function Offer({ offer }: { offer: CareerOffer }) {
  const t = useT();
  const pick = offer.pick ?? 1;
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const ready = chosen.length === pick;

  async function confirm() {
    setBusy(true);
    try {
      await pickGauntlet(chosen);
    } catch (reason) {
      notify(t('career.gauntlet.pickFailed'), message(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="gauntlet-offer">
      <h2 id="gauntlet-offer" className={styles.panelTitle}>
        {t(offer.kind === 'start' ? 'career.gauntlet.pickStart' : 'career.gauntlet.pickBundle', { count: pick, of: offer.options?.length ?? 0 })}
      </h2>
      <p className={styles.small}>{t('career.gauntlet.chosen', { count: chosen.length, pick })}</p>
      <ul className={styles.offers}>
        {(offer.options ?? []).map((option) => (
          <li key={option.id}>
            <OfferOption option={option} chosen={chosen.includes(option.id ?? '')} onToggle={() => setChosen((current) => toggleChoice(current, option.id ?? '', pick))} />
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="decision" busy={busy} disabled={!ready} onClick={() => void confirm()}>
          {t(pick === 1 ? 'career.gauntlet.takeOne' : 'career.gauntlet.take', { count: pick })}
        </Button>
      </div>
    </section>
  );
}

function OfferOption({ option, chosen, onToggle }: { option: CareerOfferOption; chosen: boolean; onToggle(): void }) {
  const t = useT();
  const cards = option.cards ?? [];
  const count = cards.reduce((sum, card) => sum + (card.amount ?? 1), 0);
  return (
    <div className={[styles.offer, chosen ? styles.offerOn : ''].join(' ')}>
      <button type="button" className={styles.offerHead} aria-pressed={chosen} onClick={onToggle}>
        <Crest name={option.name ?? ''} colors={option.color} size={44} />
        <span className={styles.offerName}>
          <b>{option.name}</b>
          <small>{t('career.starter.cards', { count })}</small>
        </span>
        <span className={styles.offerCheck} aria-hidden="true">{chosen ? <Check size={18} /> : null}</span>
      </button>
      <ul className={styles.names} aria-label={t('career.gauntlet.contents', { name: option.name ?? '' })}>
        {mergeByName(cards).map((card) => (
          <li key={card.name}>{card.amount > 1 ? `${card.amount} × ${card.name}` : card.name}</li>
        ))}
      </ul>
    </div>
  );
}

/** The eight bosses, the next one to play, and the way out. */
function Ladder({ run, rewards }: { run: CareerRun; rewards: CareerRunReward[] }) {
  const t = useT();
  const playing = usePlay((play) => play.phase !== 'idle');
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wins = run.wins ?? 0;
  const now = rewardLines(runReward(rewards, wins));
  const next = run.next;

  async function play() {
    setStarting(true);
    setError(null);
    try {
      await playMode('gauntlet', () => api.careerGauntletPlay());
    } catch (reason) {
      setError(message(reason));
      setStarting(false);
    }
  }

  async function abandon() {
    try {
      await abandonGauntlet();
      notify(t('career.gauntlet.abandoned'), '');
    } catch (reason) {
      notify(t('career.gauntlet.abandonFailed'), message(reason), 'error');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="gauntlet-run">
      <header className={styles.panelHead}>
        <h2 id="gauntlet-run" className={styles.panelTitle}>{t('career.gauntlet.run', { wins, max: run.maxWins ?? 8 })}</h2>
        {now.length > 0 && <p className={styles.small}>{t('career.gauntlet.paysNow', { reward: now.map((line) => t(line.key, line.vars)).join(', ') })}</p>}
      </header>
      {error && <p className={styles.error} role="alert">{t('career.playFailed')}: {error}</p>}
      <ol className={styles.ladder} aria-label={t('career.gauntlet.ladder')}>
        {(run.bosses ?? []).map((boss) => {
          const isNext = next?.number === boss.number;
          const twists = twistLines(boss.twists);
          return (
            <li key={boss.number} className={[styles.rung, boss.beaten ? styles.rungBeaten : '', isNext ? styles.rungNext : ''].join(' ')} aria-current={isNext ? 'step' : undefined}>
              <span className={styles.rungNumber} aria-hidden="true">{boss.number}</span>
              <Portrait name={boss.name ?? ''} boss={(boss.number ?? 0) >= (run.bosses?.length ?? 8)} size={44} />
              <span className={styles.rungText}>
                <b>{boss.name}</b>
                <small>
                  {t('career.node.skill', { skill: boss.skill ?? 1 })}
                  {twists.length > 0 && ` · ${twists.map((line) => t(line.key, line.vars)).join(', ')}`}
                </small>
              </span>
              <span className={styles.rungState}>
                {boss.beaten ? <><Check size={14} aria-hidden="true" /> {t('career.gauntlet.beaten')}</> : isNext ? t('career.gauntlet.next') : t('career.gauntlet.ahead')}
              </span>
            </li>
          );
        })}
      </ol>
      <div className={styles.actions}>
        {next && (
          <Button variant="decision" size="lg" icon={next.number === run.bosses?.length ? <Crown size={18} /> : <Swords size={18} />} busy={starting} disabled={playing} onClick={() => void play()}>
            {starting ? t('career.playing') : t('career.gauntlet.play', { name: next.name ?? '' })}
          </Button>
        )}
        {confirming ? (
          <span className={styles.confirm} role="group" aria-label={t('career.gauntlet.abandon')}>
            <span className={styles.warn}>{t('career.gauntlet.abandonSure')}</span>
            <Button variant="danger" size="sm" onClick={() => void abandon()}>{t('career.gauntlet.abandonYes')}</Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>{t('career.keep')}</Button>
          </span>
        ) : (
          <Button variant="quiet" size="sm" icon={<Flag size={16} />} onClick={() => setConfirming(true)}>{t('career.gauntlet.abandon')}</Button>
        )}
      </div>
    </section>
  );
}

function Rewards({ rewards, wins }: { rewards: CareerRunReward[]; wins: number }) {
  const t = useT();
  return (
    <section className={styles.card} aria-labelledby="gauntlet-rewards">
      <h2 id="gauntlet-rewards" className={styles.cardLabel}>{t('career.gauntlet.rewards')}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('career.gauntlet.wins')}</th>
            <th scope="col">{t('career.gauntlet.pays')}</th>
          </tr>
        </thead>
        <tbody>
          {rewards.map((reward) => (
            <tr key={reward.wins} className={reward.wins === wins ? styles.rowOn : undefined} aria-current={reward.wins === wins ? 'true' : undefined}>
              <th scope="row">{reward.wins}</th>
              <td>{rewardLines(reward).map((line) => t(line.key, line.vars)).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RunDeck({ run }: { run: CareerRun }) {
  const t = useT();
  const cards = useMemo(() => mergeByName(run.deck).sort((a, b) => a.name.localeCompare(b.name)), [run.deck]);
  if (cards.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="gauntlet-deck">
      <h2 id="gauntlet-deck" className={styles.cardLabel}>{t('career.gauntlet.deck', { count: run.deckSize ?? 0 })}</h2>
      <ul className={[styles.names, styles.namesScroll].join(' ')}>
        {cards.map((card) => <li key={card.name}>{card.amount > 1 ? `${card.amount} × ${card.name}` : card.name}</li>)}
      </ul>
    </section>
  );
}

const RUN_END: Record<string, 'career.run.won' | 'career.run.lost' | 'career.run.abandoned'> = {
  won: 'career.run.won',
  lost: 'career.run.lost',
  abandoned: 'career.run.abandoned',
};

function Recent({ runs }: { runs: CareerRun[] }) {
  const t = useT();
  if (runs.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="gauntlet-recent">
      <h2 id="gauntlet-recent" className={styles.cardLabel}>{t('career.gauntlet.recent')}</h2>
      <ul className={styles.recentRuns}>
        {runs.slice(0, 6).map((run) => (
          <li key={run.id}>
            <span>{t(RUN_END[run.state ?? ''] ?? 'career.run.lost')} · {t('career.run.record', { wins: run.wins ?? 0, losses: run.losses ?? 0 })}</span>
            <small>{run.ended ? formatDate(run.ended, { dateStyle: 'medium' }) : ''}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
