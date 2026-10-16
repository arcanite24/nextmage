import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { createApi } from '../../protocol/generated/api';
import type { UpdateStatus } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { describeAge } from './adminFormat';
import styles from './AdminScreen.module.css';

type AdminApi = ReturnType<typeof createApi>;

const COMPOSE = 'docker compose -f ops/web/docker-compose.yml --env-file ops/web/.env';

/** What the running build is called: its image tag, else its commit. */
function describeBuild(version?: string, commit?: string): string {
  if (version) return version;
  return commit ? `commit ${commit.slice(0, 7)}` : 'an unknown build';
}

/**
 * Updates (admins and the owner): whether a newer published image is out than the one this server runs, what it
 * brings, and the commands that get it. The server asks the registry and GitHub (UpdateCheck), keeps the answer for an
 * hour, and lets a refresh go once a minute.
 */
export function UpdatesPage({ api }: { api: AdminApi }) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const status = useQuery({ queryKey: ['admin', 'update'], queryFn: () => api.adminUpdateStatus(false), staleTime: 5 * 60_000 });

  async function refresh() {
    setRefreshing(true);
    try {
      client.setQueryData(['admin', 'update'], await api.adminUpdateStatus(true));
    } finally {
      setRefreshing(false);
    }
  }

  if (status.error) return <p className={styles.error}>{String(status.error)}</p>;
  const data: UpdateStatus | undefined = status.data;
  if (!data) return <p className={styles.quiet}>Checking for updates…</p>;
  const current = describeBuild(data.currentVersion, data.currentCommit);
  const latest = describeBuild(data.latestVersion, data.latestCommit);
  const channel = data.channel === 'release' ? 'release' : 'master';
  const changes = data.changes ?? [];

  return (
    <div className={styles.overview}>
      <section aria-labelledby="update-state" className={styles.block}>
        <div className={styles.sectionHead}>
          <h2 id="update-state">Updates</h2>
          {data.enabled && (
            <Button size="sm" variant="quiet" icon={<RefreshCw size={14} />} busy={refreshing} onClick={() => void refresh()}>
              Check again
            </Button>
          )}
        </div>
        <p className={styles.lede}>
          {data.published
            ? <>This server runs the published image <span className={styles.mono}>{current}</span>, which follows {channel === 'release' ? 'releases' : 'master'}.</>
            : <>This server runs a local build ({current}). It's compared with master's newest published image.</>}
        </p>
        {!data.enabled ? (
          <p className={styles.quiet}>Update checks are off (XMAGE_UPDATE_CHECK=off in .env).</p>
        ) : data.error ? (
          <p className={styles.error}>{data.error}</p>
        ) : data.updateAvailable ? (
          <p className={styles.maintenance}>
            {latest} is out{data.commitsBehind ? `: ${data.commitsBehind} ${data.commitsBehind === 1 ? 'change' : 'changes'} newer than this server` : ''}.
          </p>
        ) : data.updateAvailable === false ? (
          <p>Up to date: nothing newer has been published on {channel}.</p>
        ) : (
          <p className={styles.quiet}>Can't tell whether {latest} is newer than this build.</p>
        )}
        {data.enabled && (data.checkedAt ?? 0) > 0 && (
          <p className={styles.quiet}>Checked {describeAge(data.checkedAt ?? 0, Date.now())}.</p>
        )}
      </section>

      {data.updateAvailable && (changes.length > 0 || data.notesUrl) && (
        <section aria-labelledby="update-changes" className={styles.block}>
          <h2 id="update-changes">What's new</h2>
          {changes.length > 0 && (
            <ul className={styles.list}>
              {changes.map((change) => (
                <li key={change.sha}>
                  {change.url ? <a href={change.url} target="_blank" rel="noreferrer">{change.title}</a> : change.title}
                </li>
              ))}
            </ul>
          )}
          {data.notesUrl && (
            <p className={styles.quiet}>
              <a href={data.notesUrl} target="_blank" rel="noreferrer">
                {channel === 'release' ? 'Release notes on GitHub' : 'Every change on GitHub'}
              </a>
              {(data.commitsBehind ?? 0) > changes.length ? ` (the newest ${changes.length} are listed here)` : ''}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="update-how" className={styles.block}>
        <h2 id="update-how">How to update</h2>
        {data.published ? (
          <>
            <p>
              On the server, in the folder you cloned, pull the new images and restart on them. Volumes and .env are
              kept. If .env pins the images by digest (<span className={styles.mono}>@sha256:…</span>), set them to the
              tags below first.
            </p>
            <Commands lines={[
              `XMAGE_SERVER_IMAGE=${data.serverImage}`,
              `XMAGE_WEB_IMAGE=${data.webImage}`,
            ]} label="ops/web/.env" />
            <Commands lines={['git pull', `${COMPOSE} pull xmage web`, `${COMPOSE} up -d --no-build`]} label="Shell" />
          </>
        ) : (
          <>
            <p>
              Switch to the published images and you won't have to build again: add these two lines to
              {' '}<span className={styles.mono}>ops/web/.env</span>, then pull and restart. Volumes and settings are kept.
            </p>
            <Commands lines={[
              `XMAGE_SERVER_IMAGE=${data.serverImage}`,
              `XMAGE_WEB_IMAGE=${data.webImage}`,
            ]} label="ops/web/.env" />
            <Commands lines={['git pull', `${COMPOSE} pull xmage web`, `${COMPOSE} up -d --no-build`]} label="Shell" />
            <p className={styles.quiet}>To build from the checkout again, empty those two lines and run {COMPOSE} up -d --build.</p>
          </>
        )}
        <p className={styles.quiet}>
          With games running, announce maintenance in Settings first: the restart ends every game in progress.
        </p>
      </section>
    </div>
  );
}

function Commands({ lines, label }: { lines: string[]; label: string }) {
  const [copied, setCopied] = useState(false);
  const text = lines.join('\n');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <figure className={styles.commands}>
      <figcaption>
        <span>{label}</span>
        <Button size="sm" variant="quiet" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </figcaption>
      <pre>{text}</pre>
    </figure>
  );
}
