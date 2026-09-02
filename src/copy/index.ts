import { createContext, useContext } from 'react';
import { id, type CopyKey } from './id';
import { en } from './en';

export type Locale = 'id' | 'en';
export const LOCALES: Locale[] = ['id', 'en'];

const DICTS: Record<Locale, Record<CopyKey, string>> = { id, en };

export type Translate = (key: CopyKey, vars?: Record<string, string | number>) => string;

export function translator(locale: Locale): Translate {
  const dict = DICTS[locale];
  return (key, vars) => {
    let text = dict[key] ?? id[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

export const LocaleContext = createContext<{ locale: Locale; t: Translate }>({
  locale: 'id',
  t: translator('id'),
});

export function useCopy() {
  return useContext(LocaleContext);
}

export type { CopyKey };
