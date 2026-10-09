import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../brand';
import styles from './AboutScreen.module.css';

const XMAGE_URL = 'https://github.com/magefree/mage';
const SOURCE_URL = 'https://github.com/arcanite24/nextmage';
const FAN_CONTENT_POLICY_URL = 'https://company.wizards.com/en/legal/fancontentpolicy';
const SCRYFALL_URL = 'https://scryfall.com';

/** Credits, licences and the legal notices a public server needs. Readable before signing in. */
export function AboutScreen() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <button type="button" className={styles.back} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <h1 className={styles.title}>About {APP_NAME}</h1>
        <p className={styles.lede}>
          {APP_NAME} is a free web client for XMage, the open-source Magic: The Gathering rules engine. Nobody pays to play,
          and nothing here is for sale.
        </p>

        <section className={styles.section} aria-labelledby="about-wotc">
          <h2 id="about-wotc">Wizards of the Coast</h2>
          <p>
            {APP_NAME} is unofficial Fan Content permitted under the <a href={FAN_CONTENT_POLICY_URL} target="_blank" rel="noreferrer">Fan Content Policy</a>.
            Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
          </p>
          <p>Magic: The Gathering, its card names, mana symbols and card text are trademarks and copyright of Wizards of the Coast.</p>
        </section>

        <section className={styles.section} aria-labelledby="about-scryfall">
          <h2 id="about-scryfall">Card images</h2>
          <p>
            Card images and card search data come from <a href={SCRYFALL_URL} target="_blank" rel="noreferrer">Scryfall</a>.
            {' '}{APP_NAME} is not produced by or endorsed by Scryfall. Images are cached by this server so that Scryfall is asked for each card only once.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="about-xmage">
          <h2 id="about-xmage">XMage and the source</h2>
          <p>
            The rules engine, card implementations and server are <a href={XMAGE_URL} target="_blank" rel="noreferrer">XMage</a>,
            {' '}by its many contributors, under the MIT licence. {APP_NAME}'s own code is in <a href={SOURCE_URL} target="_blank" rel="noreferrer">its repository</a>, under the same licence.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="about-type">
          <h2 id="about-type">Type and symbols</h2>
          <ul>
            <li>Barlow and Barlow Condensed by Jeremy Tribby, SIL Open Font License.</li>
            <li>Mana by Andrew Gioia: font under the SIL Open Font License, code under MIT.</li>
            <li>Lucide icons, ISC licence. Radix UI primitives, MIT licence.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="about-data">
          <h2 id="about-data">What this server keeps</h2>
          <ul>
            <li>Your player name, and for an account your email address and a hashed password.</li>
            <li>Decks you save to your account, ratings, finished match results, and game replays (deleted after a set number of days).</li>
            <li>Reports you file about other players, until a moderator closes them.</li>
            <li>Error reports from your browser when something breaks: the message, the screen and the browser, never your password.</li>
          </ul>
          <p>Chat is not stored. Friends and ignore lists stay in your browser.</p>
        </section>

        <p className={styles.foot}><Link to="/">Back to {APP_NAME}</Link></p>
      </div>
    </main>
  );
}
