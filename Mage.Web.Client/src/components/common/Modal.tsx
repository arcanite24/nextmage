/**
 * Modal Component
 * 
 * A reusable modal dialog with header, body, and footer sections.
 */

import React, { useEffect } from 'react';
import './Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
}) => {
    useEffect(() => {
        if (!closeOnEscape) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, closeOnEscape]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => {
                if (closeOnBackdrop && e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className={`modal modal-${size}`} role="dialog" aria-modal="true">
                {title && (
                    <div className="modal-header">
                        <h3 className="modal-title">{title}</h3>
                        <button
                            className="modal-close"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M5 5l10 10M15 5L5 15" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
};

export default Modal;
