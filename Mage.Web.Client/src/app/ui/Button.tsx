import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
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
