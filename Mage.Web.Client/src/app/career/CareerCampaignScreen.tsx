import { BookOpen, Check, Crown, Lock, Signpost, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { CareerCampaign, CareerChapter, CareerNode, CareerOption } from '../../protocol/generated/views';
import { api } from '../connection';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { useCoach } from '../stores/coach';
import { usePlay } from '../stores/play';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CareerBar } from './CareerBar';
import { useCareerState } from './careerData';
import { chooseOption, playMode, playPrologue, useCampaigns } from './careerModesData';
import {
  chapterDone, chapterPath, focusChapter, focusNode, legCurve, nodeState, rewardLines, twistLines, type NodeState, type PathStop,
} from './careerModesModel';
import { Crest, Portrait } from './ModeArt';
import { LineList, ModeResult, ModesNav } from './ModeParts';
import styles from './CareerModes.module.css';

registerMessages(messages);

/** Campaigns: chapters of duels along a path, each chapter with its own deck, a boss at the end and a set it opens. */
export function CareerCampaignScreen() {
  const t = useT();
  const state = useCareerState();
  const profile = state.data?.profile;
  const campaigns = useCampaigns(!!profile);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  return (
    <div className={styles.page}>
      <CareerBar profile={profile} />
      <ModesNav />
      <div className={styles.scroll}>
        <ModeResult kind="campaign" />
        {campaigns.isPending && <p className={styles.note}>{t('career.loading')}</p>}
        {campaigns.isError && <p className={styles.error} role="alert">{t('career.failed')}</p>}
        {campaigns.data?.length === 0 && <p className={styles.note}>{t('career.campaign.none')}</p>}
        {campaigns.data?.map((campaign) => <Campaign key={campaign.id} campaign={campaign} />)}
      </div>
    </div>
  );
}

function Campaign({ campaign }: { campaign: CareerCampaign }) {
  const t = useT();
  const chapters = useMemo(() => campaign.chapters ?? [], [campaign.chapters]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chapter = chapters.find((item) => item.id === chosenId) ?? focusChapter(chapters);

  return (
    <section className={styles.campaign} aria-labelledby={`campaign-${campaign.id}`}>
      <header className={styles.modeHead}>
        <div>
          <h1 id={`campaign-${campaign.id}`} className={styles.modeTitle}>{campaign.name}</h1>
          <p className={styles.lead}>{campaign.text}</p>
        </div>
        <p className={styles.progressNote}>{t('career.campaign.progress', { done: campaign.done ?? 0, total: campaign.total ?? 0 })}</p>
      </header>

      {campaign.prologue === 'guided' && <Prologue />}

      <div className={styles.chapterTabs} role="group" aria-label={t('career.campaign.chapters')}>
        {chapters.map((item) => {
          const progress = chapterDone(item);
          return (
            <button
              key={item.id}
              type="button"
              className={[styles.chapterTab, item.id === chapter?.id ? styles.chapterTabOn : ''].join(' ')}
              aria-pressed={item.id === chapter?.id}
              onClick={() => setChosenId(item.id ?? null)}
            >
              <Crest name={item.name ?? ''} colors={item.color} size={40} />
              <span className={styles.chapterTabText}>
                <b>{item.name}</b>
                <small>{item.done ? t('career.campaign.chapterDone') : t('career.campaign.chapterProgress', { done: progress.done, total: progress.total })}</small>
              </span>
              {item.done && <Check size={16} aria-hidden="true" className={styles.doneMark} />}
            </button>
          );
        })}
      </div>

      {chapter && <Chapter key={chapter.id} campaignId={campaign.id ?? ''} chapter={chapter} />}
    </section>
  );
}

/** The guided first game, as the campaign's prologue. */
function Prologue() {
  const t = useT();
  const played = useCoach((coach) => coach.firstGameDone);
  const playing = usePlay((play) => play.phase !== 'idle');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await playPrologue();
    } catch (reason) {
      notify(t('career.playFailed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.prologue} aria-labelledby="campaign-prologue">
      <BookOpen size={22} aria-hidden="true" className={styles.prologueIcon} />
      <div className={styles.prologueText}>
        <h2 id="campaign-prologue">{t('career.campaign.prologue')}</h2>
        <p>{t(played ? 'career.campaign.prologuePlayed' : 'career.campaign.prologueText')}</p>
      </div>
      <Button variant={played ? 'quiet' : 'print'} size="sm" busy={busy} disabled={playing} onClick={() => void start()}>
        {t(played ? 'career.campaign.prologueAgain' : 'career.campaign.prologuePlay')}
      </Button>
    </section>
  );
}

function Chapter({ campaignId, chapter }: { campaignId: string; chapter: CareerChapter }) {
  const t = useT();
  const nodes = useMemo(() => chapter.nodes ?? [], [chapter.nodes]);
  const path = useMemo(() => chapterPath(nodes), [nodes]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const node = nodes.find((item) => item.id === chosenId) ?? focusNode(chapter);
  const boss = nodes.find((item) => item.boss);

  return (
    <section className={styles.chapter} aria-labelledby={`chapter-${chapter.id}`}>
      <header className={styles.chapterHead}>
        <Crest name={chapter.name ?? ''} colors={chapter.color} size={72} />
        <div className={styles.chapterHeadText}>
          <h2 id={`chapter-${chapter.id}`} className={styles.chapterTitle}>{chapter.name}</h2>
          <p className={styles.lead}>{chapter.text}</p>
          <p className={styles.chapterMeta}>
            <span>{t('career.campaign.deck', { deck: chapter.deckName ?? '' })}</span>
            {chapter.unlockSet && (
              <span>{t(chapter.done ? 'career.campaign.setOpened' : 'career.campaign.opensSet', { set: chapter.unlockSet, boss: boss?.name ?? '' })}</span>
            )}
          </p>
        </div>
      </header>

      <div className={styles.mapWrap}>
        <div className={styles.map} style={{ aspectRatio: `${path.width} / ${path.height}` }}>
          <svg className={styles.mapTrail} viewBox={`0 0 ${path.width} ${path.height}`} aria-hidden="true" focusable="false">
            {path.legs.map((leg, index) => (
              <path key={index} d={legCurve(leg)} className={[styles.leg, styles[`leg_${leg.state}`]].join(' ')} />
            ))}
          </svg>
          <ol className={styles.stops} aria-label={t('career.campaign.path')}>
            {path.stops.map((stop) => (
              <li
                key={stop.node.id}
                className={styles.stopItem}
                style={{ left: `${(stop.x / path.width) * 100}%`, top: `${(stop.y / path.height) * 100}%` }}
              >
                <Stop stop={stop} selected={stop.node.id === node?.id} onSelect={() => setChosenId(stop.node.id ?? null)} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {node && <NodeDetail key={node.id} campaignId={campaignId} chapter={chapter} node={node} />}
    </section>
  );
}

const STATE_KEYS = { locked: 'career.node.locked', open: 'career.node.open', done: 'career.node.done' } as const;

function Stop({ stop, selected, onSelect }: { stop: PathStop; selected: boolean; onSelect(): void }) {
  const t = useT();
  const { node, state } = stop;
  const Icon = state === 'done' ? Check : state === 'locked' ? Lock : node.type === 'choice' ? Signpost : node.boss ? Crown : Swords;
  const label = [node.name, t(STATE_KEYS[state]), node.boss ? t('career.node.boss') : null, node.type === 'choice' ? t('career.node.choice') : null].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      className={[styles.stop, styles[`stop_${state}`], node.boss ? styles.stopBoss : '', selected ? styles.stopOn : ''].join(' ')}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
    >
      <span className={styles.stopDot} aria-hidden="true">
        <Icon size={node.boss ? 24 : 18} />
      </span>
      <span className={styles.stopName} aria-hidden="true">{node.name}</span>
      {node.boss && <span className={styles.bossTag} aria-hidden="true">{t('career.node.boss')}</span>}
    </button>
  );
}

function NodeDetail({ campaignId, chapter, node }: { campaignId: string; chapter: CareerChapter; node: CareerNode }) {
  const t = useT();
  const state: NodeState = nodeState(node);
  const playing = usePlay((play) => play.phase !== 'idle');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const twists = twistLines(node.twists);
  const reward = rewardLines(node.reward);

  async function play() {
    setStarting(true);
    setError(null);
    try {
      await playMode('campaign', () => api.careerCampaignPlay(campaignId, node.id!));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStarting(false);
    }
  }

  return (
    <article className={styles.detail} aria-labelledby={`node-${node.id}`}>
      <div className={styles.detailArt}>
        {node.type === 'choice'
          ? <span className={styles.choiceArt} aria-hidden="true"><Signpost size={40} /></span>
          : <Portrait name={node.name ?? ''} colors={chapter.color} boss={node.boss} size={96} />}
      </div>
      <div className={styles.detailBody}>
        <header className={styles.detailHead}>
          <h3 id={`node-${node.id}`}>{node.name}</h3>
          <span className={[styles.stateTag, styles[`tag_${state}`]].join(' ')}>{t(STATE_KEYS[state])}</span>
          {node.boss && <span className={styles.bossBadge}><Crown size={14} aria-hidden="true" /> {t('career.node.boss')}</span>}
        </header>
        {node.text && <p className={styles.lead}>{node.text}</p>}
        {error && <p className={styles.error} role="alert">{t('career.playFailed')}: {error}</p>}

        {node.type === 'choice' ? (
          <Choice campaignId={campaignId} node={node} state={state} />
        ) : (
          <>
            <div className={styles.detailCols}>
              <div>
                <h4 className={styles.subhead}>{t(state === 'done' ? 'career.node.paid' : 'career.node.pays')}</h4>
                {reward.length > 0 ? <LineList lines={reward} /> : <p className={styles.small}>{t('career.node.noReward')}</p>}
              </div>
              <div>
                <h4 className={styles.subhead}>{t('career.node.opponent')}</h4>
                <p className={styles.small}>{t('career.node.skill', { skill: node.skill ?? 1 })}</p>
                {twists.length > 0 && (
                  <>
                    <h4 className={styles.subhead}>{t('career.twist.title')}</h4>
                    <LineList lines={twists} className={styles.twists} />
                  </>
                )}
              </div>
            </div>
            <div className={styles.actions}>
              {state === 'locked' ? (
                <p className={styles.small}><Lock size={14} aria-hidden="true" /> {t('career.node.lockedHint')}</p>
              ) : (
                <Button variant={state === 'open' ? 'decision' : 'print'} icon={<Swords size={16} />} busy={starting} disabled={playing} onClick={() => void play()}>
                  {starting ? t('career.playing') : t(state === 'done' ? 'career.node.playAgain' : 'career.node.play')}
                </Button>
              )}
              <small className={styles.small}>{t('career.campaign.youPlay', { deck: chapter.deckName ?? '' })}</small>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function Choice({ campaignId, node, state }: { campaignId: string; node: CareerNode; state: NodeState }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [paid, setPaid] = useState<string[] | null>(null);
  const options = node.options ?? [];
  const taken = options.find((option) => option.id === node.choice);

  async function choose(option: CareerOption) {
    setBusy(option.id ?? null);
    try {
      const result = await chooseOption(campaignId, node.id!, option.id!);
      const lines = result.mode?.lines ?? [];
      setPaid(lines.length > 0 ? lines : [option.text ?? '']);
      notify(t('career.choice.taken'), option.text ?? '');
    } catch (reason) {
      notify(t('career.choice.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (paid) {
    return (
      <div className={styles.paid} role="status">
        <h4 className={styles.subhead}>{t('career.choice.taken')}</h4>
        <ul className={styles.lines}>{paid.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </div>
    );
  }
  if (state === 'done') {
    return <p className={styles.small}>{taken ? t('career.choice.took', { option: taken.text ?? '' }) : t('career.node.done')}</p>;
  }
  return (
    <div className={styles.options} role="group" aria-label={t('career.choice.pick')}>
      {state === 'locked' && <p className={styles.small}><Lock size={14} aria-hidden="true" /> {t('career.node.lockedHint')}</p>}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.option}
          disabled={state !== 'open' || busy !== null}
          aria-busy={busy === option.id || undefined}
          onClick={() => void choose(option)}
        >
          <b>{option.text}</b>
          <OptionReward option={option} />
        </button>
      ))}
    </div>
  );
}

function OptionReward({ option }: { option: CareerOption }) {
  const t = useT();
  const lines = rewardLines(option.reward);
  return <small>{lines.map((line) => t(line.key, line.vars)).join(' · ')}</small>;
}
