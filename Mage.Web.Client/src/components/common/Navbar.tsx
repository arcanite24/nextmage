/**
 * Shared Navbar Component
 * 
 * Appears at the top of authenticated pages (Lobby, Deck Editor, etc.)
 */

import React from 'react';
import { useSessionStore } from '../../stores';
import { Button } from './Button';
import './Navbar.css';

export type NavPage = 'lobby' | 'decks' | 'settings' | 'tournaments' | 'history';

interface NavbarProps {
    currentPage: NavPage;
    onNavigate: (page: NavPage) => void;
    onLogout: () => void | boolean;
    supportMenu?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onLogout, supportMenu }) => {
    const { userName, logout } = useSessionStore();

    const handleLogout = () => {
        const shouldLogout = onLogout();
        if (shouldLogout === false) {
            return;
        }
        logout();
    };

    return (
        <header className="navbar">
            <div className="navbar-left">
                <div className="navbar-logo">
                    <svg viewBox="0 0 100 100" className="logo-icon-small">
                        <defs>
                            <linearGradient id="logoGradientSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradientSmall)" strokeWidth="3" />
                        <path
                            d="M50 15 L65 40 L90 50 L65 60 L50 85 L35 60 L10 50 L35 40 Z"
                            fill="url(#logoGradientSmall)"
                            opacity="0.9"
                        />
                    </svg>
                    <span className="logo-text">XMage</span>
                </div>
            </div>

            <div className="navbar-center">
                <nav className="navbar-nav">
                    <button
                        className={`nav-item ${currentPage === 'lobby' ? 'active' : ''}`}
                        onClick={() => onNavigate('lobby')}
                    >
                        Lobby
                    </button>
                    <button
                        className={`nav-item ${currentPage === 'decks' ? 'active' : ''}`}
                        onClick={() => onNavigate('decks')}
                    >
                        Decks
                    </button>
                    <button
                        className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                        onClick={() => onNavigate('settings')}
                    >
                        Settings
                    </button>
                    <button
                        className={`nav-item ${currentPage === 'tournaments' ? 'active' : ''}`}
                        onClick={() => onNavigate('tournaments')}
                    >
                        Tournaments
                    </button>
                    <button
                        className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
                        onClick={() => onNavigate('history')}
                    >
                        History
                    </button>
                </nav>
            </div>

            <div className="navbar-right">
                {supportMenu && (
                    <div className="navbar-support">
                        {supportMenu}
                    </div>
                )}
                <div className="user-info">
                    <span className="user-avatar">
                        {userName?.charAt(0).toUpperCase()}
                    </span>
                    <span className="user-name">{userName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    Logout
                </Button>
            </div>
        </header>
    );
};
