import { useT } from '../i18n';
import { useEmailStatus } from '../queries';
import { EmailCodeForm } from './EmailConfirm';
import styles from './SettingsDialog.module.css';

/** Settings, Account: the account's email and confirming it. */
export function AccountSettings() {
  const t = useT();
  const status = useEmailStatus();
  const email = status.data;

  return (
    <>
      <section className={styles.accountSection} aria-labelledby="account-email">
        <h3 id="account-email" className={styles.rowLabel}>{t('settings.account.email')}</h3>
        {status.isError && <p className={styles.rowDetail} role="alert">{status.error instanceof Error ? status.error.message : String(status.error)}</p>}
        {email && (
          <>
            <p className={styles.rowDetail}>
              {email.email
                ? t(email.verified ? 'settings.account.email.verified' : 'settings.account.email.unverified', { email: email.email })
                : t('settings.account.email.none')}
            </p>
            {email.email && !email.verified && (email.mail ? <EmailCodeForm /> : <p className={styles.rowDetail}>{t('settings.account.email.noMail')}</p>)}
          </>
        )}
      </section>
    </>
  );
}
