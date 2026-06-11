export interface TranslatedField {
  [locale: string]: string;
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