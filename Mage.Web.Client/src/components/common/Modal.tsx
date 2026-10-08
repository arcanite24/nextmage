/**
 * Modal Component
 * 
 * A reusable modal dialog with header, body, and footer sections.
 */

import React, { useEffect, useId, useRef } from 'react';
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
    showCloseButton?: boolean;
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
    showCloseButton = true,
}) => {
    const modalRef = useRef<HTMLDivElement | null>(null);
    const titleId = useId();

    useEffect(() => {
        if (!closeOnEscape) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape, { capture: true });
        return () => document.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, onClose, closeOnEscape]);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        if (isOpen) {
            document.body.style.overflow = 'hidden';

            window.requestAnimationFrame(() => {
                const focusableElements = getFocusableElements(modalRef.current);
                const focusTarget = focusableElements.find(element => (
                    element.autofocus || element.dataset.modalAutofocus === 'true'
                )) ?? focusableElements[0] ?? modalRef.current;
                focusTarget?.focus();
            });
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length === 0) {
            event.preventDefault();
            modalRef.current?.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => {
                if (closeOnBackdrop && e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={modalRef}
                className={`modal modal-${size}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                {title && (
                    <div className="modal-header">
                        <h3 className="modal-title" id={titleId}>{title}</h3>
                        {showCloseButton && (
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
                        )}
                    </div>
                )}
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
};

export default Modal;

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];

    const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(container.querySelectorAll<HTMLElement>(selector))
        .filter(element => !element.hasAttribute('hidden') && element.offsetParent !== null);
}
