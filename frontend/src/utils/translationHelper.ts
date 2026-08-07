// src/utils/translationHelper.ts

export type LocaleMap = Record<string, string>;

export interface TranslatedField {
  [locale: string]: string;
}

export function getOrganizationLocales(organization: {
  locale: string;
  active_locales: string[];
}): string[] {
  // Always include the primary locale
  const locales = [organization.locale];
  
  // Add active_locales (additional locales)
  if (organization.active_locales && organization.active_locales.length > 0) {
    locales.push(...organization.active_locales);
  }
  
  // Remove duplicates (in case primary is also in active_locales)
  return [...new Set(locales)];
}

export function getNonPrimaryLocales(
  organization: { locale: string; active_locales: string[] },
  primaryLocale: string
): string[] {
  return getOrganizationLocales(organization).filter(
    (locale) => locale !== primaryLocale
  );
}

export function emptyLocaleMap(locales: string[]): LocaleMap {
  return Object.fromEntries(locales.map((locale) => [locale, '']));
}

export function buildLocaleMap(
  translations: TranslatedField | undefined,
  locales: string[]
): LocaleMap {
  return Object.fromEntries(
    locales.map((locale) => [locale, translations?.[locale] ?? ''])
  );
}

export const flattenTranslations = <T extends object>(
  data: T,
  translatableFields: (keyof T)[]
): Record<string, string> => {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (translatableFields.includes(key as keyof T)) {
      const translations = value as TranslatedField;
      Object.entries(translations).forEach(([locale, localeValue]) => {
        if (locale && locale.trim()) {
          flattened[`${key}_${locale}`] = localeValue;
        }
      });
    } else {
      flattened[key] = value as string;
    }
  }

  return flattened;
};