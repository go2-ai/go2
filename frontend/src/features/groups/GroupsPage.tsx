// frontend/src/features/groups/GroupsPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import { useGetGroupsQuery, useGetGroupQuery } from './groupsApi';
import { GroupsTable } from './components/GroupsTable';
import { GroupModal } from './components/GroupModal';
import type { Group } from './groupsApi';

export const GroupsPage = () => {
  const { t: tGroups } = useTranslation('groups');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);

  const [showModal, setShowModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const { data: groups, isLoading, error, refetch } = useGetGroupsQuery(
    orgId,
    { skip: !orgId || orgId === 0 }
  );

  const { data: selectedGroup } = useGetGroupQuery(
    { organizationId: orgId, id: selectedGroupId! },
    { skip: selectedGroupId === null }
  );

  const handleRowClick = (group: Group) => {
    setSelectedGroupId(group.id);
    setShowModal(true);
  };

  const handleAddGroup = () => {
    setSelectedGroupId(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedGroupId(null);
  };

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: 2 }}>
      <Box sx={{ my: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {tGroups('groups')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tGroups('manageGroups')}
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddGroup}
        >
          {tGroups('addGroup')}
        </Button>
      </Box>

      <GroupsTable
        groups={groups}
        organizationId={orgId}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      <GroupModal
        open={showModal}
        onClose={handleCloseModal}
        organizationId={orgId}
        group={selectedGroupId ? selectedGroup : null}
      />
    </Container>
  );
};