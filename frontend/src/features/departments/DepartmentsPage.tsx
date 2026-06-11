import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useGetDepartmentsQuery } from './departmentsApi';
import { DepartmentsTable } from './components/DepartmentsTable';
import { DepartmentModal } from './components/DepartmentModal';
import { useState } from 'react';
import type { Department } from './types';

export const DepartmentsPage = () => {
  const { t: tDepartments } = useTranslation('departments');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);

  const [showModal, setShowModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  const { data: departments, isLoading, error, refetch } = useGetDepartmentsQuery(
    orgId, 
    { skip: !orgId || orgId === 0 }
  );

  const handleRowClick = (department: Department) => {
    setSelectedDepartment(department);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDepartment(null);
  };

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100% - 170px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {tDepartments('departments')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tDepartments('manageYourTeam')}
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setShowModal(true)}
        >
          {tDepartments('addDepartment')}
        </Button>
      </Box>

      <DepartmentsTable 
        departments={departments}
        organizationId={orgId}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      <DepartmentModal
        open={showModal}
        onClose={handleCloseModal}
        organizationId={orgId}
        department={selectedDepartment}
      />
    </Container>
  );
};