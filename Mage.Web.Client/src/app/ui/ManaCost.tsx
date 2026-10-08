import { manaClass, parseSymbols } from './mana';
import styles from './ManaCost.module.css';

/**
 * Mana symbols from XMage cost strings ("{2}{U}{U}", "{W/U}", "{X}") drawn with the open-source Mana font.
 */
export function ManaCost({ cost, size = 'md' }: { cost: string | string[] | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const symbols = parseSymbols(cost);
  if (symbols.length === 0) return null;
  return (
    <span className={[styles.cost, styles[size]].join(' ')} aria-label={`Mana cost ${symbols.map((s) => `{${s}}`).join('')}`} role="img">
      {symbols.map((symbol, index) => (
        <i key={index} className={`ms ms-cost ms-shadow ms-${manaClass(symbol)}`} aria-hidden="true" />
      ))}
    </span>
  );
}
