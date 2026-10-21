import { useMemo } from 'react';
import { useGetPermissionsQuery } from '../features/permissions/permissionsApi';

/**
 * Permission codes of the current member in the organization (the same data
 * the sidebar uses). The server enforces permissions; this only decides
 * which actions the UI offers.
 */
export const usePermissionCodes = (organizationId: number) => {
  const { data: permissions, isLoading } = useGetPermissionsQuery(
    { organizationId },
    { skip: !organizationId }
  );

  const codes = useMemo(
    () => new Set((permissions ?? []).map((p) => p.code)),
    [permissions]
  );

  return { codes, has: (code: string) => codes.has(code), isLoading };
};
