// frontend/src/features/versions/types.ts
export interface VersionChange {
  field: string;
  from: any;
  to: any;
  field_label: string;
}

export interface Version {
  id: number;
  event: 'create' | 'update' | 'destroy';
  created_at: string;
  item_type: string;
  item_id: number;
  whodunnit: string;
  user_display: string;
  record_display_name: string;
  changes: VersionChange[];
  user_avatar?: string;
  user_initial?: string;
  user_color?: string;
  object_data?: any;
}