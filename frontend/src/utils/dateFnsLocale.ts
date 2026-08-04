// frontend/src/utils/dateFnsLocale.ts
import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { locales } from '../shared/constants/locales';

/**
 * Get the date-fns locale for a given language code
 * Uses the dateFnsLocale property from the locales config
 * @param language - The language code (e.g., 'en', 'fa')
 * @returns The date-fns locale object, or enUS as fallback
 */
export const getDateFnsLocale = (language: string): Locale => {
  // Find the locale in our config
  const localeConfig = locales.find(loc => loc.code === language);
  
  if (localeConfig?.dateFnsLocale) {
    return localeConfig.dateFnsLocale;
  }
  
  // Check for base language match (e.g., 'en-US' -> 'en')
  const baseLanguage = language.split('-')[0];
  const baseLocaleConfig = locales.find(loc => loc.code === baseLanguage);
  
  if (baseLocaleConfig?.dateFnsLocale) {
    return baseLocaleConfig.dateFnsLocale;
  }
  
  // Fallback to English
  return enUS;
};

/**
 * Check if date-fns locale is available for a given language
 */
export const isDateFnsLocaleAvailable = (language: string): boolean => {
  const localeConfig = locales.find(loc => loc.code === language);
  return !!localeConfig?.dateFnsLocale;
};

/**
 * Get all locale codes that have date-fns support
 */
export const getSupportedDateFnsLocales = (): string[] => {
  return locales
    .filter(loc => loc.dateFnsLocale !== undefined)
    .map(loc => loc.code);
};