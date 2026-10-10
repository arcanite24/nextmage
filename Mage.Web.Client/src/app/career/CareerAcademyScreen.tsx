import { Check, GraduationCap, Lock } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { CareerCampaign } from '../../protocol/generated/views';
import { registerMessages, useT } from '../i18n';
import messages from '../i18n/en/career';
import { CardFace } from '../ui/CardFace';
import { Campaign } from './CareerCampaignScreen';
import { useCareerState } from './careerData';
import { useCampaigns } from './careerModesData';
import { graduated, graduationOf, requirementLines, schoolsOf } from './careerModesModel';
import { CAREER_SLEEVES, cosmeticReward } from './progressModel';
import { Crest } from './ModeArt';
import { ModeResult } from './ModeParts';
import styles from './CareerModes.module.css';
import academy from './Academy.module.css';

registerMessages(messages);

/**
 * The academy: a school for every format, each a long questline from a first simple deck to the decks people play
 * today (CURRICULUM.md on the server). The hall lists them; a school's own page is its campaign.
 */
export function CareerAcademyScreen() {
  const t = useT();
  const { school } = useParams();
  const state = useCareerState();
  const profile = state.data?.profile;
  const campaigns = useCampaigns(!!profile);

  if (state.isPending) return <p className={styles.note}>{t('career.loading')}</p>;
  if (!profile) return <Navigate to="/career" replace />;
  const schools = schoolsOf(campaigns.data);
  const chosen = school ? schools.find((item) => item.id === school) : undefined;
  if (school && campaigns.isSuccess && !chosen) return <Navigate to="/career/academy" replace />;
  return (
    <div className={styles.page}>
      <div className={styles.scroll}>
        {campaigns.isPending && <p className={styles.note}>{t('career.loading')}</p>}
        {campaigns.isError && <p className={styles.error} role="alert">{t('career.failed')}</p>}
        {chosen ? <School campaign={chosen} campaigns={campaigns.data ?? []} /> : campaigns.isSuccess && <Hall schools={schools} campaigns={campaigns.data ?? []} />}
      </div>
    </div>
  );
}

function Hall({ schools, campaigns }: { schools: CareerCampaign[]; campaigns: CareerCampaign[] }) {
  const t = useT();
  const done = schools.filter(graduated).length;
  return (
    <section className={styles.campaign} aria-labelledby="academy-title">
      <ModeResult kind="campaign" />
      <header className={styles.modeHead}>
        <div>
          <h1 id="academy-title" className={styles.modeTitle}>{t('career.academy.title')}</h1>
          <p className={styles.lead}>{t('career.academy.lead')}</p>
        </div>
        <p className={styles.progressNote}>{t('career.academy.graduated', { done, total: schools.length })}</p>
      </header>
      {schools.length === 0 && <p className={styles.note}>{t('career.academy.none')}</p>}
      <ul className={academy.hall}>
        {schools.map((school) => <li key={school.id}><SchoolCard school={school} campaigns={campaigns} /></li>)}
      </ul>
    </section>
  );
}

/** A school on the hall's wall: its crest, what it teaches, how far you are, and what graduating gives. */
function SchoolCard({ school, campaigns }: { school: CareerCampaign; campaigns: CareerCampaign[] }) {
  const t = useT();
  const acts = school.chapters?.length ?? 4;
  const bosses = school.bosses ?? 0;
  const done = graduated(school);
  const body = (
    <>
      <span className={academy.crest}><Crest name={school.name ?? ''} colors={school.colors} school={school.id} size={76} /></span>
      <span className={academy.text}>
        <small className={academy.format}>{school.format}</small>
        <b className={academy.name}>{school.name}</b>
        <span className={academy.summary}>{school.summary}</span>
        {school.open ? (
          <span className={academy.acts} aria-label={t('career.academy.acts', { done: bosses, total: acts })}>
            {Array.from({ length: acts }, (_, index) => (
              <i key={index} className={index < bosses ? academy.actDone : academy.act} aria-hidden="true" />
            ))}
            <small>{done ? t('career.academy.graduate') : t('career.academy.acts', { done: bosses, total: acts })}</small>
          </span>
        ) : (
          <Requirements school={school} campaigns={campaigns} />
        )}
      </span>
      {done && <span className={academy.diploma}><GraduationCap size={18} aria-hidden="true" /> {t('career.academy.graduate')}</span>}
    </>
  );
  return school.open ? (
    <Link to={`/career/academy/${school.id}`} className={[academy.card, done ? academy.cardDone : ''].join(' ')} data-nav>{body}</Link>
  ) : (
    <div className={[academy.card, academy.cardLocked].join(' ')} aria-disabled="true">{body}</div>
  );
}

function Requirements({ school, campaigns }: { school: CareerCampaign; campaigns: CareerCampaign[] }) {
  const t = useT();
  const lines = requirementLines(school.missing, campaigns);
  return (
    <span className={academy.locked}>
      <Lock size={14} aria-hidden="true" />
      <span>
        {lines.map((alternatives, index) => (
          <span key={index} className={academy.need}>
            {alternatives.map((line) => t(line.key, line.vars)).join(` ${t('career.academy.or')} `)}
          </span>
        ))}
      </span>
    </span>
  );
}

/** A school's page: what graduating gives, then its four acts as a campaign. */
function School({ campaign, campaigns }: { campaign: CareerCampaign; campaigns: CareerCampaign[] }) {
  const t = useT();
  if (!campaign.open) {
    return (
      <section className={styles.campaign}>
        <header className={styles.modeHead}>
          <div>
            <h1 className={styles.modeTitle}>{campaign.name}</h1>
            <p className={styles.lead}>{campaign.summary}</p>
          </div>
        </header>
        <Requirements school={campaign} campaigns={campaigns} />
        <Link to="/career/academy" className={styles.small}>{t('career.academy.back')}</Link>
      </section>
    );
  }
  const finale = graduationOf(campaign);
  const cosmetics = finale?.reward?.cosmetics ?? [];
  const sleeve = cosmetics.find((cosmetic) => cosmetic.kind === 'sleeve');
  return (
    <Campaign campaign={campaign} back={`/career/academy/${campaign.id}`}>
      <ModeResult kind="campaign" />
      <aside className={academy.graduation} aria-label={t('career.academy.diplomaTitle')}>
        {sleeve?.id && CAREER_SLEEVES[sleeve.id] && (
          <span className={academy.sleeve}><CardFace card={{ name: '' }} hidden sleeve={CAREER_SLEEVES[sleeve.id]} size="small" /></span>
        )}
        <span>
          <b>{graduated(campaign) ? <><Check size={16} aria-hidden="true" /> {t('career.academy.graduate')}</> : t('career.academy.diplomaTitle')}</b>
          <small>{cosmetics.map((cosmetic) => cosmeticReward(t, cosmetic)).join(' · ')}</small>
        </span>
      </aside>
    </Campaign>
  );
}
