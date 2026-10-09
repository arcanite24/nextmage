/**
 * The translator itself, free of React and stores so it can be unit tested: message lookup with an English
 * fallback, `{name}` interpolation, plurals through Intl.PluralRules and numbers through Intl.NumberFormat.
 */

/** A message with plural forms, chosen by the `count` variable ("one", "other", and "zero", "few", "many" where the language has them). */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralMessage;
export type Messages = Record<string, Message>;
export type Vars = Record<string, string | number>;

export interface TranslatorOptions {
  /** BCP 47 tag the plurals and numbers follow */
  locale: string;
  /** the language's own messages; may be missing keys while a translation catches up */
  messages: Messages;
  /** the source language (English), read when `messages` lacks a key */
  fallback: Messages;
  /** told about keys neither catalog has; the key itself is shown */
  onMissing?(key: string): void;
}

export type Translate = (key: string, vars?: Vars) => string;

export function createTranslator({ locale, messages, fallback, onMissing }: TranslatorOptions): Translate {
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  return (key, vars) => {
    const message = messages[key] ?? fallback[key];
    if (message === undefined) {
      onMissing?.(key);
      return key;
    }
    let text: string;
    if (typeof message === 'string') {
      text = message;
    } else {
      const count = Number(vars?.count ?? 0);
      text = message[plurals.select(count)] ?? message.other;
    }
    return vars ? interpolate(text, vars, numbers) : text;
  };
}

/** Fills `{name}` placeholders; numbers are written the language's way (1,000 or 1.000). Unknown names stay as they are. */
export function interpolate(text: string, vars: Vars, numbers: Intl.NumberFormat): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? numbers.format(value) : value;
  });
}
