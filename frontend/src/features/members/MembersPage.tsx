import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useGetMembersQuery, useGetMemberQuery } from './membersApi';
import { MembersTable } from './components/MembersTable';
import { MemberModal } from './components/MemberModal';
import type { Member } from './types';

export const MembersPage = () => {
  const { t: tMembers } = useTranslation('members');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);

  const [showModal, setShowModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const { data: members, isLoading, error, refetch } = useGetMembersQuery(
    orgId,
    { skip: !orgId || orgId === 0 }
  );

  const { data: selectedMember } = useGetMemberQuery(
    { organizationId: orgId, memberId: selectedMemberId! },
    { skip: selectedMemberId === null }
  );

  const handleRowClick = (member: Member) => {
    setSelectedMemberId(member.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedMemberId(null);
  };

  const memberStatus = selectedMember
    ? selectedMember.joined_at ? 'joined'
    : selectedMember.invited_at ? 'invited'
    : 'not_invited'
    : undefined;

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100% - 130px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ my: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {tMembers('members')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tMembers('manageYourTeam')}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setShowModal(true)}
        >
          {tMembers('addMember')}
        </Button>
      </Box>

      <MembersTable
        members={members}
        organizationId={orgId}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      <MemberModal
        open={showModal}
        onClose={handleCloseModal}
        organizationId={orgId}
        member={selectedMemberId ? selectedMember : null}
        status={memberStatus}
      />
    </Container>
  );
};