// frontend/src/features/groups/components/GroupModal.tsx
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
  Chip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  useCreateGroupMutation,
  useUpdateGroupMutation,
  type Group,
} from '../groupsApi';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import { useToast } from '../../../contexts/ToastContext';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../utils/translationHelper';
import { useGetMembersQuery } from '../../members/membersApi';

interface GroupModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  group?: Group | null;
}

interface GroupFormData {
  name: LocaleMap;
  description: LocaleMap;
  member_ids: number[];
}

const EMPTY_FORM: GroupFormData = {
  name: {},
  description: {},
  member_ids: [],
};

export const GroupModal = ({ open, onClose, organizationId, group }: GroupModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tGroups } = useTranslation('groups');
  const { showSuccess, showError } = useToast();

  const { primaryLocale, allLocales, isReady } = useTranslatableLocales({
    organizationId,
  });

  // Fetch members for the multi-select
  const { data: members } = useGetMembersQuery(organizationId);

  const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();
  const [updateGroup, { isLoading: isUpdating }] = useUpdateGroupMutation();

  const isLoading = isCreating || isUpdating;

  const [formData, setFormData] = useState<GroupFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Populate form when editing
  useEffect(() => {
    if (!open || !isReady) return;

    if (group) {
      setFormData({
        name: buildLocaleMap(group.t?.name, allLocales),
        description: buildLocaleMap(group.t?.description, allLocales),
        member_ids: group.members.map((m) => m.id),
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        name: emptyLocaleMap(allLocales),
        description: emptyLocaleMap(allLocales),
        member_ids: [],
      });
    }
    setErrors({});
  }, [group, open, isReady, allLocales.join(',')]);

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
    return tGroups('saveFailed');
  };

  const buildPayload = () => {
    const payload = {
      ...flattenTranslations({ name: formData.name, description: formData.description }, ['name', 'description']),
      member_ids: formData.member_ids,
    };

    return Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined && value !== null)
    );
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = buildPayload();

    try {
      if (group) {
        await updateGroup({
          organizationId,
          id: group.id,
          data: payload,
        }).unwrap();
        showSuccess(tGroups('updateSuccess'));
      } else {
        await createGroup({
          organizationId,
          data: payload,
        }).unwrap();
        showSuccess(tGroups('createSuccess'));
      }
      onClose();
    } catch (error: any) {
      console.error('Failed to save group:', error);
      const errorMessage = getErrorMessage(error);
      showError(errorMessage);
    }
  };

  const isEditMode = !!group;

  // Get selected members for the Autocomplete
  const selectedMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => formData.member_ids.includes(m.id));
  }, [members, formData.member_ids]);

  // ✅ Check if all members are selected
  const allSelected = useMemo(() => {
    if (!members || members.length === 0) return false;
    return members.every((m) => formData.member_ids.includes(m.id));
  }, [members, formData.member_ids]);

  // ✅ Handle select all / deselect all
  const handleSelectAll = () => {
    if (!members) return;
    if (allSelected) {
      // Deselect all
      setFormData((prev) => ({
        ...prev,
        member_ids: [],
      }));
    } else {
      // Select all
      setFormData((prev) => ({
        ...prev,
        member_ids: members.map((m) => m.id),
      }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? tGroups('editGroup') : tGroups('addGroup')}
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

          {/* Member multi-select with Select All */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {tGroups('members')}
              </Typography>
              {members && members.length > 0 && (
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  {allSelected ? tGroups('deselectAll') : tGroups('selectAll')}
                </Button>
              )}
            </Box>
            <Autocomplete
              multiple
              options={members || []}
              getOptionLabel={(option) => {
                return option.name || '';
              }}
              value={selectedMembers}
              onChange={(_, newValue) => {
                setFormData((prev) => ({
                  ...prev,
                  member_ids: newValue.map((m) => m.id),
                }));
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                const hasEmail = option.email && option.email.trim() !== '';
                return (
                  <li key={key} {...optionProps}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography component="span">{option.name}</Typography>
                      {hasEmail && (
                        <Typography
                          component="span"
                          sx={{ opacity: 0.7, fontSize: '0.875rem' }}
                        >
                          {option.email}
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={tGroups('searchMembers')}
                  size="small"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={option.id}
                      label={option.name}
                      size="small"
                      {...tagProps}
                    />
                  );
                })
              }
              fullWidth
            />
          </Box>
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