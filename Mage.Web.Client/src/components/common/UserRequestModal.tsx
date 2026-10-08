import React from 'react';
import { UserRequestService, type UserRequestButton } from '../../services/UserRequestService';
import type { UserRequestMessage } from '../../types';
import { Button } from './Button';
import { Modal } from './Modal';

interface UserRequestModalProps {
    request: UserRequestMessage | null;
    isOpen: boolean;
    isExecuting: boolean;
    error: string | null;
    onRespond: (buttonIndex: UserRequestButton['index']) => void;
    onClose: () => void;
}

function buttonVariantForButton(button: UserRequestButton): 'primary' | 'secondary' | 'danger' {
    const action = button.action;
    const text = button.text.toLowerCase();

    if (
        action?.includes('CONCEDE') ||
        action?.includes('QUIT') ||
        action?.includes('DISCONNECT') ||
        action?.includes('EXIT') ||
        action?.includes('REMOVE') ||
        text.includes('delete') ||
        text.includes('clear') ||
        text.includes('remove') ||
        text.includes('concede') ||
        text.includes('disconnect') ||
        text.includes('quit') ||
        text.includes('exit')
    ) {
        return 'danger';
    }

    return button.index === 1 ? 'primary' : 'secondary';
}

function modalSizeFor(request: UserRequestMessage | null): 'sm' | 'md' | 'lg' {
    if ((request?.windowSizeRatio ?? 1) > 1.15) return 'lg';
    return 'md';
}

export const UserRequestModal: React.FC<UserRequestModalProps> = ({
    request,
    isOpen,
    isExecuting,
    error,
    onRespond,
    onClose,
}) => {
    const buttons = request ? UserRequestService.getButtons(request) : [];

    return (
        <Modal
            isOpen={isOpen && !!request}
            onClose={onClose}
            title={request?.title ?? 'Message'}
            size={modalSizeFor(request)}
            closeOnBackdrop={false}
        >
            <div className="user-request-modal">
                <p>{request?.message}</p>

                {error && (
                    <p role="alert" className="user-request-error">
                        {error}
                    </p>
                )}

                <div className="user-request-actions">
                    {buttons.map(button => (
                        <Button
                            key={button.index}
                            variant={buttonVariantForButton(button)}
                            onClick={() => onRespond(button.index)}
                            disabled={isExecuting}
                            isLoading={isExecuting}
                        >
                            {button.text}
                        </Button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
