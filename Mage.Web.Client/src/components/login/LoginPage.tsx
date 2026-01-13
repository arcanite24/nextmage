/**
 * Login Page
 * 
 * Beautiful, Magic Arena-inspired login screen.
 */

import React, { useState } from 'react';
import { useSessionStore } from '../../stores';
import { Button } from '../common';
import './LoginPage.css';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { serverUrl, setServerUrl, connect, login, register, connectionStatus } = useSessionStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Connect if not already connected
            if (connectionStatus !== 'connected') {
                await connect();
            }

            if (isRegisterMode) {
                const success = await register(userName, password, email);
                if (!success) {
                    setError('Registration failed. Please try again.');
                    return;
                }
            }

            const success = await login(userName, password);
            if (success) {
                onLoginSuccess();
            } else {
                setError('Invalid username or password.');
            }
        } catch (err) {
            setError(`Connection failed: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background */}
            <div className="login-bg">
                <div className="login-bg-gradient" />
                <div className="login-bg-pattern" />
                <div className="login-bg-glow" />
            </div>

            <div className="login-content">
                {/* Logo/Title */}
                <div className="login-header">
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
                    <h1 className="login-title">
                        <span className="text-gradient">XMage</span>
                    </h1>
                    <p className="login-subtitle">Experience Magic the Gathering online</p>
                </div>

                {/* Login form */}
                <div className="login-card glass-panel">
                    <form onSubmit={handleSubmit} className="login-form">
                        <h2 className="login-form-title">
                            {isRegisterMode ? 'Create Account' : 'Welcome Back'}
                        </h2>

                        {error && (
                            <div className="login-error">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 8a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 1.5 0v3z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="input-group">
                            <label htmlFor="serverUrl" className="input-label">
                                Server
                            </label>
                            <input
                                id="serverUrl"
                                type="text"
                                className="input"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="ws://localhost:17172"
                            />
                        </div>

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
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password" className="input-label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                            />
                        </div>

                        {isRegisterMode && (
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
                                />
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                        >
                            {isRegisterMode ? 'Create Account' : 'Connect'}
                        </Button>

                        <div className="login-divider">
                            <span>or</span>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            fullWidth
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setError(null);
                            }}
                        >
                            {isRegisterMode
                                ? 'Already have an account? Sign in'
                                : "Don't have an account? Register"}
                        </Button>
                    </form>
                </div>

                {/* Connection status */}
                <div className="login-status">
                    <span
                        className={`status-dot ${connectionStatus === 'connected'
                                ? 'status-connected'
                                : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
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
            </div>
        </div>
    );
};

export default LoginPage;
