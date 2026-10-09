import { Coins, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CareerCard } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { BoosterPack, type PackState } from './BoosterPack';
import { packSummary, revealOrder, spareCoins } from './careerModel';
import { playCareerCue } from './careerSound';
import { useStill } from './motion';
import motion from './motion.module.css';
import { CardArt, type ArtCard } from './Portraits';
import styles from './PackReveal.module.css';

const STAGGER_MS = 160;
/** the pack shakes this long before it tears */
const CHARGE_MS = 520;
/** from the tear to the cards flying out */
const TEAR_MS = 560;
/** how long a mythic holds the spotlight */
const SPOTLIGHT_MS = 1100;

/**
 * A freshly bought pack, opened on the whole screen, as the moment it should be: the pack under a light, shaking as
 * it's torn, light spilling out of the tear, the cards flying out face down into a fan. Rares and mythics glow before
 * they turn (brass, copper), burst when they do, and a mythic takes the spotlight and jolts the table. Cards new to the
 * collection say so; spares say what they became; a summary closes it. Everything can be skipped with Reveal all.
 */
export function PackReveal({ setName, setCode, cover, cards, fresh = [], canBuyAnother, onAnother, onClose }: {
  setName: string;
  setCode: string;
  cover?: ArtCard | null;
  cards: CareerCard[];
  /** names of the cards the collection didn't have before this pack */
  fresh?: readonly string[];
  canBuyAnother: boolean;
  onAnother(): void;
  onClose(): void;
}) {
  const t = useT();
  const still = useStill();
  const order = useMemo(() => revealOrder(cards), [cards]);
  const isFresh = useMemo(() => new Set(fresh.map((name) => name.toLowerCase())), [fresh]);
  const [stage, setStage] = useState<PackState | 'open'>('sealed');
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set());
  const [jolt, setJolt] = useState(false);
  const [spotlight, setSpotlight] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const tear = useRef<HTMLButtonElement>(null);
  const finish = useRef<HTMLButtonElement>(null);
  const fan = useRef<HTMLUListElement>(null);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const summary = useMemo(() => packSummary(cards), [cards]);
  const done = stage === 'open' && shown.size >= order.length;
  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));

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

  // the cards fly out of the pack: each starts where the pack was (the middle of the screen) and lands in its place
  useLayoutEffect(() => {
    if (stage !== 'open' || still || !fan.current) return;
    const box = fan.current.getBoundingClientRect();
    const originX = box.left + box.width / 2;
    const originY = window.innerHeight / 2;
    fan.current.querySelectorAll<HTMLElement>(':scope > li').forEach((item) => {
      const slot = item.getBoundingClientRect();
      item.style.setProperty('--fx', `${Math.round(originX - (slot.left + slot.width / 2))}px`);
      item.style.setProperty('--fy', `${Math.round(originY - (slot.top + slot.height / 2))}px`);
    });
    // set outside React's attributes, so later renders of the list leave the flight alone
    fan.current.dataset.fly = '';
  }, [stage, still]);

  function open() {
    if (stage !== 'sealed') return;
    if (still) {
      playCareerCue('tear');
      setStage('open');
      return;
    }
    setStage('charging');
    later(CHARGE_MS, () => {
      playCareerCue('tear');
      setStage('torn');
    });
    later(CHARGE_MS + TEAR_MS, () => setStage('open'));
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
      // a mythic takes the spotlight, and the table jolts
      setJolt(true);
      setSpotlight(index);
      timers.current.push(window.setTimeout(() => setJolt(false), 460));
      timers.current.push(window.setTimeout(() => setSpotlight((current) => (current === index ? null : current)), SPOTLIGHT_MS));
    }
  }, [order, still]);

  function revealAll() {
    const hidden = order.map((_, index) => index).filter((index) => !shown.has(index));
    if (still) {
      hidden.forEach((index) => show(index, true));
      return;
    }
    hidden.forEach((index, step) => later(step * STAGGER_MS, () => show(index, step > 0)));
  }

  // on the body: the Career scene around it is animated, and a transformed parent would trap a fixed overlay
  return createPortal(
    <div
      className={[styles.overlay, still ? motion.still : '', jolt ? styles.jolt : ''].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-title"
    >
      <span className={styles.backdrop} aria-hidden="true"><CardArt card={cover} name={setName} /></span>
      <h2 id="pack-title" className={styles.title}>{t('career.pack.title', { set: setName })}</h2>

      {stage !== 'open' ? (
        <div className={styles.stage}>
          <button ref={tear} type="button" className={styles.tear} onClick={open} aria-label={t('career.pack.tear')} disabled={stage !== 'sealed'}>
            <BoosterPack setCode={setCode} setName={setName} cover={cover} cards={order.length} size="lg" tilt={stage === 'sealed'} state={stage} />
          </button>
          <p className={styles.hint} aria-hidden={stage !== 'sealed'}>{stage === 'sealed' ? t('career.pack.tearHint') : ' '}</p>
        </div>
      ) : (
        <ul ref={fan} className={[styles.fan, spotlight !== null ? styles.dimmed : ''].join(' ')}>
          {order.map((card, index) => {
            const faceUp = shown.has(index);
            const ref = { name: card.name, setCode: card.setCode, cardNumber: card.cardNumber };
            const rarity = card.rarity === 'rare' || card.rarity === 'mythic' ? card.rarity : null;
            const isNew = faceUp && !card.convertedTo && !!card.name && isFresh.has(card.name.toLowerCase());
            return (
              <li
                key={index}
                className={[styles.slot, rarity ? styles[`${rarity}Slot`] : '', spotlight === index ? styles.spot : ''].join(' ')}
                style={{ '--i': index } as CSSProperties}
              >
                <button
                  type="button"
                  className={[styles.flip, faceUp ? styles.flipUp : ''].join(' ')}
                  onClick={() => show(index)}
                  aria-label={faceUp ? card.name : t('ui.hiddenCard')}
                  aria-pressed={faceUp}
                  data-nav
                >
                  <span className={styles.flipInner}>
                    <span className={styles.flipBack} aria-hidden={faceUp}><CardFace card={ref} hidden size="normal" /></span>
                    <span className={styles.flipFront} aria-hidden={!faceUp}><CardFace card={ref} size="normal" /></span>
                  </span>
                  {faceUp && rarity && <span className={styles.ring} aria-hidden="true" />}
                  {isNew && <span className={styles.newTag}>{t('career.binder.new')}</span>}
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
    </div>,
    document.body,
  );
}
