// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { useSettings } from '../stores/settings';
import { i18nReady, registerMessages, t, useI18n } from '.';

const settled = () => new Promise<void>((resolve) => {
  const stop = useI18n.subscribe(() => {
    stop();
    resolve();
  });
});

describe('i18n store', () => {
  test('starts in English and switches language from the settings, setting <html lang>', async () => {
    await i18nReady;
    expect(useI18n.getState().locale).toBe('en');
    expect(t('shell.nav.play')).toBe('Play');

    const switched = settled();
    useSettings.getState().update({ locale: 'es' });
    await switched;
    expect(useI18n.getState().locale).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(t('shell.nav.play')).toBe('Jugar');
    expect(t('settings.answers.count', { count: 3 })).toBe('3 fijadas');

    const back = settled();
    useSettings.getState().update({ locale: 'en' });
    await back;
    expect(document.documentElement.lang).toBe('en');
    expect(t('shell.nav.play')).toBe('Play');
  });

  test("a lazy screen's English is found once it registers", () => {
    expect(t('events.title')).toBe('events.title');
    registerMessages({ 'events.title': 'Events' });
    expect(t('events.title')).toBe('Events');
  });
});
