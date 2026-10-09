import { Download, HelpCircle, Lock, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { CareerAchievement, CareerCosmetic, CareerLevelTrack, CareerPayout, CareerProfile } from '../../protocol/generated/views';
import { formatNumber, registerMessages, useT, type MessageKey } from '../i18n';
import messages from '../i18n/en/career';
import { useSession } from '../stores/session';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { downloadText } from '../ui/download';
import { exportCareer, useCareerAchievements, useCareerLevels, useCareerLook, useCareerOpponents, useCareerState } from './careerData';
import { exportFileName } from './careerModel';
import { CareerAvatar, CountAiGames, DoneMark, ProgressBar } from './CareerScreen';
import {
  CAREER_AVATARS, achievementState, cosmeticName, describePay, describeReward, fraction, hasUnlock, levelRows, rewardParts, sortAchievements,
  titleLabel, unlockedIds,
} from './progressModel';
import styles from './Career.module.css';

registerMessages(messages);

const TABS: { id: 'levels' | 'achievements' | 'look' | 'options'; label: MessageKey }[] = [
  { id: 'levels', label: 'career.progress.levels' },
  { id: 'achievements', label: 'career.progress.achievements' },
  { id: 'look', label: 'career.progress.look' },
  { id: 'options', label: 'career.progress.options' },
];

/** Career progress: the level track, achievements, and the cosmetics they unlock. */
export function CareerProgressScreen() {
  const t = useT();
  const state = useCareerState();
  const profile = state.data?.profile;
  const levels = useCareerLevels(!!profile);
  const achievements = useCareerAchievements(!!profile);
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((candidate) => candidate.id === params.get('tab'))?.id ?? 'levels';

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="group" aria-label={t('career.nav.progress')}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.tab}
            aria-pressed={tab === item.id}
            onClick={() => setParams({ tab: item.id }, { replace: true })}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className={styles.progressBody}>
        {tab === 'levels' && (levels.data ? <LevelTrack track={levels.data} /> : <p className={styles.note}>{t('career.loading')}</p>)}
        {tab === 'achievements' && (achievements.data ? <Achievements list={achievements.data} /> : <p className={styles.note}>{t('career.loading')}</p>)}
        {tab === 'look' && (levels.data ? <Look track={levels.data} achievements={achievements.data ?? []} /> : <p className={styles.note}>{t('career.loading')}</p>)}
        {tab === 'options' && <Options profile={profile} recent={state.data?.recent ?? []} />}
      </div>
    </div>
  );
}

function LevelTrack({ track }: { track: CareerLevelTrack }) {
  const t = useT();
  const level = track.level ?? 1;
  const rows = useMemo(() => levelRows(track.rewards), [track.rewards]);
  const current = useRef<HTMLLIElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'center' });
  }, []);
  const max = !track.xpForNext;

  return (
    <section className={styles.track} aria-label={t('career.progress.levels')}>
      <header className={styles.trackHead}>
        <h2 className={styles.cardLabel}>{t('career.level', { level })}</h2>
        <ProgressBar value={max ? 1 : fraction(track.xpIntoLevel, track.xpForNext)} label={t('career.level', { level })} />
        <p className={styles.small}>
          {max ? t('career.xpMax') : t('career.xp', { into: track.xpIntoLevel ?? 0, needed: track.xpForNext ?? 0 })}
        </p>
      </header>
      <ol className={styles.levels}>
        {rows.map((row) => {
          const reached = row.level <= level;
          const next = row.level === level + 1;
          return (
            <li
              key={row.level}
              ref={row.level === level ? current : undefined}
              className={[styles.levelRow, reached ? styles.levelReached : '', next ? styles.levelNext : '', row.level === level ? styles.levelCurrent : ''].join(' ')}
            >
              <b>{row.level}</b>
              <span>{describeReward(t, rewardParts(row.reward)) || '—'}</span>
              <span>
                {row.level === level ? t('career.levels.current') : reached ? <DoneMark label={t('career.levels.reached')} /> : next ? <ProgressBar value={fraction(track.xpIntoLevel, track.xpForNext)} label={t('career.level', { level: row.level })} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Achievements({ list }: { list: CareerAchievement[] }) {
  const t = useT();
  const sorted = useMemo(() => sortAchievements(list), [list]);
  const earned = list.filter((achievement) => achievement.achieved).length;
  const dates = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);
  return (
    <section className={styles.track} aria-label={t('career.progress.achievements')}>
      <p className={styles.lead}>{t('career.achievements.count', { earned, total: list.length })}</p>
      <ul className={styles.achievements}>
        {sorted.map((achievement) => {
          const kind = achievementState(achievement);
          const pay = [describePay(t, achievement.coins, achievement.xp), achievement.cosmetic ? describeReward(t, [{ kind: 'cosmetic', cosmetic: achievement.cosmetic }]) : '']
            .filter(Boolean).join(' · ');
          return (
            <li key={achievement.id} className={[styles.achievement, kind === 'earned' ? styles.achievementEarned : ''].join(' ')}>
              <span aria-hidden="true">
                {kind === 'earned' ? <Trophy size={18} /> : kind === 'secret' ? <HelpCircle size={18} /> : <Lock size={16} />}
              </span>
              <span>
                <b>{kind === 'secret' ? t('career.achievements.secret') : achievement.name}</b>
                <small>{kind === 'secret' ? t('career.achievements.secretText') : achievement.text}</small>
                {kind === 'progress' && (
                  <span className={styles.achievementProgress}>
                    <ProgressBar value={fraction(achievement.progress, achievement.target)} label={achievement.name ?? ''} />
                    <small>{formatNumber(achievement.progress ?? 0)} / {formatNumber(achievement.target ?? 0)}</small>
                  </span>
                )}
              </span>
              <span>
                {kind === 'earned' && achievement.at ? <small>{t('career.achievements.earned', { date: dates.format(new Date(achievement.at)) })}</small> : null}
                {kind !== 'secret' && pay && <small>{pay}</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Where a cosmetic comes from: a level, or an achievement (secret ones stay secret). */
function sourceOf(t: ReturnType<typeof useT>, track: CareerLevelTrack, achievements: readonly CareerAchievement[], cosmetic: CareerCosmetic): string {
  const level = track.rewards?.find((reward) => reward.cosmetic?.kind === cosmetic.kind && reward.cosmetic?.id === cosmetic.id)?.level;
  if (level) return t('career.look.atLevel', { level });
  const achievement = achievements.find((item) => item.cosmetic?.kind === cosmetic.kind && item.cosmetic?.id === cosmetic.id);
  return achievement ? t('career.look.fromAchievement', { name: achievement.name ?? t('career.achievements.secret') }) : '';
}

function Look({ track, achievements }: { track: CareerLevelTrack; achievements: CareerAchievement[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const unlocks = useMemo(() => track.unlocks ?? [], [track.unlocks]);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const title = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);
  const choose = useCareerLook((look) => look.choose);
  const titles = useMemo(() => {
    // every title the content offers, unlocked ones first
    const all = new Set([...unlockedIds(unlocks, 'title'), ...achievements.flatMap((item) => (item.cosmetic?.kind === 'title' && item.cosmetic.id ? [item.cosmetic.id] : []))]);
    return [...all];
  }, [unlocks, achievements]);

  return (
    <div className={styles.look}>
      <section className={styles.card}>
        <h2 className={styles.cardLabel}>{t('career.look.avatar')}</h2>
        <div className={styles.lookGrid} role="radiogroup" aria-label={t('career.look.avatar')}>
          <button type="button" role="radio" aria-checked={!avatar} className={styles.lookOption} onClick={() => choose(user, { avatar: null })}>
            <CareerAvatar id={null} name={user} size={40} />
            <small>{t('career.look.none')}</small>
          </button>
          {Object.keys(CAREER_AVATARS).map((id) => {
            const cosmetic = { kind: 'avatar', id };
            const open = hasUnlock(unlocks, 'avatar', id);
            const name = cosmeticName(t, cosmetic);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={avatar === id}
                disabled={!open}
                className={styles.lookOption}
                title={open ? name : sourceOf(t, track, achievements, cosmetic)}
                onClick={() => choose(user, { avatar: id })}
              >
                <CareerAvatar id={id} name={user} size={40} />
                <small>{open ? name : <><Lock size={12} aria-hidden="true" /> {sourceOf(t, track, achievements, cosmetic)}</>}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardLabel}>{t('career.look.title')}</h2>
        <div className={styles.titleList} role="radiogroup" aria-label={t('career.look.title')}>
          <button type="button" role="radio" aria-checked={!title} className={styles.titleOption} onClick={() => choose(user, { title: null })}>
            {t('career.look.none')}
          </button>
          {titles.map((id) => {
            const cosmetic = { kind: 'title', id };
            const open = hasUnlock(unlocks, 'title', id);
            const how = sourceOf(t, track, achievements, cosmetic);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={title === id}
                disabled={!open}
                className={styles.titleOption}
                title={open ? undefined : how}
                onClick={() => choose(user, { title: id })}
              >
                {!open && <Lock size={12} aria-hidden="true" />} {open || !how.includes('???') ? titleLabel(id) : t('career.achievements.secret')}
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}

/** The record and the housekeeping: recent games, whether AI games count, and a copy of the Career to keep. */
function Options({ profile, recent }: { profile: CareerProfile; recent: CareerPayout[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const opponents = useCareerOpponents(true);
  const names = useMemo(() => new Map((opponents.data ?? []).map((opponent) => [opponent.id, opponent.name])), [opponents.data]);

  async function exportNow() {
    try {
      downloadText(exportFileName(user, new Date()), await exportCareer());
      notify(t('career.export.done'), '');
    } catch (reason) {
      notify(t('career.export.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    }
  }

  return (
    <div className={styles.look}>
      <section className={styles.card}>
        <h2 className={styles.cardLabel}>{t('career.recent')}</h2>
        {recent.length === 0 ? <p className={styles.small}>{t('career.recent.none')}</p> : (
          <ul className={styles.recent}>
            {recent.slice(0, 10).map((payout) => {
              const opponent = names.get(payout.opponent) ?? payout.opponent ?? '';
              return (
                <li key={payout.matchKey}>
                  <span className={payout.won ? styles.won : styles.lost}>{t(payout.won ? 'career.recent.won' : 'career.recent.lost', { opponent })}</span>
                  <small>{payout.note || t('career.recent.paid', { coins: payout.coins ?? 0, xp: payout.xp ?? 0 })}</small>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={styles.card}>
        <h2 className={styles.cardLabel}>{t('career.settings')}</h2>
        <CountAiGames profile={profile} />
        <Button variant="print" size="sm" icon={<Download size={16} />} onClick={() => void exportNow()}>{t('career.export')}</Button>
      </section>
    </div>
  );
}
