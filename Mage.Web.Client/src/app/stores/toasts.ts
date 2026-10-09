import { create } from 'zustand';
import { events } from '../connection';
import { stripMarkup } from '../../core/game/prompt';
import { useSession } from './session';

export interface ToastAction {
  label: string;
  run(): void;
}

export interface Toast {
  id: number;
  title: string;
  message: string;
  tone: 'info' | 'error';
  /** one follow-up, such as Undo; the toast closes when it runs */
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push(toast: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })), toast.tone === 'error' ? 9000 : 6000);
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
  },
}));

export function notify(title: string, message: string, tone: Toast['tone'] = 'info', action?: ToastAction) {
  useToasts.getState().push({ title, message, tone, action });
}

events.on('SHOW_USERMESSAGE', (data) => {
  // before sign-in (registering, resetting a password) the sign-in screen shows the reason itself
  if (useSession.getState().phase !== 'signedIn') return;
  const [title, message] = Array.isArray(data) ? data : ['Server', String(data ?? '')];
  notify(stripMarkup(title) || 'Server', stripMarkup(message));
});

events.on('SERVER_MESSAGE', (message) => {
  notify(message?.username ?? 'Server', stripMarkup(message?.message), message?.color === 'RED' ? 'error' : 'info');
});
