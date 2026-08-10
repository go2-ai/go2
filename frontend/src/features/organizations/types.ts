export interface TranslatedField {
  [locale: string]: string;
}

export interface Organization {
  id: number;
  name: string;
  locale: string;
  active_locales: string[];
  parent_id: number | null;
  t: {
      name: TranslatedField;
  };
}