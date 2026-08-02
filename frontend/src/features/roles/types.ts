// frontend/src/features/roles/types.ts
export interface TranslatedField {
  [locale: string]: string;
}

export interface RoleFormData {
  name: TranslatedField;
  description: TranslatedField;
  parent_id: number | null;
  department_id: number | null;
  member_id: number | null;
  active: boolean;
}