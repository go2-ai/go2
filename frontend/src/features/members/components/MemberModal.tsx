import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useSendInvitationMutation,
} from '../membersApi';
import type { Member, MemberStatus, MemberPayload } from '../types';
import ColorPicker from '../../../components/ColorPicker';
import { isValidEmail } from '../../../utils/validators';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../utils/translationHelper';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberFormData {
  email: string;
  name: LocaleMap;
  initial: string;
  color: string;
}

interface MemberModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  member?: Member | null;
  status?: MemberStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const EMPTY_FORM: MemberFormData = {
  email: '',
  name: {},
  initial: '',
  color: '#4F46E5',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const MemberModal = ({
  open,
  onClose,
  organizationId,
  member,
  status,
}: MemberModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tMembers } = useTranslation('members');
  const { primaryLocale, allLocales, isReady } = useTranslatableLocales({
    organizationId,
  });

  const [createMember, { isLoading: isCreating }] = useCreateMemberMutation();
  const [updateMember, { isLoading: isUpdating }] = useUpdateMemberMutation();
  const [sendInvitation, { isLoading: isSending }] = useSendInvitationMutation();

  const isLoading = isCreating || isUpdating || isSending;

  const [formData, setFormData] = useState<MemberFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
  // ── Populate form on open ────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !isReady) return;

    if (member) {
      setFormData({
        email: member.email,
        name: buildLocaleMap(member.t?.name, allLocales),
        initial: member.initial,
        color: member.color || '#4F46E5',
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        name: emptyLocaleMap(allLocales),
      });
    }

    setErrors({});
  }, [member, open, isReady, allLocales.join(',')]);

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = (requireEmail = false): boolean => {
    const next: typeof errors = {};

    if (!formData.name[primaryLocale]?.trim()) {
      next.name = t('validations.required');
    }

    if (requireEmail && !formData.email) {
      next.email = t('validations.required');
    } else if (formData.email && !isValidEmail(formData.email)) {
      next.email = t('validations.invalidFormat');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Field handlers ───────────────────────────────────────────────────────

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleNameBlur = () => {
    if (!formData.initial && formData.name[primaryLocale]) {
      setFormData((prev) => ({
        ...prev,
        initial: generateInitials(prev.name[primaryLocale]),
      }));
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // ── API calls ────────────────────────────────────────────────────────────

  const buildUpdatePayload = (): MemberPayload => ({
    ...flattenTranslations({ name: formData.name }, ['name']),
    initial: formData.initial,
    color: formData.color,
  });

  const buildCreatePayload = (invite: boolean): MemberPayload => ({
    ...flattenTranslations(formData, ['name']),
    invite,
  });

  const handleSaveOnly = async () => {
    if (!validate(false)) return;

    try {
      if (member) {
        await updateMember({
          organizationId,
          memberId: member.id,
          data: buildUpdatePayload(),
        }).unwrap();
      } else {
        await createMember({
          organizationId,
          data: buildCreatePayload(false),
        }).unwrap();
      }
      onClose();
    } catch (error) {
      console.error('Failed to save member:', error);
    }
  };

  const handleSaveAndInvite = async () => {
    if (!validate(true)) return;

    try {
      if (member) {
        await updateMember({
          organizationId,
          memberId: member.id,
          data: buildUpdatePayload(),
        }).unwrap();
        await sendInvitation({ organizationId, memberId: member.id }).unwrap();
      } else {
        await createMember({
          organizationId,
          data: buildCreatePayload(true),
        }).unwrap();
      }
      onClose();
    } catch (error) {
      console.error('Failed to save and invite member:', error);
    }
  };

  // ── Derived UI state ─────────────────────────────────────────────────────

  const isEditMode = !!member;
  const canSendInvitation = status === 'invited' || status === 'not_invited';
  const showInviteButton = !isEditMode || canSendInvitation;

  const inviteButtonText = !isEditMode
    ? tMembers('createAndSendInvitation')
    : status === 'invited'
    ? tMembers('updateAndResendInvitation')
    : tMembers('updateAndSendInvitation');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? tMembers('editMember') : tMembers('addMember')}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 1 }}>
          <MultiLocaleInput
            field={t("name")}
            value={formData.name}
            onChange={handleNameChange}
            error={!!errors.name}
            helperText={errors.name ?? tMembers('fullName')}
            required
          />

          <TextField
            label={tMembers('initials')}
            name="initial"
            value={formData.initial}
            onChange={handleFieldChange}
            onBlur={handleNameBlur}
            helperText={tMembers("max2Chars")}
            fullWidth
            inputProps={{ maxLength: 2 }}
            size="small"
          />

          <TextField
            label={t('email')}
            name="email"
            type="email"
            value={formData.email}
            onChange={handleFieldChange}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            disabled={isEditMode && status === 'joined'}
            size="small"
          />

          <Box>
            <ColorPicker
              value={formData.color}
              onChange={(newColor) =>
                setFormData((prev) => ({ ...prev, color: newColor }))
              }
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>

        <Button
          onClick={handleSaveOnly}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>

        {showInviteButton && (
          <Button
            onClick={handleSaveAndInvite}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {inviteButtonText}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};