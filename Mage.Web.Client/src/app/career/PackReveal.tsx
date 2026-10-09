import { Coins, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CareerCard } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { useSettings } from '../stores/settings';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Dialog } from '../ui/Dialog';
import { packSummary, revealOrder, spareCoins } from './careerModel';
import styles from './Career.module.css';

const STAGGER_MS = 140;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A freshly bought pack, face down: turn the cards one by one, or all at once; spares say what they became. */
export function PackReveal({ setName, cards, canBuyAnother, onAnother, onClose }: {
  setName: string;
  cards: CareerCard[];
  canBuyAnother: boolean;
  onAnother(): void;
  onClose(): void;
}) {
  const t = useT();
  const animations = useSettings((state) => state.settings.animations);
  const [still] = useState(() => !animations || reducedMotion());
  const order = useMemo(() => revealOrder(cards), [cards]);
  // without motion the pack opens face up
  const [shown, setShown] = useState<ReadonlySet<number>>(() => (still ? new Set(order.map((_, index) => index)) : new Set()));
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const summary = useMemo(() => packSummary(cards), [cards]);
  const done = shown.size >= order.length;

  const show = (index: number) => setShown((current) => (current.has(index) ? current : new Set(current).add(index)));
  function revealAll() {
    const hidden = order.map((_, index) => index).filter((index) => !shown.has(index));
    if (still) {
      setShown(new Set(order.map((_, index) => index)));
      return;
    }
    hidden.forEach((index, step) => timers.current.push(window.setTimeout(() => show(index), step * STAGGER_MS)));
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('career.pack.title', { set: setName })}
      width="xl"
      footer={(
        <div className={styles.revealFoot}>
          <p className={styles.revealSummary} aria-live="polite">
            {done ? [
              t('career.pack.new', { count: summary.added }),
              summary.coins > 0 ? t('career.pack.coins', { coins: summary.coins }) : null,
              summary.wildcards > 0 ? t('career.pack.wildcards', { count: summary.wildcards }) : null,
              summary.basics > 0 ? t('career.pack.basics', { count: summary.basics }) : null,
            ].filter(Boolean).join(' · ') : t('career.pack.tap')}
          </p>
          {!done && <Button variant="decision" onClick={revealAll}>{t('career.pack.revealAll')}</Button>}
          {done && canBuyAnother && <Button variant="print" onClick={onAnother}>{t('career.pack.another')}</Button>}
          {done && <Button variant="decision" onClick={onClose}>{t('career.pack.done')}</Button>}
        </div>
      )}
    >
      <ul className={[styles.reveal, still ? styles.still : ''].join(' ')}>
        {order.map((card, index) => {
          const up = shown.has(index);
          const ref = { name: card.name, setCode: card.setCode, cardNumber: card.cardNumber };
          return (
            <li key={index}>
              <button
                type="button"
                className={[styles.flip, up ? styles.flipUp : '', up && (card.rarity === 'rare' || card.rarity === 'mythic') ? styles[card.rarity] : ''].join(' ')}
                onClick={() => show(index)}
                aria-label={up ? card.name : t('ui.hiddenCard')}
                aria-pressed={up}
              >
                <span className={styles.flipInner}>
                  <span className={styles.flipBack} aria-hidden={up}><CardFace card={ref} hidden size="normal" /></span>
                  <span className={styles.flipFront} aria-hidden={!up}><CardFace card={ref} size="normal" /></span>
                </span>
                {up && card.convertedTo === 'coins' && (
                  <span className={styles.badge}><Coins size={13} aria-hidden="true" /> {t('career.pack.toCoins', { coins: spareCoins(card.rarity) })}</span>
                )}
                {up && card.convertedTo === 'wildcard' && (
                  <span className={styles.badge}><Sparkles size={13} aria-hidden="true" /> {t('career.pack.toWildcard')}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
