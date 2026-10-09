import { Coins, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CareerCard } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { packSummary, revealOrder, spareCoins } from './careerModel';
import { playCareerCue } from './careerSound';
import { dealStyle, useStill } from './motion';
import motion from './motion.module.css';
import styles from './PackReveal.module.css';

const STAGGER_MS = 160;
const TEAR_MS = 620;

/** A hue for a set's wrapper, so each set's packs look like their own (the same set always gets the same one). */
function wrapperHue(setCode: string): number {
  let hash = 0;
  for (const char of setCode) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/**
 * A freshly bought pack, opened on the whole screen: the sealed wrapper first, torn open, the cards fanned face down,
 * then turned one by one (or all at once). Rares glow brass and mythics copper with a jolt; spares say what they
 * became, and a summary closes it.
 */
export function PackReveal({ setName, setCode, cards, canBuyAnother, onAnother, onClose }: {
  setName: string;
  setCode: string;
  cards: CareerCard[];
  canBuyAnother: boolean;
  onAnother(): void;
  onClose(): void;
}) {
  const t = useT();
  const still = useStill();
  const order = useMemo(() => revealOrder(cards), [cards]);
  const [stage, setStage] = useState<'sealed' | 'tearing' | 'open'>('sealed');
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set());
  const [jolt, setJolt] = useState(false);
  const timers = useRef<number[]>([]);
  const tear = useRef<HTMLButtonElement>(null);
  const finish = useRef<HTMLButtonElement>(null);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const summary = useMemo(() => packSummary(cards), [cards]);
  const done = stage === 'open' && shown.size >= order.length;

  useEffect(() => {
    tear.current?.focus();
  }, []);
  useEffect(() => {
    if (done) finish.current?.focus();
  }, [done]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function open() {
    if (stage !== 'sealed') return;
    playCareerCue('tear');
    if (still) {
      setStage('open');
      return;
    }
    setStage('tearing');
    timers.current.push(window.setTimeout(() => setStage('open'), TEAR_MS));
  }

  // which cards are face up, kept in a ref too so a staggered reveal never turns (or sounds) one twice
  const up = useRef(new Set<number>());
  const show = useCallback((index: number, quiet = false) => {
    if (up.current.has(index)) return;
    up.current.add(index);
    setShown(new Set(up.current));
    const rarity = order[index]?.rarity;
    if (!quiet || rarity === 'rare' || rarity === 'mythic') playCareerCue(rarity === 'mythic' ? 'mythic' : rarity === 'rare' ? 'rare' : 'flip');
    if (rarity === 'mythic' && !still) {
      // the whole table jolts for a mythic
      setJolt(true);
      timers.current.push(window.setTimeout(() => setJolt(false), 460));
    }
  }, [order, still]);

  function revealAll() {
    const hidden = order.map((_, index) => index).filter((index) => !shown.has(index));
    if (still) {
      hidden.forEach((index) => show(index, true));
      return;
    }
    hidden.forEach((index, step) => timers.current.push(window.setTimeout(() => show(index, step > 0), step * STAGGER_MS)));
  }

  const hue = wrapperHue(setCode || setName);
  return (
    <div
      className={[styles.overlay, still ? motion.still : '', jolt ? styles.jolt : ''].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-title"
    >
      <h2 id="pack-title" className={styles.title}>{t('career.pack.title', { set: setName })}</h2>

      {stage !== 'open' ? (
        <div className={styles.stage}>
          <button
            ref={tear}
            type="button"
            className={[styles.wrapper, stage === 'tearing' ? styles.tearing : ''].join(' ')}
            style={{ '--wrapper-hue': hue } as CSSProperties}
            onClick={open}
            aria-label={t('career.pack.tear')}
          >
            <span className={styles.half} aria-hidden="true">
              <span className={styles.crimp} />
              <b className={styles.code}>{setCode}</b>
            </span>
            <span className={[styles.half, styles.lower].join(' ')} aria-hidden="true">
              <span className={styles.setName}>{setName}</span>
              <span className={styles.count}>{t('career.pack.cards', { count: order.length })}</span>
              <span className={[styles.crimp, styles.crimpBottom].join(' ')} />
            </span>
          </button>
          <p className={styles.hint}>{t('career.pack.tearHint')}</p>
        </div>
      ) : (
        <ul className={styles.fan}>
          {order.map((card, index) => {
            const faceUp = shown.has(index);
            const ref = { name: card.name, setCode: card.setCode, cardNumber: card.cardNumber };
            const rarity = card.rarity === 'rare' || card.rarity === 'mythic' ? card.rarity : null;
            return (
              <li key={index} className={motion.deal} style={dealStyle(index)}>
                <button
                  type="button"
                  className={[styles.flip, faceUp ? styles.flipUp : '', faceUp && rarity ? styles[rarity] : ''].join(' ')}
                  onClick={() => show(index)}
                  aria-label={faceUp ? card.name : t('ui.hiddenCard')}
                  aria-pressed={faceUp}
                  data-nav
                >
                  <span className={styles.flipInner}>
                    <span className={styles.flipBack} aria-hidden={faceUp}><CardFace card={ref} hidden size="normal" /></span>
                    <span className={styles.flipFront} aria-hidden={!faceUp}><CardFace card={ref} size="normal" /></span>
                  </span>
                  {faceUp && card.convertedTo === 'coins' && (
                    <span className={styles.badge}><Coins size={13} aria-hidden="true" /> {t('career.pack.toCoins', { coins: spareCoins(card.rarity) })}</span>
                  )}
                  {faceUp && card.convertedTo === 'wildcard' && (
                    <span className={styles.badge}><Sparkles size={13} aria-hidden="true" /> {t('career.pack.toWildcard')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className={styles.foot}>
        <p className={styles.summary} aria-live="polite">
          {done ? [
            t('career.pack.new', { count: summary.added }),
            summary.coins > 0 ? t('career.pack.coins', { coins: summary.coins }) : null,
            summary.wildcards > 0 ? t('career.pack.wildcards', { count: summary.wildcards }) : null,
            summary.basics > 0 ? t('career.pack.basics', { count: summary.basics }) : null,
          ].filter(Boolean).join(' · ') : stage === 'open' ? t('career.pack.tap') : ''}
        </p>
        {stage === 'open' && !done && <Button variant="decision" onClick={revealAll}>{t('career.pack.revealAll')}</Button>}
        {done && canBuyAnother && <Button variant="print" onClick={onAnother} data-nav>{t('career.pack.another')}</Button>}
        {done && <Button ref={finish} variant="decision" onClick={onClose} data-nav>{t('career.pack.done')}</Button>}
        {!done && <Button variant="quiet" onClick={onClose}>{t('career.pack.later')}</Button>}
      </footer>
    </div>
  );
}
