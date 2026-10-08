export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ServerPreset {
  id: string;
  label: string;
  description: string;
  url: string;
}

export interface RecentServer {
  url: string;
  label: string;
  lastConnectedAt: string;
}

export interface SavedServerPreset {
  id: string;
  label: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerEndpoint {
  protocol: 'ws' | 'wss';
  host: string;
  port: string;
  path: string;
}

export interface RestoreSessionEntry {
  sessionId: string;
  savedAt: string;
}

export interface ConnectionProfileSnapshot {
  lastServerUrl: string;
  recentServers: RecentServer[];
  customServerPresets: SavedServerPreset[];
  userNamesByServer: Record<string, string>;
  emailsByServerUser: Record<string, string>;
  restoreSessionsByServerUser: Record<string, RestoreSessionEntry>;
  autoConnect: boolean;
  autoConnectServerUrl: string;
}

const PROFILE_KEY = 'mage.client.connectionProfiles.v1';
const MAX_RECENT_SERVERS = 6;
const MAX_CUSTOM_SERVER_PRESETS = 12;

export const DEFAULT_SERVER_URL = 'ws://localhost:17172';

export const SERVER_PRESETS: ServerPreset[] = [
  {
    id: 'local',
    label: 'Local',
    description: 'Bundled dev server',
    url: DEFAULT_SERVER_URL,
  },
  {
    id: 'loopback',
    label: 'Loopback',
    description: 'IPv4 local server',
    url: 'ws://127.0.0.1:17172',
  },
  {
    id: 'main',
    label: 'Main',
    description: 'Public XMage host; WebSocket gateway not verified',
    url: 'ws://xmage.de:17172',
  },
  {
    id: 'beta',
    label: 'BETA',
    description: 'Public beta XMage host; WebSocket gateway not verified',
    url: 'ws://beta.xmage.de:17172',
  },
];

const DEFAULT_PROFILE: ConnectionProfileSnapshot = {
  lastServerUrl: DEFAULT_SERVER_URL,
  recentServers: [],
  customServerPresets: [],
  userNamesByServer: {},
  emailsByServerUser: {},
  restoreSessionsByServerUser: {},
  autoConnect: false,
  autoConnectServerUrl: DEFAULT_SERVER_URL,
};

const browserStorage: StorageAdapter = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_SERVER_URL;

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `ws://${trimmed}`;
  const inputHasExplicitPort = hasExplicitPort(trimmed);

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    }
    if (!url.port && !inputHasExplicitPort) {
      url.port = '17172';
    }
    url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

export function parseServerEndpoint(input: string): ServerEndpoint {
  const normalizedUrl = normalizeServerUrl(input);

  try {
    const url = new URL(normalizedUrl);
    return {
      protocol: url.protocol === 'wss:' ? 'wss' : 'ws',
      host: url.hostname || 'localhost',
      port: url.port || '17172',
      path: url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, ''),
    };
  } catch {
    return {
      protocol: 'ws',
      host: input.trim() || 'localhost',
      port: '17172',
      path: '',
    };
  }
}

export function buildServerUrl(endpoint: Partial<ServerEndpoint>): string {
  const protocol = endpoint.protocol === 'wss' ? 'wss' : 'ws';
  const host = endpoint.host?.trim() || 'localhost';
  const port = endpoint.port?.trim() || '17172';
  const rawPath = endpoint.path?.trim() ?? '';
  const path = rawPath && rawPath !== '/'
    ? `/${rawPath.replace(/^\/+/, '').replace(/\/+$/, '')}`
    : '';

  return normalizeServerUrl(`${protocol}://${host}${port ? `:${port}` : ''}${path}`);
}

function hasExplicitPort(input: string): boolean {
  const withoutProtocol = input.replace(/^[a-z]+:\/\//i, '');
  const host = withoutProtocol.startsWith('[')
    ? withoutProtocol.slice(0, withoutProtocol.indexOf(']') + 1)
    : withoutProtocol.split(/[/?#]/, 1)[0];

  return /:\d+$/.test(host);
}

export function connectionProfileKey(serverUrl: string, userName: string): string {
  return `${normalizeServerUrl(serverUrl)}\u0000${userName.trim().toLowerCase()}`;
}

export function summarizeServerLabel(serverUrl: string): string {
  try {
    const url = new URL(normalizeServerUrl(serverUrl));
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return serverUrl;
  }
}

export class ConnectionProfileService {
  constructor(private readonly storage: StorageAdapter = browserStorage) { }

  load(): ConnectionProfileSnapshot {
    if (typeof window === 'undefined' && this.storage === browserStorage) {
      return { ...DEFAULT_PROFILE };
    }

    try {
      const raw = this.storage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE };
      return this.normalizeSnapshot(JSON.parse(raw) as Partial<ConnectionProfileSnapshot>);
    } catch (error) {
      console.warn('[ConnectionProfile] Failed to load profiles, using defaults', error);
      return { ...DEFAULT_PROFILE };
    }
  }

  save(snapshot: ConnectionProfileSnapshot): ConnectionProfileSnapshot {
    const normalized = this.normalizeSnapshot(snapshot);
    if (typeof window !== 'undefined' || this.storage !== browserStorage) {
      this.storage.setItem(PROFILE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  reset(): ConnectionProfileSnapshot {
    if (typeof window !== 'undefined' || this.storage !== browserStorage) {
      this.storage.removeItem(PROFILE_KEY);
    }
    return { ...DEFAULT_PROFILE };
  }

  normalize(snapshot?: Partial<ConnectionProfileSnapshot> | null): ConnectionProfileSnapshot {
    return this.normalizeSnapshot(snapshot ?? {});
  }

  withSelectedServer(snapshot: ConnectionProfileSnapshot, serverUrl: string): ConnectionProfileSnapshot {
    const normalizedUrl = normalizeServerUrl(serverUrl);
    return this.save({
      ...snapshot,
      lastServerUrl: normalizedUrl,
      autoConnectServerUrl: snapshot.autoConnect ? normalizedUrl : snapshot.autoConnectServerUrl,
    });
  }

  withAutoConnect(snapshot: ConnectionProfileSnapshot, enabled: boolean, serverUrl: string): ConnectionProfileSnapshot {
    return this.save({
      ...snapshot,
      autoConnect: enabled,
      autoConnectServerUrl: normalizeServerUrl(serverUrl),
    });
  }

  saveServerPreset(
    snapshot: ConnectionProfileSnapshot,
    label: string,
    serverUrl: string,
    presetId?: string,
  ): ConnectionProfileSnapshot {
    const normalizedUrl = normalizeServerUrl(serverUrl);
    const existingPreset = presetId
      ? snapshot.customServerPresets.find(preset => preset.id === presetId)
      : snapshot.customServerPresets.find(preset => normalizeServerUrl(preset.url) === normalizedUrl);
    const now = new Date().toISOString();
    const id = existingPreset?.id ?? presetId?.trim() ?? createPresetId();
    const preset: SavedServerPreset = {
      id,
      label: label.trim() || existingPreset?.label || summarizeServerLabel(normalizedUrl),
      url: normalizedUrl,
      createdAt: existingPreset?.createdAt ?? now,
      updatedAt: now,
    };

    const customServerPresets = [
      preset,
      ...snapshot.customServerPresets.filter(existing =>
        existing.id !== id && normalizeServerUrl(existing.url) !== normalizedUrl
      ),
    ].slice(0, MAX_CUSTOM_SERVER_PRESETS);

    return this.save({
      ...snapshot,
      customServerPresets,
    });
  }

  deleteServerPreset(snapshot: ConnectionProfileSnapshot, presetId: string): ConnectionProfileSnapshot {
    return this.save({
      ...snapshot,
      customServerPresets: snapshot.customServerPresets.filter(preset => preset.id !== presetId),
    });
  }

  rememberLogin(
    snapshot: ConnectionProfileSnapshot,
    serverUrl: string,
    userName: string,
    email?: string,
  ): ConnectionProfileSnapshot {
    const normalizedUrl = normalizeServerUrl(serverUrl);
    const cleanUserName = userName.trim();
    const cleanEmail = email?.trim() ?? '';
    const recent: RecentServer = {
      url: normalizedUrl,
      label: summarizeServerLabel(normalizedUrl),
      lastConnectedAt: new Date().toISOString(),
    };

    const recentServers = [
      recent,
      ...snapshot.recentServers.filter(server => normalizeServerUrl(server.url) !== normalizedUrl),
    ].slice(0, MAX_RECENT_SERVERS);

    const emailsByServerUser = { ...snapshot.emailsByServerUser };
    if (cleanEmail) {
      emailsByServerUser[connectionProfileKey(normalizedUrl, cleanUserName)] = cleanEmail;
    }

    return this.save({
      ...snapshot,
      lastServerUrl: normalizedUrl,
      autoConnectServerUrl: snapshot.autoConnect ? normalizedUrl : snapshot.autoConnectServerUrl,
      recentServers,
      userNamesByServer: {
        ...snapshot.userNamesByServer,
        [normalizedUrl]: cleanUserName,
      },
      emailsByServerUser,
    });
  }

  rememberRestoreSession(
    snapshot: ConnectionProfileSnapshot,
    serverUrl: string,
    userName: string,
    sessionId: string,
  ): ConnectionProfileSnapshot {
    const cleanSessionId = sessionId.trim();
    if (!cleanSessionId) {
      return this.clearRestoreSession(snapshot, serverUrl, userName);
    }

    const key = connectionProfileKey(serverUrl, userName);
    return this.save({
      ...snapshot,
      restoreSessionsByServerUser: {
        ...snapshot.restoreSessionsByServerUser,
        [key]: {
          sessionId: cleanSessionId,
          savedAt: new Date().toISOString(),
        },
      },
    });
  }

  clearRestoreSession(
    snapshot: ConnectionProfileSnapshot,
    serverUrl: string,
    userName: string,
  ): ConnectionProfileSnapshot {
    const key = connectionProfileKey(serverUrl, userName);
    const restoreSessionsByServerUser = { ...snapshot.restoreSessionsByServerUser };
    delete restoreSessionsByServerUser[key];

    return this.save({
      ...snapshot,
      restoreSessionsByServerUser,
    });
  }

  findRestoreSession(snapshot: ConnectionProfileSnapshot, serverUrl: string, userName: string): string {
    return snapshot.restoreSessionsByServerUser[connectionProfileKey(serverUrl, userName)]?.sessionId ?? '';
  }

  private normalizeSnapshot(snapshot: Partial<ConnectionProfileSnapshot>): ConnectionProfileSnapshot {
    const lastServerUrl = normalizeServerUrl(snapshot.lastServerUrl ?? DEFAULT_SERVER_URL);
    const recentServers = this.normalizeRecent(snapshot.recentServers ?? []);
    const customServerPresets = this.normalizeCustomPresets(snapshot.customServerPresets ?? []);
    const userNamesByServer = normalizeRecordKeys(snapshot.userNamesByServer ?? {});
    const emailsByServerUser = { ...(snapshot.emailsByServerUser ?? {}) };
    const restoreSessionsByServerUser = normalizeRestoreSessionRecord(snapshot.restoreSessionsByServerUser ?? {});
    const autoConnectServerUrl = normalizeServerUrl(snapshot.autoConnectServerUrl ?? lastServerUrl);

    return {
      lastServerUrl,
      recentServers,
      customServerPresets,
      userNamesByServer,
      emailsByServerUser,
      restoreSessionsByServerUser,
      autoConnect: Boolean(snapshot.autoConnect),
      autoConnectServerUrl,
    };
  }

  private normalizeRecent(recentServers: RecentServer[]): RecentServer[] {
    const seen = new Set<string>();
    const normalized: RecentServer[] = [];

    for (const server of recentServers) {
      const url = normalizeServerUrl(server.url);
      if (seen.has(url)) continue;
      seen.add(url);
      normalized.push({
        url,
        label: server.label?.trim() || summarizeServerLabel(url),
        lastConnectedAt: server.lastConnectedAt || new Date(0).toISOString(),
      });
    }

    return normalized.slice(0, MAX_RECENT_SERVERS);
  }

  private normalizeCustomPresets(customServerPresets: SavedServerPreset[]): SavedServerPreset[] {
    const seen = new Set<string>();
    const normalized: SavedServerPreset[] = [];

    for (const preset of customServerPresets) {
      const url = normalizeServerUrl(preset.url);
      const id = preset.id?.trim() || createPresetId();
      if (seen.has(id)) continue;
      seen.add(id);

      normalized.push({
        id,
        label: preset.label?.trim() || summarizeServerLabel(url),
        url,
        createdAt: preset.createdAt || new Date(0).toISOString(),
        updatedAt: preset.updatedAt || preset.createdAt || new Date(0).toISOString(),
      });
    }

    return normalized.slice(0, MAX_CUSTOM_SERVER_PRESETS);
  }
}

function createPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRecordKeys(record: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const cleanValue = value.trim();
    if (!cleanValue) continue;
    normalized[normalizeServerUrl(key)] = cleanValue;
  }
  return normalized;
}

function normalizeRestoreSessionRecord(record: Record<string, RestoreSessionEntry>): Record<string, RestoreSessionEntry> {
  const normalized: Record<string, RestoreSessionEntry> = {};

  for (const [key, entry] of Object.entries(record)) {
    const cleanSessionId = entry?.sessionId?.trim();
    if (!cleanSessionId) continue;

    normalized[key] = {
      sessionId: cleanSessionId,
      savedAt: entry.savedAt || new Date(0).toISOString(),
    };
  }

  return normalized;
}

export const connectionProfileService = new ConnectionProfileService();
