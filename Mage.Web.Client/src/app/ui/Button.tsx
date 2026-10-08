import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  /** the decision in front of the player; one per screen */
  | 'decision'
  /** printed outline on the mat */
  | 'print'
  /** text-only, for secondary actions */
  | 'quiet'
  | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'print', size = 'md', icon, busy, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[styles.button, styles[variant], styles[size], busy ? styles.busy : '', className ?? ''].join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  );
});

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
}

/** A link that looks like a Button, for actions that leave Playmat (a deck's page on its site). */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'print', size = 'md', icon, children, className, ...rest },
  ref,
) {
  return (
    <a ref={ref} className={[styles.button, styles[variant], styles[size], className ?? ''].join(' ')} {...rest}>
      {children && <span className={styles.label}>{children}</span>}
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
    </a>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  pressed?: boolean;
}

/** Square button with an icon; the label is its accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={[styles.iconButton, pressed ? styles.pressed : '', className ?? ''].join(' ')}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
});
