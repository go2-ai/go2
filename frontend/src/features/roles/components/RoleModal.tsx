import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useGetRolesQuery,
  type Role,
} from '../rolesApi';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import { useToast } from '../../../contexts/ToastContext';  // ← Add this
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../utils/translationHelper';
import { useGetDepartmentsQuery } from '../../departments/departmentsApi';
import { useGetMembersQuery } from '../../members/membersApi';
import type { Department } from '../../departments/types';
import type { Member } from '../../members/types';

interface RoleModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  role?: Role | null;
  preselectedParentId?: number | null;
}

interface RoleFormData {
  name: LocaleMap;
  description: LocaleMap;
  parent_id: number | null;
  department_id: number | null;
  member_id: number | null;
}

const EMPTY_FORM: RoleFormData = {
  name: {},
  description: {},
  parent_id: null,
  department_id: null,
  member_id: null,
};

export const RoleModal = ({
  open,
  onClose,
  organizationId,
  role,
  preselectedParentId = null,
}: RoleModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tRoles } = useTranslation('roles');
  const { showSuccess, showError } = useToast();

  const { primaryLocale, allLocales, isReady } = useTranslatableLocales({
    organizationId,
  });

  // Fetch departments, members, and roles for dropdowns
  const { data: departments } = useGetDepartmentsQuery(organizationId);
  const { data: members } = useGetMembersQuery(organizationId);
  const { data: allRoles } = useGetRolesQuery(organizationId.toString());

  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();

  const isLoading = isCreating || isUpdating;

  const [formData, setFormData] = useState<RoleFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Populate form when editing or preselected parent
  useEffect(() => {
    if (!open || !isReady) return;

    if (role) {
      setFormData({
        name: buildLocaleMap(role.t?.name, allLocales),
        description: buildLocaleMap(role.t?.description, allLocales),
        parent_id: role.parent_id ?? null,
        department_id: role.department?.id ?? null,
        member_id: role.member?.id ?? null,
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        name: emptyLocaleMap(allLocales),
        description: emptyLocaleMap(allLocales),
        parent_id: preselectedParentId,
        department_id: null,
        member_id: null,
      });
    }
    setErrors({});
  }, [role, open, isReady, allLocales.join(','), preselectedParentId]);

  const validate = (): boolean => {
    const next: { name?: string } = {};

    if (!formData.name[primaryLocale]?.trim()) {
      next.name = t('validations.required');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleDescriptionChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, description: val }));
  };

  // Helper to extract error message from API response
  const getErrorMessage = (error: any): string => {
    if (error?.data?.errors && Array.isArray(error.data.errors)) {
      return error.data.errors.join(', ');
    }
    if (error?.data?.errors) {
      return error.data.errors;
    }
    if (error?.data?.error) {
      return error.data.error;
    }
    if (error?.message) {
      return error.message;
    }
    return tRoles('saveFailed');
  };

  const buildPayload = () => {
    const payload = {
      ...flattenTranslations({ name: formData.name, description: formData.description }, ['name', 'description']),
      parent_id: formData.parent_id,
      department_id: formData.department_id,
      member_id: formData.member_id,
      active: true,
    };

    return Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined)
    );
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = buildPayload();

    try {
      if (role) {
        await updateRole({
          organizationId: organizationId.toString(),
          id: role.id,
          data: payload,
        }).unwrap();
        showSuccess(tRoles('updateSuccess'));  // ← Show success toast
      } else {
        await createRole({
          organizationId: organizationId.toString(),
          data: payload,
        }).unwrap();
        showSuccess(tRoles('createSuccess'));  // ← Show success toast
      }
      onClose();
    } catch (error: any) {
      console.error('Failed to save role:', error);
      const errorMessage = getErrorMessage(error);
      showError(errorMessage);  // ← Show error toast
    }
  };

  const isEditMode = !!role;

  // Get parent role options (exclude current role if editing)
  const parentRoleOptions = useMemo(() => {
    if (!allRoles) return [];
    return allRoles.filter((r) => !isEditMode || r.id !== role?.id);
  }, [allRoles, isEditMode, role]);

  // Find the selected objects for Autocomplete
  const selectedParent = useMemo(() => {
    if (!allRoles || !formData.parent_id) return null;
    return allRoles.find((r) => r.id === formData.parent_id) || null;
  }, [allRoles, formData.parent_id]);

  const selectedDepartment = useMemo(() => {
    if (!departments || !formData.department_id) return null;
    return departments.find((d) => d.id === formData.department_id) || null;
  }, [departments, formData.department_id]);

  const selectedMember = useMemo(() => {
    if (!members || !formData.member_id) return null;
    return members.find((m) => m.id === formData.member_id) || null;
  }, [members, formData.member_id]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? tRoles('editRole') : tRoles('addRole')}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            error={!!errors.name}
            helperText={errors.name}
            required
          />

          <MultiLocaleInput
            field={t('description')}
            value={formData.description}
            onChange={handleDescriptionChange}
          />

          {/* Searchable Department dropdown */}
          <Autocomplete
            options={departments || []}
            getOptionLabel={(option) => option.name}
            value={selectedDepartment}
            onChange={(_, newValue) => {
              setFormData((prev) => ({
                ...prev,
                department_id: newValue?.id ?? null,
              }));
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={tRoles('department')}
                size="small"
                placeholder={tRoles('searchDepartment')}
              />
            )}
            fullWidth
          />

          {/* Searchable Parent Role dropdown */}
          <Autocomplete
            options={parentRoleOptions}
            getOptionLabel={(option) => option.name}
            value={selectedParent}
            onChange={(_, newValue) => {
              setFormData((prev) => ({
                ...prev,
                parent_id: newValue?.id ?? null,
              }));
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={tRoles('parentRole')}
                size="small"
                placeholder={tRoles('searchParentRole')}
              />
            )}
            disabled={!!preselectedParentId && !isEditMode}
            fullWidth
          />

          {/* Searchable Member dropdown */}
          <Autocomplete
            options={members || []}
            getOptionLabel={(option) => `${option.name} (${option.email})`}
            value={selectedMember}
            onChange={(_, newValue) => {
              setFormData((prev) => ({
                ...prev,
                member_id: newValue?.id ?? null,
              }));
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={tRoles('assignedMember')}
                size="small"
                placeholder={tRoles('searchMember')}
              />
            )}
            fullWidth
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};