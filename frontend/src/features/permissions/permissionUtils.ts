// src/features/permissions/permissionUtils.ts

import type { Member } from '../members/types';
import type { Role } from '../roles/rolesApi';
import type { Group } from '../groups/groupsApi';
import type { Department } from '../departments/types';
import type { Permission, GranteeType, ResolvedMember, PermissionSource } from './types';

// ─── Type Guards ────────────────────────────────────────────────────────────

function isMember(grantee: any): grantee is Member {
  return grantee && 'id' in grantee && 'email' in grantee && 'name' in grantee;
}

function isRole(grantee: any): grantee is Role {
  return grantee && 'id' in grantee && 'name' in grantee && 'member' in grantee;
}

function isDepartment(grantee: any): grantee is Department {
  return grantee && 'id' in grantee && 'name' in grantee;
}

function isGroup(grantee: any): grantee is Group {
  return grantee && 'id' in grantee && 'name' in grantee && 'members' in grantee;
}

// ─── Member Resolution Functions ──────────────────────────────────────────

/**
 * Resolve members from a Member grantee (direct permission)
 */
function resolveDirectMember(
  member: Member,
  permissionId: number,
  code: string
): ResolvedMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    initial: member.initial || member.name.charAt(0).toUpperCase(),
    color: member.color || '#4F46E5',
    status: member.status as 'not_invited' | 'invited' | 'joined' | 'archived',
    userId: member.user_id,
    isUserless: member.user_id === null,
    sources: [
      {
        grantee_type: 'Member',
        grantee_id: member.id,
        grantee_name: member.name,
        permission_id: permissionId,
      },
    ],
  };
}

/**
 * Resolve members from a Role grantee (indirect permission via role)
 */
function resolveRoleMembers(
  role: Role,
  permissionId: number,
  code: string
): ResolvedMember[] {
  if (!role.member) {
    return [];
  }

  const member = role.member;
  return [
    {
      id: member.id,
      name: member.name,
      email: (member as any).email || '',
      initial: (member as any).initial || member.name.charAt(0).toUpperCase(),
      color: (member as any).color || '#4F46E5',
      status: (member as any).status || 'not_invited',
      userId: (member as any).user_id || null,
      isUserless: (member as any).user_id === null || !(member as any).email,
      sources: [
        {
          grantee_type: 'Role',
          grantee_id: role.id,
          grantee_name: role.name,
          permission_id: permissionId,
        },
      ],
    },
  ];
}

/**
 * Resolve members from a Department grantee (indirect permission via department)
 * Members who have any role in this department get the permission
 */
function resolveDepartmentMembers(
  department: Department,
  roles: Role[],
  permissionId: number,
  code: string
): ResolvedMember[] {
  // Find all roles in this department that have a member assigned
  const departmentRoles = roles.filter(
    (role) => role.department?.id === department.id && role.member
  );

  // Deduplicate members (a member might have multiple roles in the same department)
  const memberMap = new Map<number, ResolvedMember>();

  departmentRoles.forEach((role) => {
    if (!role.member) return;

    const member = role.member;
    const existing = memberMap.get(member.id);

    if (existing) {
      // Add this role as an additional source
      existing.sources.push({
        grantee_type: 'Department',
        grantee_id: department.id,
        grantee_name: department.name,
        permission_id: permissionId,
      });
    } else {
      memberMap.set(member.id, {
        id: member.id,
        name: member.name,
        email: (member as any).email || '',
        initial: (member as any).initial || member.name.charAt(0).toUpperCase(),
        color: (member as any).color || '#4F46E5',
        status: (member as any).status || 'not_invited',
        userId: (member as any).user_id || null,
        isUserless: (member as any).user_id === null || !(member as any).email,
        sources: [
          {
            grantee_type: 'Department',
            grantee_id: department.id,
            grantee_name: department.name,
            permission_id: permissionId,
          },
        ],
      });
    }
  });

  return Array.from(memberMap.values());
}

/**
 * Resolve members from a Group grantee (indirect permission via group)
 */
function resolveGroupMembers(
  group: Group,
  permissionId: number,
  code: string
): ResolvedMember[] {
  if (!group.members || group.members.length === 0) {
    return [];
  }

  return group.members.map((member) => ({
    id: member.id,
    name: member.name,
    email: (member as any).email || '',
    initial: (member as any).initial || member.name.charAt(0).toUpperCase(),
    color: (member as any).color || '#4F46E5',
    status: (member as any).status || 'not_invited',
    userId: (member as any).user_id || null,
    isUserless: (member as any).user_id === null || !(member as any).email,
    sources: [
      {
        grantee_type: 'Group',
        grantee_id: group.id,
        grantee_name: group.name,
        permission_id: permissionId,
      },
    ],
  }));
}

// ─── Main Resolution Function ─────────────────────────────────────────────

export interface ResolveMembersParams {
  permissionCode: string;
  permissions: Permission[];
  members: Member[];
  roles: Role[];
  departments: Department[];
  groups: Group[];
}

/**
 * Resolve all members who have a specific permission code,
 * including indirect permissions through roles, departments, and groups.
 * Each member's sources array tracks all grantee entities that give them this permission.
 */
export function resolveMembersForPermission({
  permissionCode,
  permissions,
  members,
  roles,
  departments,
  groups,
}: ResolveMembersParams): ResolvedMember[] {
  // Filter permissions for this code
  const codePermissions = permissions.filter((p) => p.code === permissionCode);

  if (codePermissions.length === 0) {
    return [];
  }

  const memberMap = new Map<number, ResolvedMember>();

  codePermissions.forEach((perm) => {
    const { grantee_type, grantee_id, id: permissionId } = perm;

    switch (grantee_type) {
      case 'Member': {
        const member = members.find((m) => m.id === grantee_id);
        if (member) {
          const resolved = resolveDirectMember(member, permissionId, permissionCode);
          const existing = memberMap.get(member.id);
          if (existing) {
            existing.sources.push(...resolved.sources);
          } else {
            memberMap.set(member.id, resolved);
          }
        }
        break;
      }

      case 'Role': {
        const role = roles.find((r) => r.id === grantee_id);
        if (role) {
          const resolved = resolveRoleMembers(role, permissionId, permissionCode);
          resolved.forEach((resolvedMember) => {
            const existing = memberMap.get(resolvedMember.id);
            if (existing) {
              existing.sources.push(...resolvedMember.sources);
            } else {
              memberMap.set(resolvedMember.id, resolvedMember);
            }
          });
        }
        break;
      }

      case 'Department': {
        const department = departments.find((d) => d.id === grantee_id);
        if (department) {
          const resolved = resolveDepartmentMembers(
            department,
            roles,
            permissionId,
            permissionCode
          );
          resolved.forEach((resolvedMember) => {
            const existing = memberMap.get(resolvedMember.id);
            if (existing) {
              existing.sources.push(...resolvedMember.sources);
            } else {
              memberMap.set(resolvedMember.id, resolvedMember);
            }
          });
        }
        break;
      }

      case 'Group': {
        const group = groups.find((g) => g.id === grantee_id);
        if (group) {
          const resolved = resolveGroupMembers(group, permissionId, permissionCode);
          resolved.forEach((resolvedMember) => {
            const existing = memberMap.get(resolvedMember.id);
            if (existing) {
              existing.sources.push(...resolvedMember.sources);
            } else {
              memberMap.set(resolvedMember.id, resolvedMember);
            }
          });
        }
        break;
      }
    }
  });

  return Array.from(memberMap.values());
}

// ─── Member Permission Lookup ─────────────────────────────────────────────

export interface GetMemberPermissionsParams {
  memberId: number;
  allPermissions: Permission[];
  roles: Role[];
  groups: Group[];
  departments: Department[];
}

export function getMemberPermissions({
  memberId,
  allPermissions,
  roles,
  groups,
  departments,
}: GetMemberPermissionsParams): {
  direct: Permission[];
  indirect: {
    permission: Permission;
    source_type: GranteeType;
    source_id: number;
    source_name: string;
  }[];
} {
  const direct: Permission[] = [];
  const indirect: {
    permission: Permission;
    source_type: GranteeType;
    source_id: number;
    source_name: string;
  }[] = [];

  allPermissions.forEach((perm) => {
    switch (perm.grantee_type) {
      case 'Member':
        if (perm.grantee_id === memberId) {
          direct.push(perm);
        }
        break;

      case 'Role': {
        const role = roles.find((r) => r.id === perm.grantee_id);
        if (role && role.member && role.member.id === memberId) {
          indirect.push({
            permission: perm,
            source_type: 'Role',
            source_id: role.id,
            source_name: role.name,
          });
        }
        break;
      }

      case 'Department': {
        const dept = departments.find((d) => d.id === perm.grantee_id);
        if (dept) {
          const hasRoleInDept = roles.some(
            (r) => r.department?.id === dept.id && r.member && r.member.id === memberId
          );
          if (hasRoleInDept) {
            indirect.push({
              permission: perm,
              source_type: 'Department',
              source_id: dept.id,
              source_name: dept.name,
            });
          }
        }
        break;
      }

      case 'Group': {
        const group = groups.find((g) => g.id === perm.grantee_id);
        if (group && group.members.some((m) => m.id === memberId)) {
          indirect.push({
            permission: perm,
            source_type: 'Group',
            source_id: group.id,
            source_name: group.name,
          });
        }
        break;
      }
    }
  });

  return { direct, indirect };
}