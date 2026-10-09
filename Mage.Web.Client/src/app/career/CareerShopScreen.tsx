import { Coins, Lock, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { CareerShopSet } from '../../protocol/generated/views';
import { formatNumber, registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { BoosterPack } from './BoosterPack';
import { buyPack, useCareerSetProgress, useCareerShop, useCareerState, type OpenedPack } from './careerData';
import { useSceneArt } from './careerScene';
import { ProgressBar } from './CareerScreen';
import { dealStyle } from './motion';
import motion from './motion.module.css';
import { PackReveal } from './PackReveal';
import { fraction } from './progressModel';
import styles from './Career.module.css';
import shop from './Shop.module.css';

registerMessages(messages);

/**
 * The shop: one set's pack on the counter, big enough to want, with what it costs and how much of the set you have;
 * every other set's pack on the shelf below. Buying tears the pack open right here.
 */
export function CareerShopScreen() {
  const t = useT();
  const state = useCareerState();
  const profile = state.data?.profile;
  const catalog = useCareerShop(!!profile);
  const progress = useCareerSetProgress(!!profile);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ result: OpenedPack; set: CareerShopSet; serial: number } | null>(null);
  const sets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog.data ?? []).filter((set) => !needle || set.name?.toLowerCase().includes(needle) || set.setCode?.toLowerCase() === needle);
  }, [catalog.data, query]);
  const completion = useMemo(() => new Map((progress.data ?? []).map((set) => [set.setCode, set])), [progress.data]);
  const featured = sets.find((set) => set.setCode === chosen) ?? sets.find((set) => !set.locked) ?? sets[0];
  useSceneArt(featured?.cover);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  const coins = profile.coins ?? 0;
  const price = featured?.price ?? catalog.data?.[0]?.price ?? 100;
  // free packs (level rewards, the weekly goal) are spent before coins
  const tokens = profile.packTokens ?? 0;
  const short = tokens === 0 && coins < price;

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

  const have = completion.get(featured?.setCode);
  return (
    <div className={shop.shop}>
      {catalog.isPending && <p className={styles.note}>{t('career.loading')}</p>}
      {featured && (
        <section className={[shop.counter, motion.scene].join(' ')} aria-labelledby="shop-set" key={featured.setCode}>
          <div className={shop.display}>
            <button
              type="button"
              className={shop.featuredPack}
              disabled={featured.locked || short || buying !== null}
              onClick={() => void buy(featured)}
              aria-label={featured.locked ? t('career.shop.locked', { chapter: featured.unlockedBy ?? '' }) : t('career.shop.openOne', { set: featured.name ?? '' })}
            >
              <BoosterPack setCode={featured.setCode ?? ''} setName={featured.name ?? ''} cover={featured.cover} size="lg" tilt={!featured.locked} locked={featured.locked} />
            </button>
            <span className={shop.pedestal} aria-hidden="true" />
          </div>
          <div className={shop.pitch}>
            <p className={shop.kicker}>{[featured.setCode, featured.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ')}</p>
            <h2 id="shop-set" className={shop.setName}>{featured.name}</h2>
            {have && (have.total ?? 0) > 0 && (
              <div className={shop.completion}>
                <ProgressBar value={fraction(have.owned, have.total)} label={t('career.shop.collected', { owned: have.owned ?? 0, total: have.total ?? 0 })} done={have.owned === have.total} />
                <span>{t('career.shop.collected', { owned: formatNumber(have.owned ?? 0), total: formatNumber(have.total ?? 0) })}</span>
              </div>
            )}
            <ul className={shop.facts}>
              <li><Sparkles size={16} aria-hidden="true" /> {t('career.shop.factRare')}</li>
              <li><Coins size={16} aria-hidden="true" /> {t('career.shop.factSpares')}</li>
            </ul>
            {featured.locked ? (
              <p className={shop.lockedNote}><Lock size={16} aria-hidden="true" /> {t('career.shop.locked', { chapter: featured.unlockedBy ?? '' })}</p>
            ) : (
              <div className={shop.buy}>
                <span className={shop.price}>
                  {tokens > 0 ? t('career.shop.tokens', { count: tokens }) : <><Coins size={20} aria-hidden="true" /> {formatNumber(price)}</>}
                </span>
                <Button
                  variant="decision"
                  size="xl"
                  busy={buying === featured.setCode}
                  disabled={short || buying !== null}
                  aria-describedby={short ? 'career-short' : undefined}
                  onClick={() => void buy(featured)}
                  data-nav
                >
                  {tokens > 0 ? t('career.shop.openFree') : t('career.shop.buyOpen')}
                </Button>
              </div>
            )}
            {!featured.locked && short && <p id="career-short" className={shop.short}>{t('career.shop.shortBy', { coins: formatNumber(price - coins) })}</p>}
          </div>
        </section>
      )}

      <section className={shop.shelf} aria-labelledby="shop-shelf">
        <header className={shop.shelfHead}>
          <h3 id="shop-shelf">{t('career.shop.shelf')}</h3>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('career.shop.search')} aria-label={t('career.shop.search')} />
          </label>
        </header>
        {catalog.data && sets.length === 0 && <p className={styles.note}>{t('career.shop.none')}</p>}
        <ul className={shop.rack}>
          {sets.map((set, index) => {
            const progressOf = completion.get(set.setCode);
            const on = set.setCode === featured?.setCode;
            return (
              <li key={set.setCode} className={motion.deal} style={dealStyle(index)}>
                <button
                  type="button"
                  className={[shop.slot, on ? shop.slotOn : ''].join(' ')}
                  aria-pressed={on}
                  onClick={() => setChosen(set.setCode ?? null)}
                  data-nav
                >
                  <BoosterPack setCode={set.setCode ?? ''} setName={set.name ?? ''} cover={set.cover} size="sm" locked={set.locked} />
                  <span className={shop.slotName}>{set.name}</span>
                  <small>
                    {set.locked
                      ? t('career.shop.lockedShort')
                      : progressOf?.total ? t('career.shop.collected', { owned: progressOf.owned ?? 0, total: progressOf.total }) : set.releaseDate?.slice(0, 4)}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {opened && (
        <PackReveal
          key={opened.serial}
          setName={opened.set.name ?? opened.result.setCode ?? ''}
          setCode={opened.result.setCode ?? opened.set.setCode ?? ''}
          cover={opened.set.cover}
          fresh={opened.result.fresh}
          cards={opened.result.cards ?? []}
          canBuyAnother={((opened.result.profile?.packTokens ?? 0) > 0 || (opened.result.profile?.coins ?? 0) >= (opened.set.price ?? price)) && buying === null}
          onAnother={() => void buy(opened.set)}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
