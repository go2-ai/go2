import { locales } from '../../shared/constants/locales';

/** Name of a template language in its own language, e.g. 'fa' -> 'فارسی'. */
export const localeLabel = (code: string): string => {
  const known = locales.find((l) => l.code === code);
  if (known) return known.label;
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
};
