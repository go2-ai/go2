export interface TranslatedField {
  [locale: string]: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  abbreviation: string;
  t: {
    name: TranslatedField;
    description: TranslatedField;
  };
}

export interface DepartmentFormData {
  name: TranslatedField;
  description: TranslatedField;
  abbreviation: string;
}
