import { Check, Coins, Download, HelpCircle, Lock, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties, type WheelEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { CareerAchievement, CareerCosmetic, CareerLevelReward, CareerLevelTrack, CareerPayout, CareerProfile } from '../../protocol/generated/views';
import { MAT_CLOTHS, clothSwatch } from '../match/playmats';
import { formatNumber, registerMessages, useT, type MessageKey } from '../i18n';
import messages from '../i18n/en/career';
import { useSession } from '../stores/session';
import { useSettings } from '../stores/settings';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { downloadText } from '../ui/download';
import { BoosterPack } from './BoosterPack';
import { exportCareer, useCareerAchievements, useCareerLevels, useCareerLook, useCareerOpponents, useCareerState } from './careerData';
import { exportFileName } from './careerModel';
import { CareerAvatar, CountAiGames, ProgressBar } from './CareerScreen';
import { LevelMedallion } from './CareerShell';
import { dealStyle } from './motion';
import motion from './motion.module.css';
import { CardArt } from './Portraits';
import {
  CAREER_AVATARS, CAREER_PLAYMATS, CAREER_SLEEVES, achievementState, cosmeticName, describePay, describeReward, fraction, hasUnlock, levelRows,
  rewardParts, sortAchievements, titleLabel, unlockedIds, type RewardPart,
} from './progressModel';
import styles from './Career.module.css';
import progress from './Progress.module.css';

registerMessages(messages);

const TABS: { id: 'levels' | 'achievements' | 'look' | 'options'; label: MessageKey }[] = [
  { id: 'levels', label: 'career.progress.levels' },
  { id: 'achievements', label: 'career.progress.achievements' },
  { id: 'look', label: 'career.progress.look' },
  { id: 'options', label: 'career.progress.options' },
];

/**
 * Career progress as a game's profile: your level and record up top, then the reward road you're walking, the medal
 * case, the locker of cosmetics, and the record with the housekeeping.
 */
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
  const loading = <p className={styles.note}>{t('career.loading')}</p>;

  return (
    <div className={progress.screen}>
      <Banner profile={profile} track={levels.data ?? undefined} achievements={achievements.data} />
      <div className={progress.tabs} role="group" aria-label={t('career.nav.progress')}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={progress.tab}
            aria-pressed={tab === item.id}
            onClick={() => setParams({ tab: item.id }, { replace: true })}
            data-nav
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className={[progress.body, motion.scene].join(' ')} key={tab}>
        {tab === 'levels' && (levels.data ? <RewardRoad track={levels.data} /> : loading)}
        {tab === 'achievements' && (achievements.data ? <MedalCase list={achievements.data} /> : loading)}
        {tab === 'look' && (levels.data ? <Locker track={levels.data} achievements={achievements.data ?? []} /> : loading)}
        {tab === 'options' && <Record profile={profile} recent={state.data?.recent ?? []} />}
      </div>
    </div>
  );
}

/** Who you are in Career: the medallion, the level and how far into it, the next reward, and the record in brief. */
function Banner({ profile, track, achievements }: { profile: CareerProfile; track?: CareerLevelTrack; achievements?: CareerAchievement[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const titleId = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);
  const level = track?.level ?? profile.level ?? 1;
  const max = !!track && !track.xpForNext;
  const into = track?.xpIntoLevel ?? 0;
  const needed = track?.xpForNext ?? 0;
  const next = useMemo(() => levelRows(track?.rewards).find((row) => row.level > level && rewardParts(row.reward).length > 0), [track?.rewards, level]);
  const earned = (achievements ?? []).filter((achievement) => achievement.achieved).length;
  const games = (profile.wins ?? 0) + (profile.losses ?? 0);
  const xpLabel = max ? t('career.xpMax') : t('career.xp', { into, needed });

  return (
    <header className={progress.banner}>
      <LevelMedallion level={level} fraction={max ? 1 : fraction(into, needed)} label={xpLabel} size={104}>
        <CareerAvatar id={avatar} name={user} size={80} />
      </LevelMedallion>
      <div className={progress.who}>
        <p className={progress.kicker}>{titleId ? titleLabel(titleId) : t('career.progress.kicker')}</p>
        <h2 className={progress.levelName}>{t('career.level', { level })}</h2>
        <div className={progress.xp}>
          <ProgressBar value={max ? 1 : fraction(into, needed)} label={xpLabel} />
          <span>{xpLabel}</span>
        </div>
        {next && <p className={progress.next}>{t('career.progress.nextReward', { level: next.level, reward: describeReward(t, rewardParts(next.reward)) })}</p>}
      </div>
      <dl className={progress.stats}>
        <div><dt>{t('career.progress.wins')}</dt><dd>{formatNumber(profile.wins ?? 0)}</dd></div>
        <div><dt>{t('career.progress.winRate')}</dt><dd>{games > 0 ? `${Math.round(((profile.wins ?? 0) / games) * 100)}%` : '—'}</dd></div>
        <div><dt>{t('career.progress.cards')}</dt><dd>{formatNumber(profile.cards ?? 0)}</dd></div>
        <div><dt>{t('career.progress.medals')}</dt><dd>{achievements ? `${earned}/${achievements.length}` : '—'}</dd></div>
      </dl>
    </header>
  );
}

// ---- the reward road

/** Every level as a stop on a road, its reward standing over it; the road is lit up to where you are. */
function RewardRoad({ track }: { track: CareerLevelTrack }) {
  const t = useT();
  const level = track.level ?? 1;
  const rows = useMemo(() => levelRows(track.rewards), [track.rewards]);
  const road = useRef<HTMLOListElement>(null);
  const into = fraction(track.xpIntoLevel, track.xpForNext);

  // open on where you are, a little left of the middle so what's next shows
  useEffect(() => {
    const here = road.current?.querySelector<HTMLElement>('[data-here]');
    if (road.current && here) road.current.scrollLeft = here.offsetLeft - road.current.clientWidth * 0.35;
  }, []);

  // a mouse wheel scrolls the road sideways
  function onWheel(event: WheelEvent<HTMLOListElement>) {
    if (!road.current || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    road.current.scrollLeft += event.deltaY;
  }

  return (
    <section className={progress.roadWrap} aria-label={t('career.progress.levels')}>
      <ol ref={road} className={progress.road} onWheel={onWheel}>
        {rows.map((row) => {
          const parts = rewardParts(row.reward);
          const reached = row.level <= level;
          const here = row.level === level;
          // the road's light: full behind you, and from your stop part of the way on toward the next one
          const lit = row.level < level ? 1 : here ? 0.5 + into * 0.5 : 0;
          return (
            <li
              key={row.level}
              className={[progress.stop, reached ? progress.reached : '', here ? progress.here : '', parts.length === 0 ? progress.quiet : ''].join(' ')}
              style={{ '--lit': lit } as CSSProperties}
              data-here={here || undefined}
            >
              {parts.length > 0 ? (
                <div className={progress.prize} title={describeReward(t, parts)}>
                  <RewardArt parts={parts} />
                  <span className={progress.prizeName}>{describeReward(t, parts)}</span>
                  {reached && <span className={progress.claimed}><Check size={14} aria-hidden="true" /> {t('career.levels.reached')}</span>}
                </div>
              ) : <div className={progress.prizeNone} aria-hidden="true" />}
              <span className={progress.milestone}>
                <b>{row.level}</b>
              </span>
              {here && <span className={progress.youMarker}>{t('career.levels.current')}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A reward drawn as the thing it is: coins, a pack, a wildcard, an avatar, sleeves, a playmat or a title. */
function RewardArt({ parts }: { parts: RewardPart[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const first = parts.find((part) => part.kind === 'cosmetic') ?? parts[0];
  switch (first.kind) {
    case 'coins':
      return <span className={[progress.art, progress.artCoins].join(' ')}><Coins size={34} aria-hidden="true" /><b>+{formatNumber(first.amount)}</b></span>;
    case 'packs':
      return <span className={progress.art}><BoosterPack setCode="" setName={t('career.progress.freePack')} size="sm" className={progress.artPack} /></span>;
    case 'wildcard':
      return <span className={[progress.art, progress.artWild].join(' ')} data-rarity={first.rarity}><Sparkles size={30} aria-hidden="true" /></span>;
    case 'cosmetic':
      return <span className={progress.art}><CosmeticPreview cosmetic={first.cosmetic} user={user} /></span>;
  }
}

function CosmeticPreview({ cosmetic, user }: { cosmetic: CareerCosmetic; user: string }) {
  const id = cosmetic.id ?? '';
  switch (cosmetic.kind) {
    case 'avatar':
      return <CareerAvatar id={id} name={user} size={64} />;
    case 'sleeve':
      return <span className={progress.sleeve}><CardFace card={{ name: '' }} hidden sleeve={CAREER_SLEEVES[id]} size="normal" /></span>;
    case 'playmat': {
      const cloth = MAT_CLOTHS.find((item) => item.id === id);
      return <span className={progress.cloth} style={cloth ? clothSwatch(cloth) : undefined} />;
    }
    default:
      return <span className={progress.plate}>{titleLabel(id)}</span>;
  }
}

// ---- the medal case

function MedalCase({ list }: { list: CareerAchievement[] }) {
  const t = useT();
  const sorted = useMemo(() => sortAchievements(list), [list]);
  const earned = list.filter((achievement) => achievement.achieved).length;
  const dates = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);
  return (
    <section className={progress.case} aria-label={t('career.progress.achievements')}>
      <header className={progress.caseHead}>
        <p>{t('career.achievements.count', { earned, total: list.length })}</p>
        <ProgressBar value={fraction(earned, list.length)} label={t('career.achievements.count', { earned, total: list.length })} />
      </header>
      <ul className={progress.medals}>
        {sorted.map((achievement, index) => {
          const kind = achievementState(achievement);
          const part = fraction(achievement.progress, achievement.target);
          const pay = [
            describePay(t, achievement.coins, achievement.xp),
            achievement.cosmetic ? describeReward(t, [{ kind: 'cosmetic', cosmetic: achievement.cosmetic }]) : '',
          ].filter(Boolean).join(' · ');
          return (
            <li key={achievement.id} className={[progress.medal, progress[kind], motion.deal].join(' ')} style={dealStyle(index)}>
              <span className={progress.disc} style={{ '--part': kind === 'progress' ? part : kind === 'earned' ? 1 : 0 } as CSSProperties} aria-hidden="true">
                {kind === 'earned' ? <Trophy size={26} /> : kind === 'secret' ? <HelpCircle size={24} /> : kind === 'progress' && part > 0 ? <b>{Math.round(part * 100)}%</b> : <Lock size={20} />}
              </span>
              <span className={progress.medalText}>
                <b>{kind === 'secret' ? t('career.achievements.secret') : achievement.name}</b>
                <small>{kind === 'secret' ? t('career.achievements.secretText') : achievement.text}</small>
                {kind === 'progress' && <small className={progress.count}>{formatNumber(achievement.progress ?? 0)} / {formatNumber(achievement.target ?? 0)}</small>}
                {kind === 'earned' && achievement.at ? <small className={progress.count}>{t('career.achievements.earned', { date: dates.format(new Date(achievement.at)) })}</small> : null}
                {kind !== 'secret' && pay && <span className={progress.pay}>{pay}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---- the locker

/** Where a cosmetic comes from: a level, or an achievement (secret ones stay secret). */
function sourceOf(t: ReturnType<typeof useT>, rewards: readonly CareerLevelReward[] | undefined, achievements: readonly CareerAchievement[], cosmetic: CareerCosmetic): string {
  const level = rewards?.find((reward) => reward.cosmetic?.kind === cosmetic.kind && reward.cosmetic?.id === cosmetic.id)?.level;
  if (level) return t('career.look.atLevel', { level });
  const achievement = achievements.find((item) => item.cosmetic?.kind === cosmetic.kind && item.cosmetic?.id === cosmetic.id);
  return achievement ? t('career.look.fromAchievement', { name: achievement.name ?? t('career.achievements.secret') }) : '';
}

function Locker({ track, achievements }: { track: CareerLevelTrack; achievements: CareerAchievement[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const unlocks = useMemo(() => track.unlocks ?? [], [track.unlocks]);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const title = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);
  const choose = useCareerLook((look) => look.choose);
  const cloth = useSettings((settings) => settings.settings.matCloth);
  const titles = useMemo(() => {
    // every title the content offers, unlocked ones first
    const all = new Set([...unlockedIds(unlocks, 'title'), ...achievements.flatMap((item) => (item.cosmetic?.kind === 'title' && item.cosmetic.id ? [item.cosmetic.id] : []))]);
    return [...all];
  }, [unlocks, achievements]);
  const how = (cosmetic: CareerCosmetic) => sourceOf(t, track.rewards, achievements, cosmetic);

  return (
    <div className={progress.locker}>
      <section className={progress.shelfPanel} aria-labelledby="locker-avatar">
        <h3 id="locker-avatar">{t('career.look.avatar')}</h3>
        <div className={progress.options} role="radiogroup" aria-labelledby="locker-avatar">
          <LockerItem on={!avatar} open label={t('career.look.none')} onPick={() => choose(user, { avatar: null })}>
            <CareerAvatar id={null} name={user} size={64} />
          </LockerItem>
          {Object.keys(CAREER_AVATARS).map((id) => {
            const cosmetic = { kind: 'avatar', id };
            const open = hasUnlock(unlocks, 'avatar', id);
            return (
              <LockerItem key={id} on={avatar === id} open={open} label={open ? cosmeticName(t, cosmetic) : how(cosmetic)} onPick={() => choose(user, { avatar: id })}>
                <CareerAvatar id={id} name={user} size={64} />
              </LockerItem>
            );
          })}
        </div>
      </section>

      <section className={progress.shelfPanel} aria-labelledby="locker-title">
        <h3 id="locker-title">{t('career.look.title')}</h3>
        <p className={progress.namePlate}><b>{user}</b>{title && <small>{titleLabel(title)}</small>}</p>
        <div className={progress.titles} role="radiogroup" aria-labelledby="locker-title">
          <button type="button" role="radio" aria-checked={!title} className={progress.titleOption} onClick={() => choose(user, { title: null })} data-nav>
            {t('career.look.none')}
          </button>
          {titles.map((id) => {
            const cosmetic = { kind: 'title', id };
            const open = hasUnlock(unlocks, 'title', id);
            const from = how(cosmetic);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={title === id}
                disabled={!open}
                className={progress.titleOption}
                title={open ? undefined : from}
                onClick={() => choose(user, { title: id })}
                data-nav
              >
                {!open && <Lock size={12} aria-hidden="true" />} {open || !from.includes('???') ? titleLabel(id) : t('career.achievements.secret')}
              </button>
            );
          })}
        </div>
      </section>

      <section className={progress.shelfPanel} aria-labelledby="locker-sleeves">
        <h3 id="locker-sleeves">{t('career.look.sleeves')}</h3>
        <p className={progress.panelNote}>{t('career.look.sleevesNote')}</p>
        <div className={progress.options}>
          {Object.keys(CAREER_SLEEVES).map((id) => {
            const cosmetic = { kind: 'sleeve', id };
            const open = hasUnlock(unlocks, 'sleeve', id);
            return (
              <span key={id} className={[progress.item, open ? '' : progress.itemLocked].join(' ')} title={open ? undefined : how(cosmetic)}>
                <span className={progress.sleeve}><CardFace card={{ name: '' }} hidden sleeve={CAREER_SLEEVES[id]} size="normal" /></span>
                <small>{open ? cosmeticName(t, cosmetic) : <><Lock size={11} aria-hidden="true" /> {how(cosmetic)}</>}</small>
              </span>
            );
          })}
        </div>
      </section>

      <section className={progress.shelfPanel} aria-labelledby="locker-mats">
        <h3 id="locker-mats">{t('career.look.playmats')}</h3>
        <div className={progress.options} role="radiogroup" aria-labelledby="locker-mats">
          {CAREER_PLAYMATS.map((id) => {
            const cosmetic = { kind: 'playmat', id };
            const open = hasUnlock(unlocks, 'playmat', id);
            const swatch = MAT_CLOTHS.find((item) => item.id === id);
            return (
              <LockerItem key={id} on={cloth === id} open={open} label={open ? cosmeticName(t, cosmetic) : how(cosmetic)} onPick={() => useSettings.getState().update({ matCloth: id })}>
                <span className={progress.cloth} style={swatch ? clothSwatch(swatch) : undefined} />
              </LockerItem>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LockerItem({ on, open, label, onPick, children }: { on: boolean; open: boolean; label: string; onPick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={!open}
      className={[progress.item, open ? '' : progress.itemLocked].join(' ')}
      onClick={onPick}
      data-nav
    >
      {children}
      <small>{!open && <Lock size={11} aria-hidden="true" />} {label}</small>
    </button>
  );
}

// ---- the record

/** The record and the housekeeping: recent games, whether AI games count, and a copy of the Career to keep. */
function Record({ profile, recent }: { profile: CareerProfile; recent: CareerPayout[] }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const opponents = useCareerOpponents(true);
  const byId = useMemo(() => new Map((opponents.data ?? []).map((opponent) => [opponent.id, opponent])), [opponents.data]);
  const games = (profile.wins ?? 0) + (profile.losses ?? 0);

  async function exportNow() {
    try {
      downloadText(exportFileName(user, new Date()), await exportCareer());
      notify(t('career.export.done'), '');
    } catch (reason) {
      notify(t('career.export.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    }
  }

  return (
    <div className={progress.record}>
      <section className={progress.shelfPanel} aria-labelledby="record-recent">
        <h3 id="record-recent">{t('career.recent')}</h3>
        <p className={progress.panelNote}>{t('career.progress.recordLine', { wins: profile.wins ?? 0, losses: profile.losses ?? 0, games })}</p>
        {recent.length === 0 ? <p className={styles.small}>{t('career.recent.none')}</p> : (
          <ul className={progress.games}>
            {recent.slice(0, 10).map((payout, index) => {
              const opponent = byId.get(payout.opponent);
              const name = opponent?.name ?? payout.opponent ?? '';
              return (
                <li key={payout.matchKey} className={[progress.game, payout.won ? progress.gameWon : '', motion.deal].join(' ')} style={dealStyle(index)}>
                  <span className={progress.gameArt}><CardArt card={opponent?.cover} name={name} colors={opponent?.colors} /></span>
                  <span className={progress.gameText}>
                    <b>{t(payout.won ? 'career.recent.won' : 'career.recent.lost', { opponent: name })}</b>
                    <small>{payout.note || t('career.recent.paid', { coins: payout.coins ?? 0, xp: payout.xp ?? 0 })}</small>
                  </span>
                  <span className={progress.verdict}>{t(payout.won ? 'career.results.victory' : 'career.results.defeat')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={progress.shelfPanel} aria-labelledby="record-settings">
        <h3 id="record-settings">{t('career.settings')}</h3>
        <CountAiGames profile={profile} />
        <Button variant="print" size="sm" icon={<Download size={16} />} onClick={() => void exportNow()}>{t('career.export')}</Button>
      </section>
    </div>
  );
}
