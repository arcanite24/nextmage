/**
 * Login Page
 * 
 * Magic Arena-inspired login and connection launcher.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    SERVER_PRESETS,
    buildServerUrl,
    connectionProfileKey,
    normalizeServerUrl,
    parseServerEndpoint,
    summarizeServerLabel,
    type ServerEndpoint,
} from '../../services';
import { useSessionStore } from '../../stores';
import { Button } from '../common';
import './LoginPage.css';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

type LoginMode = 'login' | 'register' | 'reset';
type ResetStep = 'request' | 'confirm';

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const serverUrl = useSessionStore(state => state.serverUrl);
    const connectionStatus = useSessionStore(state => state.connectionStatus);
    const connectionProfiles = useSessionStore(state => state.connectionProfiles);
    const serverStatus = useSessionStore(state => state.serverStatus);
    const setServerUrl = useSessionStore(state => state.setServerUrl);
    const connect = useSessionStore(state => state.connect);
    const cancelConnect = useSessionStore(state => state.cancelConnect);
    const checkServerStatus = useSessionStore(state => state.checkServerStatus);
    const setAutoConnect = useSessionStore(state => state.setAutoConnect);
    const saveServerPreset = useSessionStore(state => state.saveServerPreset);
    const deleteServerPreset = useSessionStore(state => state.deleteServerPreset);
    const login = useSessionStore(state => state.login);
    const register = useSessionStore(state => state.register);
    const requestPasswordResetToken = useSessionStore(state => state.requestPasswordResetToken);
    const resetPassword = useSessionStore(state => state.resetPassword);

    const [mode, setMode] = useState<LoginMode>('login');
    const [resetStep, setResetStep] = useState<ResetStep>('request');
    const [endpointDraft, setEndpointDraft] = useState<ServerEndpoint>(() => parseServerEndpoint(serverUrl));
    const [advancedServerInput, setAdvancedServerInput] = useState(serverUrl);
    const [presetName, setPresetName] = useState('');
    const [userName, setUserName] = useState(
        connectionProfiles.userNamesByServer[normalizeServerUrl(serverUrl)] ?? '',
    );
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [email, setEmail] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [statusLoading, setStatusLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

    const normalizedServerUrl = normalizeServerUrl(serverUrl);
    const customServerPresets = connectionProfiles.customServerPresets;
    const recentServers = useMemo(() => {
        const presetUrls = new Set([
            ...SERVER_PRESETS.map(preset => normalizeServerUrl(preset.url)),
            ...customServerPresets.map(preset => normalizeServerUrl(preset.url)),
        ]);
        return connectionProfiles.recentServers.filter(server => !presetUrls.has(normalizeServerUrl(server.url)));
    }, [connectionProfiles.recentServers, customServerPresets]);

    useEffect(() => {
        setEndpointDraft(parseServerEndpoint(serverUrl));
        setAdvancedServerInput(serverUrl);
    }, [serverUrl]);

    useEffect(() => {
        setUserName(connectionProfiles.userNamesByServer[normalizedServerUrl] ?? '');
    }, [connectionProfiles.userNamesByServer, normalizedServerUrl]);

    useEffect(() => {
        if (!userName) return;
        const rememberedEmail = connectionProfiles.emailsByServerUser[connectionProfileKey(normalizedServerUrl, userName)];
        if (rememberedEmail) {
            setEmail(rememberedEmail);
        }
    }, [connectionProfiles.emailsByServerUser, normalizedServerUrl, userName]);

    useEffect(() => {
        if (autoConnectAttempted || !connectionProfiles.autoConnect) return;

        if (normalizedServerUrl !== connectionProfiles.autoConnectServerUrl) {
            setEndpointDraft(parseServerEndpoint(connectionProfiles.autoConnectServerUrl));
            setAdvancedServerInput(connectionProfiles.autoConnectServerUrl);
            setServerUrl(connectionProfiles.autoConnectServerUrl);
            return;
        }

        setAutoConnectAttempted(true);
        connect().catch((err) => {
            setError(`Auto-connect failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }, [
        autoConnectAttempted,
        connect,
        connectionProfiles.autoConnect,
        connectionProfiles.autoConnectServerUrl,
        normalizedServerUrl,
        setServerUrl,
    ]);

    const resetTransientState = () => {
        setError(null);
        setMessage(null);
        setPassword('');
        setPasswordConfirm('');
        setAuthToken('');
    };

    const switchMode = (nextMode: LoginMode) => {
        resetTransientState();
        setMode(nextMode);
        setResetStep('request');
    };

    const syncServerDrafts = (nextServerUrl: string) => {
        const normalizedUrl = normalizeServerUrl(nextServerUrl);
        setEndpointDraft(parseServerEndpoint(normalizedUrl));
        setAdvancedServerInput(normalizedUrl);
        return normalizedUrl;
    };

    const commitEndpointDraft = (nextEndpointDraft = endpointDraft) => {
        const normalizedUrl = syncServerDrafts(buildServerUrl(nextEndpointDraft));
        setServerUrl(normalizedUrl);
        return normalizedUrl;
    };

    const commitAdvancedServerUrl = (nextServerUrl = advancedServerInput) => {
        const normalizedUrl = syncServerDrafts(nextServerUrl);
        setServerUrl(normalizedUrl);
        return normalizedUrl;
    };

    const selectServerUrl = (nextServerUrl: string) => {
        const normalizedUrl = syncServerDrafts(nextServerUrl);
        setServerUrl(normalizedUrl);
    };

    const updateEndpointDraft = (updates: Partial<ServerEndpoint>, commit = false) => {
        const nextDraft = {
            ...endpointDraft,
            ...updates,
        };
        setEndpointDraft(nextDraft);
        setAdvancedServerInput(buildServerUrl(nextDraft));
        if (commit) {
            commitEndpointDraft(nextDraft);
        }
    };

    const handleSavePreset = () => {
        const normalizedUrl = commitEndpointDraft();
        saveServerPreset(presetName, normalizedUrl);
        setPresetName('');
    };

    const ensureConnected = async () => {
        if (connectionStatus !== 'connected') {
            await connect();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);

        try {
            commitEndpointDraft();

            if (mode === 'reset') {
                await handleResetPassword();
                return;
            }

            if (mode === 'register' && password !== passwordConfirm) {
                setError('Passwords do not match.');
                return;
            }

            await ensureConnected();

            if (mode === 'register') {
                const success = await register(userName, password, email);
                if (!success) {
                    setError('Registration failed. Please try again.');
                    return;
                }
                setMessage('Account created. Connecting...');
            }

            const success = await login(userName, password);
            if (success) {
                onLoginSuccess();
            } else {
                setError('Invalid username or password.');
            }
        } catch (err) {
            setError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        commitEndpointDraft();

        if (resetStep === 'request') {
            await ensureConnected();
            const success = await requestPasswordResetToken(email);
            if (!success) {
                setError('Could not request a reset token for that email.');
                return;
            }
            setResetStep('confirm');
            setMessage('Token sent. Enter it with your new password.');
            return;
        }

        if (password !== passwordConfirm) {
            setError('Passwords do not match.');
            return;
        }

        await ensureConnected();
        const success = await resetPassword(email, authToken, password);
        if (!success) {
            setError('Password reset failed. Check the token and try again.');
            return;
        }

        setMessage('Password changed. Sign in with the new password.');
        setMode('login');
        setResetStep('request');
        setPassword('');
        setPasswordConfirm('');
        setAuthToken('');
    };

    const handleCheckServerStatus = async () => {
        commitEndpointDraft();
        setStatusLoading(true);
        setError(null);
        try {
            await checkServerStatus();
        } finally {
            setStatusLoading(false);
        }
    };

    const handleCancelConnect = () => {
        cancelConnect();
        setIsLoading(false);
    };

    const handleAutoConnectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAutoConnect(event.target.checked);
    };

    const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
    const submitLabel = mode === 'register'
        ? 'Create Account'
        : mode === 'reset'
            ? resetStep === 'request' ? 'Send Token' : 'Reset Password'
            : 'Connect';

    return (
        <div className="login-page">
            <div className="login-bg">
                <div className="login-bg-table" />
                <div className="login-bg-pattern" aria-hidden="true" />
            </div>

            <main className="login-shell">
                <section className="login-identity" aria-label="XMage">
                    <div className="login-logo">
                        <svg viewBox="0 0 100 100" className="logo-icon">
                            <defs>
                                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="3" />
                            <path
                                d="M50 15 L65 40 L90 50 L65 60 L50 85 L35 60 L10 50 L35 40 Z"
                                fill="url(#logoGradient)"
                                opacity="0.9"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="login-title">XMage</h1>
                        <p className="login-subtitle">Choose a server, sign in, and enter the lobby.</p>
                    </div>

                    <div className="login-status-panel" data-testid="login-connection-status">
                        <span
                            className={`status-dot ${connectionStatus === 'connected'
                                    ? 'status-connected'
                                    : isConnecting
                                        ? 'status-connecting'
                                        : 'status-disconnected'
                                }`}
                        />
                        <span className="status-text">
                            {connectionStatus === 'connected'
                                ? 'Connected'
                                : connectionStatus === 'connecting'
                                    ? 'Connecting...'
                                    : connectionStatus === 'reconnecting'
                                        ? 'Reconnecting...'
                                        : 'Disconnected'}
                        </span>
                    </div>
                </section>

                <section className="login-card glass-panel" aria-label="Connection">
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="login-form-heading">
                            <h2 className="login-form-title">
                                {mode === 'register' ? 'Create Account' : mode === 'reset' ? 'Reset Password' : 'Welcome Back'}
                            </h2>
                            <div className="login-mode-tabs" role="tablist" aria-label="Login mode">
                                <button
                                    type="button"
                                    className={`login-mode-tab ${mode === 'login' ? 'login-mode-tab-active' : ''}`}
                                    onClick={() => switchMode('login')}
                                    aria-selected={mode === 'login'}
                                    role="tab"
                                >
                                    Sign in
                                </button>
                                <button
                                    type="button"
                                    className={`login-mode-tab ${mode === 'register' ? 'login-mode-tab-active' : ''}`}
                                    onClick={() => switchMode('register')}
                                    aria-selected={mode === 'register'}
                                    role="tab"
                                >
                                    Register
                                </button>
                                <button
                                    type="button"
                                    className={`login-mode-tab ${mode === 'reset' ? 'login-mode-tab-active' : ''}`}
                                    onClick={() => switchMode('reset')}
                                    aria-selected={mode === 'reset'}
                                    role="tab"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="login-error" role="alert">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 8a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 1.5 0v3z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="login-message" role="status">
                                {message}
                            </div>
                        )}

                        <div className="server-presets" aria-label="Server presets">
                            {SERVER_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`server-preset ${normalizeServerUrl(preset.url) === normalizedServerUrl ? 'server-preset-active' : ''}`}
                                    onClick={() => selectServerUrl(preset.url)}
                                    title={preset.description}
                                    data-testid={`server-preset-${preset.id}`}
                                >
                                    <span>{preset.label}</span>
                                    <small>{summarizeServerLabel(preset.url)}</small>
                                </button>
                            ))}
                            {customServerPresets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className={`server-preset server-preset-custom ${normalizeServerUrl(preset.url) === normalizedServerUrl ? 'server-preset-active' : ''}`}
                                    data-testid="server-preset-custom"
                                >
                                    <button
                                        type="button"
                                        className="server-preset-main"
                                        onClick={() => selectServerUrl(preset.url)}
                                        title={preset.url}
                                        data-testid={`server-preset-custom-${preset.id}`}
                                    >
                                        <span>{preset.label}</span>
                                        <small>{summarizeServerLabel(preset.url)}</small>
                                    </button>
                                    <button
                                        type="button"
                                        className="server-preset-remove"
                                        onClick={() => deleteServerPreset(preset.id)}
                                        aria-label={`Remove ${preset.label}`}
                                    >
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>

                        {recentServers.length > 0 && (
                            <div className="recent-servers">
                                <span className="recent-servers-label">Recent</span>
                                <div className="recent-server-list">
                                    {recentServers.map(server => (
                                        <button
                                            key={server.url}
                                            type="button"
                                            className="recent-server"
                                            onClick={() => selectServerUrl(server.url)}
                                            data-testid="recent-server"
                                        >
                                            {server.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="input-group login-server-row">
                            <label htmlFor="serverUrl" className="input-label">
                                Server
                            </label>
                            <div className="endpoint-grid">
                                <label className="endpoint-field" htmlFor="serverHost">
                                    <span>Host</span>
                                    <input
                                        id="serverHost"
                                        type="text"
                                        className="input"
                                        value={endpointDraft.host}
                                        onChange={(e) => updateEndpointDraft({ host: e.target.value.trim() })}
                                        onBlur={() => commitEndpointDraft()}
                                        placeholder="localhost"
                                        autoComplete="off"
                                        data-testid="login-server-host"
                                    />
                                </label>
                                <label className="endpoint-field endpoint-port" htmlFor="serverPort">
                                    <span>Port</span>
                                    <input
                                        id="serverPort"
                                        type="text"
                                        inputMode="numeric"
                                        className="input"
                                        value={endpointDraft.port}
                                        onChange={(e) => updateEndpointDraft({ port: e.target.value.replace(/[^\d]/g, '') })}
                                        onBlur={() => commitEndpointDraft()}
                                        placeholder="17172"
                                        autoComplete="off"
                                        data-testid="login-server-port"
                                    />
                                </label>
                                <label className="endpoint-field endpoint-protocol" htmlFor="serverProtocol">
                                    <span>Protocol</span>
                                    <select
                                        id="serverProtocol"
                                        className="input"
                                        value={endpointDraft.protocol}
                                        onChange={(e) => updateEndpointDraft({ protocol: e.target.value as ServerEndpoint['protocol'] }, true)}
                                        data-testid="login-server-protocol"
                                    >
                                        <option value="ws">ws</option>
                                        <option value="wss">wss</option>
                                    </select>
                                </label>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    isLoading={statusLoading || serverStatus.status === 'checking'}
                                    onClick={handleCheckServerStatus}
                                    className="server-status-button"
                                    data-testid="login-server-status-check"
                                >
                                    Status
                                </Button>
                            </div>
                            <details className="advanced-server-url" data-testid="login-advanced-url">
                                <summary>Advanced URL</summary>
                                <input
                                    id="serverUrl"
                                    type="text"
                                    className="input"
                                    value={advancedServerInput}
                                    onChange={(e) => setAdvancedServerInput(e.target.value)}
                                    onBlur={() => commitAdvancedServerUrl()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            commitAdvancedServerUrl();
                                        }
                                    }}
                                    placeholder="ws://localhost:17172"
                                    data-testid="login-server-url"
                                />
                            </details>
                            <div className="preset-save-row">
                                <input
                                    type="text"
                                    className="input"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="Preset name"
                                    autoComplete="off"
                                    data-testid="login-preset-name"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleSavePreset}
                                    disabled={!endpointDraft.host.trim()}
                                    data-testid="login-save-preset"
                                >
                                    Save
                                </Button>
                            </div>
                            <div className={`server-status-line server-status-${serverStatus.status}`} data-testid="login-server-status">
                                {serverStatus.message}
                            </div>
                        </div>

                        {mode !== 'reset' && (
                            <div className="input-group">
                                <label htmlFor="userName" className="input-label">
                                    Username
                                </label>
                                <input
                                    id="userName"
                                    type="text"
                                    className="input"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="Enter your username"
                                    required
                                    autoComplete="username"
                                    data-testid="login-username"
                                />
                            </div>
                        )}

                        <div className="input-group">
                            <label htmlFor={mode === 'reset' ? 'email' : 'password'} className="input-label">
                                {mode === 'reset' && resetStep === 'request' ? 'Email' : 'Password'}
                            </label>
                            {mode === 'reset' && resetStep === 'request' ? (
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    autoComplete="email"
                                    data-testid="reset-email"
                                />
                            ) : (
                                <input
                                    id="password"
                                    type="password"
                                    className="input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === 'reset' ? 'Enter a new password' : 'Enter your password'}
                                    required
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    data-testid="login-password"
                                />
                            )}
                        </div>

                        {mode === 'reset' && resetStep === 'confirm' && (
                            <div className="input-group">
                                <label htmlFor="authToken" className="input-label">
                                    Token
                                </label>
                                <input
                                    id="authToken"
                                    type="text"
                                    className="input"
                                    value={authToken}
                                    onChange={(e) => setAuthToken(e.target.value)}
                                    placeholder="Enter the email token"
                                    required
                                    autoComplete="one-time-code"
                                    data-testid="reset-token"
                                />
                            </div>
                        )}

                        {(mode === 'register' || (mode === 'reset' && resetStep === 'confirm')) && (
                            <div className="input-group">
                                <label htmlFor="passwordConfirm" className="input-label">
                                    Confirm Password
                                </label>
                                <input
                                    id="passwordConfirm"
                                    type="password"
                                    className="input"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder="Confirm your password"
                                    required
                                    autoComplete="new-password"
                                    data-testid="login-password-confirm"
                                />
                            </div>
                        )}

                        {mode === 'register' && (
                            <div className="input-group">
                                <label htmlFor="email" className="input-label">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    autoComplete="email"
                                    data-testid="register-email"
                                />
                            </div>
                        )}

                        <label className="auto-connect-row">
                            <input
                                type="checkbox"
                                checked={connectionProfiles.autoConnect}
                                onChange={handleAutoConnectChange}
                                data-testid="login-auto-connect"
                            />
                            <span>Auto-connect to this server</span>
                        </label>

                        <div className="login-actions">
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={isLoading}
                                data-testid="login-submit"
                            >
                                {submitLabel}
                            </Button>

                            {isConnecting && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="lg"
                                    onClick={handleCancelConnect}
                                    data-testid="login-cancel-connect"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>

                        {mode === 'reset' && resetStep === 'confirm' && (
                            <button
                                type="button"
                                className="login-link-button"
                                onClick={() => setResetStep('request')}
                            >
                                Use a different email
                            </button>
                        )}
                    </form>
                </section>
            </main>
        </div>
    );
};

export default LoginPage;
