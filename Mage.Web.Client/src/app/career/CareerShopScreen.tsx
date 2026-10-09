import { Lock, Package, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { CareerPackResult, CareerShopSet } from '../../protocol/generated/views';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { CareerBar } from './CareerBar';
import { buyPack, useCareerShop, useCareerState } from './careerData';
import { PackReveal } from './PackReveal';
import styles from './Career.module.css';

registerMessages(messages);

/** The shop: packs of the sets the server sells, opened right here. */
export function CareerShopScreen() {
  const t = useT();
  const state = useCareerState();
  const profile = state.data?.profile;
  const shop = useCareerShop(!!profile);
  const [query, setQuery] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ result: CareerPackResult; set: CareerShopSet; serial: number } | null>(null);
  const sets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (shop.data ?? []).filter((set) => !needle || set.name?.toLowerCase().includes(needle) || set.setCode?.toLowerCase() === needle);
  }, [shop.data, query]);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  const coins = profile.coins ?? 0;
  const price = shop.data?.[0]?.price ?? 100;
  // free packs (level rewards, the weekly goal) are spent before coins
  const tokens = profile.packTokens ?? 0;

  async function buy(set: CareerShopSet) {
    setBuying(set.setCode ?? null);
    try {
      const result = await buyPack(set.setCode!);
      setOpened((current) => ({ result, set, serial: (current?.serial ?? 0) + 1 }));
    } catch (reason) {
      notify(t('career.shop.failed'), reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className={styles.page}>
      <CareerBar profile={profile} />
      <header className={styles.pageHead}>
        <p className={styles.lead}>{t('career.shop.lead', { price })}</p>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('career.shop.search')} aria-label={t('career.shop.search')} />
        </label>
      </header>
      <span id="career-short" hidden>{t('career.shop.short')}</span>
      {shop.isPending && <p className={styles.note}>{t('career.loading')}</p>}
      {shop.data && sets.length === 0 && <p className={styles.note}>{t('career.shop.none')}</p>}
      <ul className={styles.shop}>
        {sets.map((set) => {
          const short = tokens === 0 && coins < (set.price ?? price);
          // sets a campaign chapter still has to open come last, greyed, saying which chapter
          if (set.locked) {
            return (
              <li key={set.setCode} className={[styles.pack, styles.packLocked].join(' ')}>
                <Lock size={22} aria-hidden="true" className={styles.packIcon} />
                <span className={styles.packText}>
                  <b>{set.name}</b>
                  <small>{set.setCode} · {t('career.shop.locked', { chapter: set.unlockedBy ?? '' })}</small>
                </span>
              </li>
            );
          }
          return (
            <li key={set.setCode} className={styles.pack}>
              <Package size={22} aria-hidden="true" className={styles.packIcon} />
              <span className={styles.packText}>
                <b>{set.name}</b>
                <small>{set.setCode} · {set.releaseDate?.slice(0, 4)}</small>
              </span>
              <Button
                variant="print"
                size="sm"
                busy={buying === set.setCode}
                disabled={short || buying !== null}
                aria-describedby={short ? 'career-short' : undefined}
                onClick={() => void buy(set)}
              >
                {tokens > 0 ? t('career.shop.free', { count: tokens }) : t('career.shop.buy', { price: set.price ?? price })}
              </Button>
            </li>
          );
        })}
      </ul>
      {opened && (
        <PackReveal
          key={opened.serial}
          setName={opened.set.name ?? opened.result.setCode ?? ''}
          cards={opened.result.cards ?? []}
          canBuyAnother={((opened.result.profile?.packTokens ?? 0) > 0 || (opened.result.profile?.coins ?? 0) >= (opened.set.price ?? price)) && buying === null}
          onAnother={() => void buy(opened.set)}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
