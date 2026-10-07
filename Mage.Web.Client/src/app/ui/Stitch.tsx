import styles from './Stitch.module.css';

/** The stitched edge of the mat: a thread running around its border. */
export function Stitch({ inset = 10, radius = 18 }: { inset?: number; radius?: number }) {
  return (
    <svg className={styles.stitch} style={{ inset }} aria-hidden="true" preserveAspectRatio="none">
      <rect className={styles.groove} x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx={radius} ry={radius} />
      <rect className={styles.thread} x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" rx={radius} ry={radius} />
    </svg>
  );
}
