import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import { useGetRolesQuery, useGetRoleQuery } from './rolesApi';
import { RolesTable } from './components/RolesTable';
import { RoleModal } from './components/RoleModal';
import type { Role } from './rolesApi';

export const RolesPage = () => {
  const { t: tRoles } = useTranslation('roles');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);

  const [showModal, setShowModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [preselectedParentId, setPreselectedParentId] = useState<number | null>(null);

  const { data: roles, isLoading, error, refetch } = useGetRolesQuery(
    orgId.toString(),
    { skip: !orgId || orgId === 0 }
  );

  const { data: selectedRole } = useGetRoleQuery(
    { organizationId: orgId.toString(), id: selectedRoleId! },
    { skip: selectedRoleId === null }
  );

  const handleRowClick = (role: Role) => {
    setSelectedRoleId(role.id);
    setPreselectedParentId(null);
    setShowModal(true);
  };

  // ✅ Define the handler
  const handleAddChildRole = (parentId: number) => {
    setSelectedRoleId(null);
    setPreselectedParentId(parentId);
    setShowModal(true);
  };

  const handleAddRole = () => {
    setSelectedRoleId(null);
    setPreselectedParentId(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRoleId(null);
    setPreselectedParentId(null);
  };

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100% - 130px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ my: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {tRoles('roles')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tRoles('manageRoles')}
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddRole}
        >
          {tRoles('addRole')}
        </Button>
      </Box>

      <RolesTable
        roles={roles}
        organizationId={orgId}
        onRowClick={handleRowClick}
        onAddChildRole={handleAddChildRole}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      <RoleModal
        open={showModal}
        onClose={handleCloseModal}
        organizationId={orgId}
        role={selectedRoleId ? selectedRole : null}
        preselectedParentId={preselectedParentId}
      />
    </Container>
  );
};