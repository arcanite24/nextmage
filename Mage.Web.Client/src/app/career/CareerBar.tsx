import { Coins, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { CareerProfile } from '../../protocol/generated/views';
import { formatNumber, useT, type MessageKey } from '../i18n';
import styles from './Career.module.css';

const LINKS: { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/career', label: 'career.nav.home', end: true },
  { to: '/career/deck', label: 'career.nav.deck' },
  { to: '/career/collection', label: 'career.nav.collection' },
  { to: '/career/shop', label: 'career.nav.shop' },
];

/** Career's own header on every Career screen: where you are, and what you have to spend. */
export function CareerBar({ profile }: { profile: CareerProfile | undefined }) {
  const t = useT();
  const rare = profile?.wildcards?.rare ?? 0;
  const mythic = profile?.wildcards?.mythic ?? 0;
  return (
    <header className={styles.bar}>
      <h1 className={styles.barTitle}>{t('career.title')}</h1>
      <nav className={styles.barNav} aria-label={t('career.nav')}>
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => [styles.barLink, isActive ? styles.barLinkOn : ''].join(' ')}>
            {t(link.label)}
          </NavLink>
        ))}
      </nav>
      {profile && (
        <div className={styles.wallet}>
          <span className={styles.coins} title={t('career.coins', { count: profile.coins ?? 0 })}>
            <Coins size={18} aria-hidden="true" />
            <b>{formatNumber(profile.coins ?? 0)}</b>
            <span className={styles.srOnly}>{t('career.coins', { count: profile.coins ?? 0 })}</span>
          </span>
          <span className={styles.wildcards} title={t('career.wildcards')}>
            <Sparkles size={16} aria-hidden="true" />
            <span className={styles.wildRare} aria-label={t('career.wildcard.rare', { count: rare })}>{rare}</span>
            <span className={styles.wildMythic} aria-label={t('career.wildcard.mythic', { count: mythic })}>{mythic}</span>
          </span>
        </div>
      )}
    </header>
  );
}
