import { ArrowLeft, Coins, Music, Package, Settings, Sparkles, VolumeX } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { CareerProfile } from '../../protocol/generated/views';
import { formatNumber, registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { usePlay } from '../stores/play';
import { useSession } from '../stores/session';
import { useSettings } from '../stores/settings';
import { useShellUi } from '../stores/shellUi';
import { MatPrint } from '../ui/MatPrint';
import { CareerAvatar } from './CareerScreen';
import { CeremonyHost } from './Ceremony';
import { useCareerLook, useCareerState } from './careerData';
import { setMusicLevel, startCareerMusic, stopCareerMusic } from './careerMusic';
import { useCareerScene } from './careerScene';
import { playCareerCue } from './careerSound';
import { levelProgress } from './careerModel';
import { screenOf } from './careerScreens';
import { useMenuNav } from './menuNav';
import { useCountUp, useStill } from './motion';
import { titleLabel } from './progressModel';
import motion from './motion.module.css';
import styles from './CareerShell.module.css';

registerMessages(messages);

/**
 * Career as a game mode: its screens fill the mat under their own header (who you are, your level, what you have to
 * spend), the art of whatever is in front of you printed behind them, music, and Escape to step back.
 */
export function CareerShell() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const still = useStill();
  const state = useCareerState();
  const profile = state.data?.profile;
  const art = useCareerScene((scene) => scene.art);
  const { title, back } = screenOf(location.pathname);
  const hub = location.pathname.replace(/\/+$/, '') === '/career';
  const playing = usePlay((play) => play.phase !== 'idle');
  const main = useRef<HTMLDivElement>(null);

  useMusic(!!profile && !playing);

  const goBack = () => {
    playCareerCue('whoosh');
    navigate(hub ? '/' : back);
  };
  useMenuNav(main, goBack);

  return (
    <div className={[styles.shell, still ? motion.still : ''].join(' ')}>
      <MatPrint card={art} className={styles.backdrop} />
      <div className={styles.vignette} aria-hidden="true" />
      <header className={styles.hud}>
        <div className={styles.hudLeft}>
          <button type="button" className={styles.back} onClick={goBack} aria-label={hub ? t('career.hud.leave') : t('career.hud.back')} data-nav>
            <ArrowLeft size={20} aria-hidden="true" />
            <span>{hub ? t('career.hud.leave') : t('career.hud.back')}</span>
          </button>
          <div className={styles.titles}>
            <span className={styles.mode}>{t('career.title')}</span>
            {title && <h1 className={styles.screenTitle}>{t(title)}</h1>}
          </div>
        </div>
        {profile && <Hud profile={profile} />}
      </header>
      <div ref={main} className={styles.main}>
        <div key={location.pathname} className={[styles.scene, motion.scene].join(' ')}>
          <Outlet />
        </div>
      </div>
      <CeremonyHost />
    </div>
  );
}

/** Music while Career is open and no game is: starts on the first click if the browser held it back. */
function useMusic(on: boolean) {
  const music = useSettings((settings) => settings.settings.careerMusic);
  const sound = useSettings((settings) => settings.settings.sound);
  const volume = useSettings((settings) => settings.settings.volume);
  const musicVolume = useSettings((settings) => settings.settings.musicVolume);
  const wanted = on && music && sound;
  useEffect(() => {
    if (!wanted) {
      stopCareerMusic();
      return;
    }
    startCareerMusic();
    // browsers keep audio silent until the page is touched; the first touch starts it for real
    const kick = () => startCareerMusic();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, [wanted]);
  useEffect(() => {
    if (wanted) setMusicLevel();
  }, [wanted, volume, musicVolume]);
  useEffect(() => () => stopCareerMusic(), []);
}

function Hud({ profile }: { profile: CareerProfile }) {
  const t = useT();
  const user = useSession((session) => session.userName);
  const avatar = useCareerLook((look) => look.looks[user.toLowerCase()]?.avatar ?? null);
  const titleId = useCareerLook((look) => look.looks[user.toLowerCase()]?.title ?? null);
  const music = useSettings((settings) => settings.settings.careerMusic);
  const still = useStill();
  const coins = useCountUp(profile.coins ?? 0, { still, duration: 800 });
  const level = levelProgress(profile.xp ?? 0, profile.level ?? 1);
  const rare = profile.wildcards?.rare ?? 0;
  const mythic = profile.wildcards?.mythic ?? 0;
  const packs = profile.packTokens ?? 0;

  return (
    <div className={styles.hudRight}>
      <div className={styles.wallet} aria-label={t('career.hud.wallet')} role="group">
        <span className={styles.coin} title={t('career.coins', { count: profile.coins ?? 0 })}>
          <Coins size={18} aria-hidden="true" />
          <b aria-hidden="true">{formatNumber(coins)}</b>
          <span className={styles.srOnly}>{t('career.coins', { count: profile.coins ?? 0 })}</span>
        </span>
        <span className={styles.wild} title={t('career.wildcards')}>
          <Sparkles size={16} aria-hidden="true" />
          <span className={styles.wildRare} aria-label={t('career.wildcard.rare', { count: rare })}>{rare}</span>
          <span className={styles.wildMythic} aria-label={t('career.wildcard.mythic', { count: mythic })}>{mythic}</span>
        </span>
        {packs > 0 && (
          <span className={styles.packs} title={t('career.hud.packs', { count: packs })}>
            <Package size={16} aria-hidden="true" />
            <b aria-hidden="true">{packs}</b>
            <span className={styles.srOnly}>{t('career.hud.packs', { count: packs })}</span>
          </span>
        )}
      </div>
      <div className={styles.identity}>
        <LevelMedallion level={profile.level ?? 1} fraction={level.max ? 1 : level.fraction} label={level.max ? t('career.xpMax') : t('career.xp', { into: level.into, needed: level.needed })}>
          <CareerAvatar id={avatar} name={user} size={44} />
        </LevelMedallion>
        <span className={styles.name}>
          <b>{user}</b>
          {titleId && <small>{titleLabel(titleId)}</small>}
        </span>
      </div>
      <button
        type="button"
        className={styles.icon}
        aria-pressed={music}
        aria-label={music ? t('career.hud.musicOff') : t('career.hud.musicOn')}
        title={music ? t('career.hud.musicOff') : t('career.hud.musicOn')}
        onClick={() => useSettings.getState().update({ careerMusic: !music })}
        data-nav
      >
        {music ? <Music size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      </button>
      <button type="button" className={styles.icon} aria-label={t('shell.settings')} title={t('shell.settings')} onClick={() => useShellUi.getState().setSettingsOpen(true)} data-nav>
        <Settings size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The player's crest in a ring that fills with XP, the level stamped on it. */
export function LevelMedallion({ level, fraction, label, size = 56, children }: { level: number; fraction: number; label: string; size?: number; children: React.ReactNode }) {
  const t = useT();
  const radius = 26;
  const length = 2 * Math.PI * radius;
  return (
    <span
      className={styles.medallion}
      style={{ '--medal': `${size}px` } as CSSProperties}
      role="img"
      aria-label={`${t('career.level', { level })}, ${label}`}
      title={label}
    >
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r={radius} className={styles.ringTrack} />
        <circle cx="30" cy="30" r={radius} className={styles.ringFill} strokeDasharray={length} strokeDashoffset={length * (1 - Math.min(Math.max(fraction, 0), 1))} />
      </svg>
      <span className={styles.medalFace}>{children}</span>
      <b className={styles.medalLevel} aria-hidden="true">{level}</b>
    </span>
  );
}
