import { Check, Download, Gift, ListOrdered, Lock, RefreshCw, Swords, Trophy, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DeckCardLists } from '../../core/decks/types';
import type { CareerOpponent, CareerPayout, CareerProfile, CareerQuest, CareerQuests, CareerStarter, CareerWeekly } from '../../protocol/generated/views';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { usePlay } from '../stores/play';
import { useSession } from '../stores/session';
import { useSettings } from '../stores/settings';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { downloadText } from '../ui/download';
import { CareerBar } from './CareerBar';
import { ensureCareerDeck } from './careerDeck';
import {
  exportCareer, importCareer, playCareer, startCareer, useCareerCollection, useCareerOpponents, useCareerQuests, useCareerStarters, useCareerState,
  rerollQuest, setCountAiGames, useCareerAchievements, useCareerLevels, useCareerLook, useCareerUnlocks, useCareerWeekly,
} from './careerData';
import { CAREER_AVATARS, CAREER_SLEEVES, cosmeticName, describePay, fraction, titleLabel, unlockedIds, weeklyMarks } from './progressModel';
import { DECK_MIN, WINS_TO_UNLOCK, exportFileName, levelProgress, mainDeckSize, ownedByName, shortfalls, tiersOf } from './careerModel';
import styles from './Career.module.css';

registerMessages(messages);

/** Career: the opt-in, the starter pick, then the Career's home with its opponents. */
export function CareerScreen() {
  const t = useT();
  const navigate = useNavigate();
  const state = useCareerState();
  const optedIn = useSettings((settings) => settings.settings.careerOptIn);
  // a Career opened elsewhere counts as opted in on this browser too (its cosmetics show in Decks and Settings)
  const hasProfile = !!state.data?.profile;
  useEffect(() => {
    if (hasProfile && !optedIn) useSettings.getState().update({ careerOptIn: true });
  }, [hasProfile, optedIn]);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (state.isError) {
    return (
      <div className={styles.center}>
        <p>{t('career.failed')}</p>
        <Button onClick={() => void state.refetch()}>{t('career.retry')}</Button>
      </div>
    );
  }
  if (!state.data.enabled) {
    return (
      <div className={styles.center}>
        <p>{t('career.off')}</p>
        <Button onClick={() => navigate('/')}>{t('career.backToPlay')}</Button>
      </div>
    );
  }
  const profile = state.data.profile;
  if (profile) return <CareerHome profile={profile} recent={state.data.recent ?? []} />;
  if (!optedIn) return <Intro />;
  return <StarterPicker />;
}

function Intro() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className={styles.intro}>
      <h1 className={styles.introTitle}>{t('career.intro.title')}</h1>
      <p className={styles.introLead}>{t('career.intro.lead')}</p>
      <ul className={styles.introList}>
        <li>{t('career.intro.own')}</li>
        <li>{t('career.intro.earn')}</li>
        <li>{t('career.intro.money')}</li>
        <li>{t('career.intro.keep')}</li>
      </ul>
      <div className={styles.introActions}>
        <Button variant="quiet" onClick={() => navigate('/')}>{t('career.intro.notNow')}</Button>
        <Button variant="decision" size="lg" onClick={() => useSettings.getState().update({ careerOptIn: true })}>{t('career.intro.start')}</Button>
      </div>
    </div>
  );
}

function StarterPicker() {
  const t = useT();
  const starters = useCareerStarters(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(starter: CareerStarter) {
    setBusy(starter.id ?? null);
    setError(null);
    try {
      await startCareer(starter.id!, starter.name ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{t('career.starter.title')}</h1>
          <p className={styles.lead}>{t('career.starter.lead', { coins: 100 })}</p>
        </div>
        <ImportButton />
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {starters.isPending && <p className={styles.note}>{t('career.loading')}</p>}
      {starters.data?.length === 0 && <p className={styles.note}>{t('career.starter.none')}</p>}
      <ul className={styles.starters}>
        {starters.data?.map((starter) => (
          <li key={starter.id}>
            <button type="button" className={styles.starter} onClick={() => void pick(starter)} disabled={busy !== null} aria-busy={busy === starter.id || undefined}>
              <span className={styles.starterArt}>
                <CardFace card={{ name: starter.cover?.name ?? starter.name, setCode: starter.cover?.setCode, cardNumber: starter.cover?.cardNumber }} size="normal" />
              </span>
              <b>{starter.name}</b>
              <small>{busy === starter.id ? t('career.loading') : t('career.starter.cards', { count: starter.cards ?? 60 })}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bring back an exported Career (only while the account has none). */
function ImportButton() {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function chosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await importCareer(await file.text());
      notify(t('career.import.done'), file.name);
    } catch (reason) {
      notify(t('career.import.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={styles.importBox} title={t('career.import.hint')}>
      <Button variant="print" size="sm" icon={<Upload size={16} />} busy={busy} onClick={() => input.current?.click()}>{t('career.import')}</Button>
      <input ref={input} type="file" accept=".txt,text/plain" hidden onChange={(event) => void chosen(event)} />
    </span>
  );
}

function CareerHome({ profile, recent }: { profile: CareerProfile; recent: CareerPayout[] }) {
  const t = useT();
  const navigate = useNavigate();
  const user = useSession((state) => state.userName);
  const opponents = useCareerOpponents(true);
  const collection = useCareerCollection(true);
  const tiers = useMemo(() => tiersOf(opponents.data ?? []), [opponents.data]);
  const owned = useMemo(() => ownedByName(collection.data ?? []), [collection.data]);
  const [deck, setDeck] = useState<DeckCardLists | null>(null);
  const starter = profile.starter;
  useEffect(() => {
    let cancelled = false;
    void ensureCareerDeck(user, starter).then((loaded) => !cancelled && setDeck(loaded));
    return () => {
      cancelled = true;
    };
  }, [user, starter]);
  const size = deck ? mainDeckSize(deck) : 0;
  const missing = useMemo(() => (deck && collection.data ? shortfalls(deck, owned) : []), [deck, owned, collection.data]);
  const deckProblem = size < DECK_MIN ? t('career.deck.notReady', { min: DECK_MIN, count: size }) : missing.length > 0 ? t('career.deck.missing', { count: missing.length }) : null;
  const level = levelProgress(profile.xp ?? 0, profile.level ?? 1);
  const playing = usePlay((play) => play.phase !== 'idle');
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => new Map((opponents.data ?? []).map((opponent) => [opponent.id, opponent.name])), [opponents.data]);
  const quests = useCareerQuests(true);
  const weekly = useCareerWeekly(true);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const title = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);

  async function play(opponent: CareerOpponent) {
    if (!deck || deckProblem) return;
    setStarting(opponent.id ?? null);
    setError(null);
    try {
      await playCareer(opponent.id!, deck);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStarting(null);
    }
  }

  async function exportNow() {
    try {
      downloadText(exportFileName(user, new Date()), await exportCareer());
      notify(t('career.export.done'), '');
    } catch (reason) {
      notify(t('career.export.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    }
  }

  return (
    <div className={styles.page}>
      <CareerBar profile={profile} />
      <div className={styles.homeGrid}>
        <section className={styles.tiers} aria-label={t('career.nav.home')}>
          {error && <p className={styles.error} role="alert">{t('career.playFailed')}: {error}</p>}
          {opponents.isPending && <p className={styles.note}>{t('career.loading')}</p>}
          {tiers.map((tier, index) => (
            <section key={tier.tier} className={[styles.tier, tier.unlocked ? '' : styles.tierLocked].join(' ')}>
              <header className={styles.tierHead}>
                <h2>{t('career.tier', { tier: tier.tier, name: tier.name })}</h2>
                <small>
                  {!tier.unlocked
                    ? t('career.tier.locked', { needed: WINS_TO_UNLOCK })
                    : index < tiers.length - 1
                      ? (tier.wins >= WINS_TO_UNLOCK ? t('career.tier.done') : t('career.tier.progress', { wins: tier.wins, needed: WINS_TO_UNLOCK }))
                      : null}
                </small>
              </header>
              <ul className={styles.opponents}>
                {tier.opponents.map((opponent) => (
                  <li key={opponent.id} className={styles.opponent}>
                    <span className={styles.colors} aria-hidden="true">
                      {(opponent.colors ?? '').split('').map((letter, i) => <i key={i} className={`ms ms-cost ms-${letter.toLowerCase()}`} />)}
                    </span>
                    <span className={styles.opponentText}>
                      <b>{opponent.name}</b>
                      <small>{opponent.tagline}</small>
                    </span>
                    <span className={styles.opponentMeta}>
                      <span>{t('career.opponent.wins', { count: opponent.wins ?? 0 })}</span>
                      <small>{t('career.opponent.pays', { coins: opponent.winCoins ?? 0 })}</small>
                    </span>
                    {opponent.unlocked ? (
                      <Button
                        variant="print"
                        icon={<Swords size={16} />}
                        busy={starting === opponent.id}
                        disabled={playing || !!deckProblem || !deck}
                        onClick={() => void play(opponent)}
                      >
                        {starting === opponent.id ? t('career.playing') : t('career.opponent.play')}
                      </Button>
                    ) : (
                      <span className={styles.locked}><Lock size={16} aria-hidden="true" /> {t('career.opponent.locked')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>

        <aside className={styles.side}>
          <section className={styles.card}>
            <div className={styles.identity}>
              <CareerAvatar id={avatar} name={user} />
              <span className={styles.identityText}>
                <b>{user}</b>
                {title && <small>{titleLabel(title)}</small>}
              </span>
            </div>
            <h2 className={styles.cardLabel}>{t('career.level', { level: profile.level ?? 1 })}</h2>
            <div className={styles.xpBar} role="progressbar" aria-valuemin={0} aria-valuemax={level.needed || 1} aria-valuenow={level.into} aria-label={t('career.level', { level: profile.level ?? 1 })}>
              <span style={{ width: `${Math.round(level.fraction * 100)}%` }} />
            </div>
            <p className={styles.small}>{level.max ? t('career.xpMax') : t('career.xp', { into: level.into, needed: level.needed })} · {t('career.record', { wins: profile.wins ?? 0, losses: profile.losses ?? 0 })}</p>
            <Button variant="quiet" size="sm" icon={<ListOrdered size={16} />} onClick={() => navigate('/career/progress')}>{t('career.progress.levels')}</Button>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardLabel}>{t('career.weekly')}</h2>
            <WeeklyGoal weekly={weekly.data} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardLabel}>{t('career.quests')}</h2>
            {quests.isPending ? <p className={styles.small}>{t('career.loading')}</p> : <QuestList quests={quests.data ?? undefined} />}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardLabel}>{deck?.name ?? t('career.nav.deck')}</h2>
            <p className={styles.small}>{t('career.deck.summary', { count: size })}</p>
            {deckProblem && <p className={styles.warn}>{deckProblem}</p>}
            <Button variant={deckProblem ? 'decision' : 'print'} size="sm" onClick={() => navigate('/career/deck')}>{deckProblem ? t('career.deck.fix') : t('career.deck.edit')}</Button>
            <p className={styles.small}>{t('career.lossNote')}</p>
          </section>

          {recent.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardLabel}>{t('career.recent')}</h2>
              <ul className={styles.recent}>
                {recent.slice(0, 5).map((payout) => {
                  const opponent = names.get(payout.opponent) ?? payout.opponent ?? '';
                  return (
                    <li key={payout.matchKey}>
                      <span className={payout.won ? styles.won : styles.lost}>{t(payout.won ? 'career.recent.won' : 'career.recent.lost', { opponent })}</span>
                      <small>{payout.note || t('career.recent.paid', { coins: payout.coins ?? 0, xp: payout.xp ?? 0 })}</small>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardLabel}>{t('career.settings')}</h2>
            <CountAiGames profile={profile} />
          </section>

          <Button variant="quiet" size="sm" icon={<Download size={16} />} onClick={() => void exportNow()}>{t('career.export')}</Button>
        </aside>
      </div>
    </div>
  );
}

// ---- Career outside its screens (loaded with this one): your profile's Career line, and unlocked sleeves in Decks

/** Your Career in a line, for your profile: level, title and achievements, with the way to the full list. */
export function CareerSummary({ user, onOpen }: { user: string; onOpen(): void }) {
  const t = useT();
  const navigate = useNavigate();
  const levels = useCareerLevels(true);
  const achievements = useCareerAchievements(true);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const title = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);
  if (!levels.data || !achievements.data) return null;
  const earned = achievements.data.filter((achievement) => achievement.achieved).length;
  return (
    <div className={styles.summary}>
      <CareerAvatar id={avatar} name={user} size={32} />
      <span className={styles.identityText}>
        {title && <b>{titleLabel(title)}</b>}
        <small>{t('career.profile.line', { level: levels.data.level ?? 1, earned, total: achievements.data.length })}</small>
      </span>
      <Button size="sm" variant="quiet" icon={<Trophy size={16} />} onClick={() => { onOpen(); navigate('/career/progress?tab=achievements'); }}>
        {t('career.progress.achievements')}
      </Button>
    </div>
  );
}

/** The sleeves a Career unlocked, beside the free ones wherever a deck's sleeves are chosen. */
export function CareerSleeves({ current, swatchClass, onPick }: { current: string; swatchClass: string; onPick(color: string): void }) {
  const t = useT();
  const unlocks = useCareerUnlocks();
  return unlockedIds(unlocks, 'sleeve').filter((id) => id in CAREER_SLEEVES).map((id) => {
    const color = CAREER_SLEEVES[id];
    const name = t('career.reward.sleeve', { name: cosmeticName(t, { kind: 'sleeve', id }) });
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={current === color}
        aria-label={name}
        title={name}
        className={swatchClass}
        style={{ background: color }}
        onClick={() => onPick(color)}
      />
    );
  });
}

// ---- progress pieces the Career screens share

/** A Career avatar: a dyed crest with its line drawing, or the player's initial before one is chosen. */
export function CareerAvatar({ id, name, size = 48 }: { id: string | null | undefined; name: string; size?: number }) {
  const art = id ? CAREER_AVATARS[id] : undefined;
  const style = { '--crest-size': `${size}px`, ...(art ? { '--crest-light': art.light, '--crest-dark': art.dark } : {}) } as CSSProperties;
  return (
    <span className={styles.crest} style={style} aria-hidden="true">
      {art ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={art.path} />
        </svg>
      ) : (
        <b>{name.slice(0, 1).toUpperCase()}</b>
      )}
    </span>
  );
}

/** A thin bar for progress toward a target. */
export function ProgressBar({ value, label, done }: { value: number; label: string; done?: boolean }) {
  return (
    <div className={[styles.bar2, done ? styles.bar2Done : ''].join(' ')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

/** The weekly goal: Career wins this week on one bar, with each goal that gives a free pack marked along it. */
export function WeeklyGoal({ weekly }: { weekly: CareerWeekly | undefined }) {
  const t = useT();
  const marks = weeklyMarks(weekly);
  const wins = weekly?.wins ?? 0;
  return (
    <div className={styles.weekly}>
      <p>
        <b>{t('career.weekly.wins', { count: wins })}</b>
        <small>{weekly?.nextGoal ? t('career.weekly.next', { goal: weekly.nextGoal }) : t('career.weekly.done')}</small>
      </p>
      <div className={styles.weeklyTrack} role="progressbar" aria-valuemin={0} aria-valuemax={marks.top} aria-valuenow={Math.min(wins, marks.top)} aria-label={t('career.weekly')}>
        <span className={styles.weeklyFill} style={{ width: `${marks.fill * 100}%` }} />
        {marks.goals.map((goal) => (
          <span
            key={goal.goal}
            className={[styles.weeklyMark, goal.reached ? styles.weeklyMarkOn : ''].join(' ')}
            style={{ left: `${goal.at * 100}%` }}
            title={t('career.weekly.goal', { goal: goal.goal })}
          >
            <Gift size={12} aria-hidden="true" />
            <small>{goal.goal}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The quests waiting, each with its bar and pay, and the day's swap. */
export function QuestList({ quests }: { quests: CareerQuests | undefined }) {
  const t = useT();
  const [swapping, setSwapping] = useState<number | null>(null);
  const list = quests?.quests ?? [];
  const canReroll = !!quests?.canReroll;

  async function swap(quest: CareerQuest) {
    setSwapping(quest.slot ?? null);
    try {
      await rerollQuest(quest.slot ?? 0);
    } catch (reason) {
      notify(t('career.quests.swapFailed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setSwapping(null);
    }
  }

  return (
    <>
      {list.length === 0 && <p className={styles.small}>{t('career.quests.none')}</p>}
      <ul className={styles.quests}>
        {list.map((quest) => (
          <li key={quest.slot} className={styles.quest}>
            <span>
              <b>{quest.text}</b>
              <small>{describePay(t, quest.coins, quest.xp)}</small>
            </span>
            <Button
              variant="quiet"
              size="sm"
              icon={<RefreshCw size={14} />}
              busy={swapping === quest.slot}
              disabled={!canReroll || swapping !== null}
              aria-label={t('career.quests.swapLabel', { quest: quest.text ?? '' })}
              title={canReroll ? t('career.quests.swapLabel', { quest: quest.text ?? '' }) : t('career.quests.swapUsed')}
              onClick={() => void swap(quest)}
            >
              {t('career.quests.swap')}
            </Button>
            <ProgressBar value={fraction(quest.progress, quest.target)} label={quest.text ?? ''} />
            <small>{quest.progress ?? 0} / {quest.target ?? 0}</small>
          </li>
        ))}
      </ul>
      <p className={styles.small}>{t('career.quests.note')}{canReroll ? '' : ` ${t('career.quests.swapUsed')}`}</p>
    </>
  );
}

/** Career's own setting: whether regular games against the AI count for quests and achievements. */
export function CountAiGames({ profile }: { profile: CareerProfile }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function change(count: boolean) {
    setBusy(true);
    try {
      await setCountAiGames(count);
    } catch (reason) {
      notify(t('career.settings.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={styles.setting}>
      <input type="checkbox" checked={!!profile.countAiGames} disabled={busy} onChange={(event) => void change(event.target.checked)} />
      <span>
        {t('career.settings.countAi')}
        <small>{t('career.settings.countAiNote')}</small>
      </span>
    </label>
  );
}

/** A done mark for finished quests and earned achievements. */
export function DoneMark({ label }: { label: string }) {
  return <span className={styles.doneMark} title={label}><Check size={14} aria-hidden="true" /><span className={styles.srOnly}>{label}</span></span>;
}
