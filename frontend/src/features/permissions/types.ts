// src/features/permissions/types.ts

// ─── API Response Types ─────────────────────────────────────────────────────

export interface GrantablePermission {
  code: string;
  name: string;
  abilities: string[];
  tags: string[];
}

export type GranteeType = 'Member' | 'Role' | 'Department' | 'Group';

export interface Permission {
  id: number;
  code: string;
  grantee_type: GranteeType;
  grantee_id: number;
  grantee_name: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

// ─── Request Types ──────────────────────────────────────────────────────────

export interface GrantPermissionRequest {
  code: string;
  grantee_type: GranteeType;
  grantee_id: number;
}

// ─── UI / Component Types ──────────────────────────────────────────────────

export interface PermissionWithGrantees {
  permission: GrantablePermission;
  grantees: Permission[]; // All Permission entries for this code
  resolvedMembers: ResolvedMember[];
}

export interface ResolvedMember {
  id: number;
  name: string;
  email: string;
  initial: string;
  color: string;
  status: 'not_invited' | 'invited' | 'joined' | 'archived';
  userId: number | null;
  isUserless: boolean;
  sources: PermissionSource[];
}

export interface PermissionSource {
  grantee_type: GranteeType;
  grantee_id: number;
  grantee_name: string;
  permission_id: number;
}

// ─── Member View Types ─────────────────────────────────────────────────────

export interface MemberPermissions {
  memberId: number;
  memberName: string;
  directPermissions: Permission[];
  indirectPermissions: IndirectPermission[];
}

export interface IndirectPermission {
  permission: Permission;
  source_type: GranteeType;
  source_id: number;
  source_name: string;
}

// ─── Component Props ──────────────────────────────────────────────────────

export interface PermissionsTableProps {
  permissions?: Permission[];
  organizationId: number;
  onRowClick: (permission: Permission) => void;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

export interface PermissionModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  permission?: Permission | null;
}

export interface GrantablePermissionsListProps {
  grantablePermissions?: GrantablePermission[];
  selectedCode?: string;
  onSelect: (code: string) => void;
  isLoading?: boolean;
}

export interface GranteeManagementProps {
  permissionCode: string;
  organizationId: number;
  grantees: Permission[];
  resolvedMembers: ResolvedMember[];
  onGranteeAdded: () => void;
  onGranteeRemoved: () => void;
}

export interface MemberPermissionsViewProps {
  memberId: number;
  organizationId: number;
  onClose: () => void;
}