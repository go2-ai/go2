// frontend/src/features/members/components/MemberActionsMenu.tsx
import { Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { 
  useSendInvitationMutation,
  useUninviteMutation,
  useArchiveMemberMutation,
  useUnarchiveMemberMutation,
  useSetAsAdminMutation,
  useRevokeAdminMutation,
} from '../membersApi';
import type { Member } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../../components/tabs/useTabManager';

interface MemberActionsMenuProps {
  anchorEl: HTMLElement | null;
  member: Member | null;
  onClose: () => void;
  organizationId: number;
}

export const MemberActionsMenu = ({ 
  anchorEl, 
  member, 
  onClose, 
  organizationId 
}: MemberActionsMenuProps) => {
  const { t } = useTranslation('shared');
  const { t: tMembers } = useTranslation('members');
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const { organizationId: orgIdParam } = useParams<{ organizationId: string }>();
  
  const [sendInvitation] = useSendInvitationMutation();
  const [uninvite] = useUninviteMutation();
  const [archive] = useArchiveMemberMutation();
  const [unarchive] = useUnarchiveMemberMutation();
  const [setAsAdmin] = useSetAsAdminMutation();
  const [revokeAdmin] = useRevokeAdminMutation();
  const { openTab } = useTabManager();

  if (!member) return null;

  const handleSendInvitation = async () => {
    try {
      await sendInvitation({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('invitationSentSuccess'));
    } catch {
      showError(tMembers('invitationSentFailed'));
    }
    onClose();
  };

  const handleResendInvitation = async () => {
    try {
      await sendInvitation({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('invitationResentSuccess'));
    } catch {
      showError(tMembers('invitationResentFailed'));
    }
    onClose();
  };

  const handleUninvite = async () => {
    try {
      await uninvite({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('uninviteSuccess'));
    } catch {
      showError(tMembers('uninviteFailed'));
    }
    onClose();
  };

  const handleArchive = async () => {
    try {
      await archive({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('archiveSuccess'));
    } catch {
      showError(tMembers('archiveFailed'));
    }
    onClose();
  };

  const handleUnarchive = async () => {
    try {
      await unarchive({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('unarchiveSuccess'));
    } catch {
      showError(tMembers('unarchiveFailed'));
    }
    onClose();
  };

  const handleSetAsAdmin = async () => {
    try {
      await setAsAdmin({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('setAsAdminSuccess'));
    } catch {
      showError(tMembers('setAsAdminFailed'));
    }
    onClose();
  };

  const handleRevokeAdmin = async () => {
    try {
      await revokeAdmin({ organizationId, memberId: member.id }).unwrap();
      showSuccess(tMembers('revokeAdminSuccess'));
    } catch {
      showError(tMembers('revokeAdminFailed'));
    }
    onClose();
  };

  const handleHistory = () => {
    if (!member) return;
    const path = `/app/organizations/${organizationId}/record-history?type=Member&id=${member.id}`;
    const memberName = member.name;

    setTimeout(() => {
      openTab('record-history', `History: ${memberName}`, path);
      navigate(path);
    }, 0);
    onClose();
  };

  const actions = [
    {
      id: 'send-invitation',
      text: tMembers('sendInvitation'),
      visible: member.status === 'not_invited',
      onClick: handleSendInvitation,
    },
    {
      id: 'resend-invitation',
      text: tMembers('resendInvitation'),
      visible: member.status === 'invited',
      onClick: handleResendInvitation,
    },
    {
      id: 'uninvite',
      text: tMembers('uninvite'),
      visible: member.status === 'invited',
      onClick: handleUninvite,
    },
    {
      id: 'archive',
      text: t('commonActions.archive'),
      visible: member.status !== 'archived',
      onClick: handleArchive,
    },
    {
      id: 'unarchive',
      text: t('commonActions.unarchive'),
      visible: member.status === 'archived',
      onClick: handleUnarchive,
    },
    {
      id: 'set-as-admin',
      text: tMembers('setAsAdmin'),
      visible: member.org_admin === false,
      onClick: handleSetAsAdmin,
    },
    {
      id: 'revoke-admin',
      text: tMembers('revokeAdmin'),
      visible: member.org_admin === true,
      onClick: handleRevokeAdmin,
    },
    {
      id: 'history',
      text: t('changeLog'),
      visible: true,
      onClick: handleHistory,
    },
  ];

  const visibleActions = actions.filter(action => action.visible);

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} elevation={2}>
      {visibleActions.map((action) => (
        <MenuItem key={action.id} onClick={action.onClick}>
          {action.text}
        </MenuItem>
      ))}
    </Menu>
  );
};