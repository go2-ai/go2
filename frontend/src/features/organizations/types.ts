export interface TranslatedField {
  [locale: string]: string;
}

export interface Organization {
  id: number;
  name: string;
  locale: string;
  active_locales: string[];
  t: {
      name: TranslatedField;
  };
}