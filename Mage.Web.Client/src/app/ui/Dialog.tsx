import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  /** blocking choices can't be dismissed by Escape or clicking outside */
  dismissible?: boolean;
}

/** A printed zone laid over the dimmed mat. Focus is trapped and returned on close. */
export function Dialog({ open, onOpenChange, title, description, children, footer, width = 'md', dismissible = true }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={dismissible ? onOpenChange : undefined}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={[styles.content, styles[width]].join(' ')}
          onEscapeKeyDown={dismissible ? undefined : (event) => event.preventDefault()}
          onPointerDownOutside={dismissible ? undefined : (event) => event.preventDefault()}
          aria-describedby={description ? undefined : undefined}
        >
          <header className={styles.head}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            {dismissible && (
              <RadixDialog.Close className={styles.close} aria-label="Close">
                <X size={18} />
              </RadixDialog.Close>
            )}
          </header>
          {description
            ? <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>
            : <RadixDialog.Description className="visually-hidden">{title}</RadixDialog.Description>}
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
