export type LocaleMap = Record<string, string>;

export interface TranslatedField {
  [locale: string]: string;
}

export function getOrganizationLocales(organization: {
  locale: string;
  active_locales: string[];
}): string[] {
  return [...new Set([organization.locale, ...organization.active_locales])];
}

export function getNonPrimaryLocales(
  organization: { locale: string; active_locales: string[] },
  primaryLocale: string
): string[] {
  return getOrganizationLocales(organization).filter((locale) => locale !== primaryLocale);
}

/** Builds a locale map with empty strings for every requested locale. */
export function emptyLocaleMap(locales: string[]): LocaleMap {
  return Object.fromEntries(locales.map((locale) => [locale, '']));
}

/** Merges stored translations into a complete locale map for the given locales. */
export function buildLocaleMap(
  translations: TranslatedField | undefined,
  locales: string[]
): LocaleMap {
  return Object.fromEntries(
    locales.map((locale) => [locale, translations?.[locale] ?? ''])
  );
}

/**
 * Flattens translatable fields (e.g. { name: { en: "Legal", fa: "..." } })
 * into locale-suffixed keys (e.g. { name_en: "Legal", name_fa: "..." })
 * for APIs using the t_params pattern.
 */
export const flattenTranslations = <T extends object>(
  data: T,
  translatableFields: (keyof T)[]
): Record<string, string> => {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (translatableFields.includes(key as keyof T)) {
      const translations = value as TranslatedField;
      Object.entries(translations).forEach(([locale, localeValue]) => {
        flattened[`${key}_${locale}`] = localeValue;
      });
    } else {
      flattened[key] = value as string;
    }
  }

  return flattened;
};