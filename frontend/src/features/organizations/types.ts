export interface TranslatedField {
  [locale: string]: string;
}

export interface Organization {
  id: number;
  name: string;
  locale: string;
  active_locales: string[];
  parent_id: number | null;
  calendar_types: string[];
  max_file_size: number;
  total_file_size: number;
  max_total_file_size: number;
  t: {
      name: TranslatedField;
  };
}