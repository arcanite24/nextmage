import { useQuery } from '@tanstack/react-query';
import { Gift, HelpCircle, Lock, Package, Trophy, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { CareerAchievement, CareerCosmetic, CareerGameResult, CareerLevelTrack } from '../../protocol/generated/views';
import { api } from '../connection';
import { formatNumber, registerMessages, useT, type MessageKey } from '../i18n';
import messages from '../i18n/en/career';
import { useSession } from '../stores/session';
import { useSettings } from '../stores/settings';
import { Button } from '../ui/Button';
import { refreshCareer, useCareerAchievements, useCareerLevels, useCareerLook, useCareerOpponents, useCareerState } from './careerData';
import { CareerAvatar, DoneMark, ProgressBar, WeeklyGoal } from './CareerScreen';
import {
  CAREER_AVATARS, achievementState, cosmeticName, describePay, describeReward, fetchResult, fraction, hasUnlock, levelRows,
  prefersReducedMotion, resultIsEmpty, rewardParts, safeBack, sortAchievements, titleLabel, unlockedIds, xpSweep,
} from './progressModel';
import styles from './Career.module.css';

registerMessages(messages);

const TABS: { id: 'levels' | 'achievements' | 'look'; label: MessageKey }[] = [
  { id: 'levels', label: 'career.progress.levels' },
  { id: 'achievements', label: 'career.progress.achievements' },
  { id: 'look', label: 'career.progress.look' },
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

// ---- the rewards screen after a game

/**
 * After a Career match (or a regular game against the AI that counts): everything the game paid, on one screen.
 * Nothing shows during the match; the server applies the result as the game ends, and this screen asks for it.
 */
export function CareerRewardsScreen() {
  const t = useT();
  const [params] = useSearchParams();
  const key = params.get('game');
  const career = params.get('career') === '1';
  const back = safeBack(params.get('back'));
  const state = useCareerState();
  const profile = state.data?.profile;
  const counts = career || !!profile?.countAiGames;
  const result = useQuery({
    queryKey: ['careerResult', key ?? 'latest'],
    queryFn: () => fetchResult(() => api.careerGameResult(key)),
    enabled: !!profile && counts,
    staleTime: Infinity,
    retry: false,
  });
  const ready = result.isSuccess && !!result.data;
  useEffect(() => {
    // the payout, quests, level and weekly goal have all moved
    if (ready) refreshCareer();
  }, [ready]);

  // nothing for this screen: straight on
  const skip = state.isError || (state.isSuccess && (!profile || !counts)) || (result.isSuccess && !career && (!result.data || resultIsEmpty(result.data)));
  if (skip) return <Navigate to={back} replace />;

  return (
    <div className={styles.rewardsPage}>
      {ready ? <Rewards result={result.data!} back={back} /> : (
        <div className={styles.center}>
          <p>{result.isSuccess ? t('career.rewards.none') : t('career.rewards.waiting')}</p>
          {result.isSuccess && <ContinueButton back={back} />}
        </div>
      )}
    </div>
  );
}

function ContinueButton({ back }: { back: string }) {
  const t = useT();
  const navigate = useNavigate();
  return <Button variant="decision" size="lg" onClick={() => navigate(back, { replace: true })}>{t('career.rewards.continue')}</Button>;
}

function Rewards({ result, back }: { result: CareerGameResult; back: string }) {
  const t = useT();
  const navigate = useNavigate();
  const opponents = useCareerOpponents(!!result.career);
  const opponent = opponents.data?.find((candidate) => candidate.id === result.opponent)?.name ?? result.opponent ?? '';
  const headline = result.career
    ? t(result.won ? 'career.rewards.won' : 'career.rewards.lost', { opponent })
    : t(result.won ? 'career.rewards.wonAi' : 'career.rewards.lostAi');
  const quests = result.quests ?? [];
  const achievements = result.achievements ?? [];
  const levelRewards = result.levelRewards ?? [];
  const opened = result.opened ?? [];

  return (
    <section className={styles.rewards} aria-labelledby="career-rewards-title">
      <header className={styles.rewardsHead}>
        <p className={styles.kicker}>{t('career.rewards.title')}</p>
        <h1 id="career-rewards-title" className={result.won ? styles.rewardsWon : undefined}>{headline}</h1>
        {result.note ? <p className={styles.small}>{result.note}</p> : !result.career && <p className={styles.small}>{t('career.rewards.aiNote')}</p>}
      </header>

      <div className={styles.payRow}>
        <span className={styles.payChip}>+{t('career.coins', { count: result.coins ?? 0 })}</span>
        <span className={styles.payChip}>+{t('career.reward.xp', { xp: result.xp ?? 0 })}</span>
      </div>

      <XpSweep result={result} />

      {levelRewards.length > 0 && (
        <section className={styles.rewardsBlock}>
          <h2 className={styles.cardLabel}>{t('career.rewards.levels')}</h2>
          <ul className={styles.rewardList}>
            {levelRewards.map((reward) => (
              <li key={reward.level}><Gift size={16} aria-hidden="true" /> {t('career.rewards.levelReward', { level: reward.level ?? 0, reward: describeReward(t, rewardParts(reward)) })}</li>
            ))}
          </ul>
        </section>
      )}

      {quests.length > 0 && (
        <section className={styles.rewardsBlock}>
          <h2 className={styles.cardLabel}>{t('career.rewards.quests')}</h2>
          <ul className={styles.quests}>
            {quests.map((quest) => (
              <li key={quest.id} className={[styles.quest, quest.completed ? styles.questDone : ''].join(' ')}>
                <span>
                  <b>{quest.text}</b>
                  <small>{quest.completed ? describePay(t, quest.coins, quest.xp) : null}</small>
                </span>
                {quest.completed ? <DoneMark label={t('career.rewards.questDone')} /> : <span />}
                <ProgressBar value={fraction(quest.after, quest.target)} label={quest.text ?? ''} done={quest.completed} />
                <small>{quest.before} → {quest.after} / {quest.target}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {achievements.length > 0 && (
        <section className={styles.rewardsBlock}>
          <h2 className={styles.cardLabel}>{t('career.rewards.achievements')}</h2>
          <ul className={styles.achievements}>
            {achievements.map((achievement) => (
              <li key={achievement.id} className={[styles.achievement, styles.achievementEarned].join(' ')}>
                <span aria-hidden="true"><Trophy size={18} /></span>
                <span>
                  <b>{achievement.name}</b>
                  <small>{achievement.text}</small>
                </span>
                <span>
                  <small>{[describePay(t, achievement.coins, achievement.xp), achievement.cosmetic ? describeReward(t, [{ kind: 'cosmetic', cosmetic: achievement.cosmetic }]) : ''].filter(Boolean).join(' · ')}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {opened.length > 0 && (
        <ul className={styles.rewardList}>
          {opened.map((name) => <li key={name}><Unlock size={16} aria-hidden="true" /> {t('career.rewards.opened', { name })}</li>)}
        </ul>
      )}

      {result.weekly && (
        <section className={styles.rewardsBlock}>
          <h2 className={styles.cardLabel}>{t('career.weekly')}</h2>
          <WeeklyGoal weekly={result.weekly} />
        </section>
      )}

      {(result.packs ?? 0) > 0 && (
        <p className={styles.packNote}>
          <Package size={18} aria-hidden="true" /> {t('career.rewards.packs', { count: result.packs ?? 0 })}
        </p>
      )}

      <footer className={styles.rewardsFoot}>
        {(result.packs ?? 0) > 0 && <Button variant="print" icon={<Package size={16} />} onClick={() => navigate('/career/shop', { replace: true })}>{t('career.nav.shop')}</Button>}
        <ContinueButton back={back} />
      </footer>
    </section>
  );
}

/** The XP bar, filling from where it stood before the game to where it stands now, one level at a time. */
function XpSweep({ result }: { result: CareerGameResult }) {
  const t = useT();
  const animations = useSettings((settings) => settings.settings.animations);
  const [still] = useState(() => !animations || prefersReducedMotion());
  const segments = useMemo(() => xpSweep(result), [result]);
  const [index, setIndex] = useState(still ? segments.length - 1 : 0);
  const [filled, setFilled] = useState(still);
  const segment = segments[Math.min(index, segments.length - 1)];
  const duration = Math.max(350, Math.round(1100 * (segment.to - segment.from)));

  useEffect(() => {
    if (still) return;
    if (!filled) {
      // a beat before the first stretch; level-ups follow on at once
      const start = setTimeout(() => setFilled(true), index === 0 ? 500 : 60);
      return () => clearTimeout(start);
    }
    if (index >= segments.length - 1) return;
    const next = setTimeout(() => {
      setIndex(index + 1);
      setFilled(false);
    }, duration + 200);
    return () => clearTimeout(next);
  }, [still, filled, index, segments.length, duration]);

  const width = filled ? segment.to : segment.from;
  const levelledUp = segment.level > (segments[0]?.level ?? segment.level);
  return (
    <div className={styles.sweep}>
      <p className={styles.sweepHead}>
        <b>{t('career.level', { level: segment.level })}</b>
        {levelledUp && <span key={segment.level} className={styles.levelUp}>{t('career.rewards.levelUp', { level: segment.level })}</span>}
        <small>{result.xpForNext ? t('career.xp', { into: result.xpIntoLevel ?? 0, needed: result.xpForNext }) : t('career.xpMax')}</small>
      </p>
      <div className={styles.xpBar} role="progressbar" aria-valuemin={0} aria-valuemax={result.xpForNext || 1} aria-valuenow={result.xpIntoLevel ?? 0} aria-label={t('career.level', { level: result.levelAfter ?? 1 })}>
        <span className={filled && !still ? styles.sweepFill : undefined} style={{ width: `${width * 100}%`, transitionDuration: `${duration}ms` }} />
      </div>
    </div>
  );
}
