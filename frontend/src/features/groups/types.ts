// frontend/src/features/groups/types.ts
export interface TranslatedField {
  [locale: string]: string;
}

export interface GroupFormData {
  name: TranslatedField;
  description: TranslatedField;
  member_ids: number[];
}