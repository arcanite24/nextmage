import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Zone.module.css';

export interface ZoneProps extends HTMLAttributes<HTMLElement> {
  /** label screen-printed into the outline, like a mat's zone name */
  label?: string;
  /** right side of the label row: counts, actions */
  aside?: ReactNode;
  as?: 'section' | 'div' | 'aside' | 'form';
  tone?: 'line' | 'filled';
}

/** A printed zone outline on the mat. Content sits inside the printed line. */
export function Zone({ label, aside, as: Tag = 'section', tone = 'line', className, children, ...rest }: ZoneProps) {
  return (
    <Tag className={[styles.zone, styles[tone], className ?? ''].join(' ')} {...rest}>
      {(label || aside) && (
        <header className={styles.head}>
          {label && <h2 className={styles.label}>{label}</h2>}
          {aside && <div className={styles.aside}>{aside}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
