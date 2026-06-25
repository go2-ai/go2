import { useState, useMemo } from 'react';
import { 
  Paper, 
  Box, 
  TextField, 
  InputAdornment, 
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import type { Department } from '../types';
import { useDeleteDepartmentMutation } from '../departmentsApi';
import { useConfirm } from '../../../contexts/confirmContext';
import { useToast } from '../../../contexts/ToastContext';

import SearchIcon from '@mui/icons-material/Search';

interface DepartmentsTableProps {
  departments?: Department[];
  organizationId: number;
  onRowClick: (department: Department) => void;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

export const DepartmentsTable = ({ 
  departments,
  organizationId,
  onRowClick,
  isLoading,
  error,
  onRetry
}: DepartmentsTableProps) => {
  const { t } = useTranslation('shared');
  const { t: tDepartments } = useTranslation('departments');
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();
  const confirm = useConfirm();
  const { showSuccess } = useToast();

  const handleDelete = async (e: React.MouseEvent, department: Department) => {
    e.stopPropagation();

    const confirmed = await confirm({
      title: tDepartments('deleteDepartmentTitle'),
      message: tDepartments('deleteDepartmentMessage', { name: department.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      await deleteDepartment({ organizationId, departmentId: department.id }).unwrap();
      showSuccess(tDepartments('deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  const filteredRows = useMemo(() => {
    if (!globalSearch.trim() || !departments) return departments || [];
    
    const searchTerm = globalSearch.toLowerCase();
    return departments.filter(department => 
      (department.name || '').toLowerCase().includes(searchTerm) ||
      (department.description || '').toLowerCase().includes(searchTerm) ||
      (department.abbreviation || '').toLowerCase().includes(searchTerm)
    );
  }, [departments, globalSearch]);

  const columns: GridColDef<Department>[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 250,
    },
    {
      field: 'abbreviation',
      headerName: t('abbreviation'),
      width: 150,
    },
    {
      field: 'description',
      headerName: t('description'),
      width: 400,
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Button
          aria-label={tDepartments('deleteDepartment')}
          size="small"
          disabled={isDeleting}
          onClick={(e) => handleDelete(e, params.row)}
          color="warning"
          variant="outlined"
        >
          { t('commonActions.delete') }
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Paper sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ ms: 2 }}>{tDepartments('loadingDepartments')}</Typography>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            onRetry && (
              <Button color="inherit" size="small" onClick={onRetry}>
                {tDepartments('tryAgain')}
              </Button>
            )
          }
        >
          {tDepartments('failedToLoadDepartments')}
        </Alert>
      </Paper>
    );
  }

  // No data state
  if (!departments || departments.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {tDepartments('noDepartmentsFound')}
        </Typography>
      </Paper>
    );
  }

  // Success state - render the table
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={tDepartments('searchDepartments')}
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Box>
      
      <DataGrid
        rows={filteredRows}
        columns={columns}
        hideFooterPagination
        hideFooter
        disableRowSelectionOnClick
        disableColumnMenu
        onRowClick={(params) => onRowClick(params.row)}
        sx={{
          flexGrow: 1,
          '& .MuiDataGrid-cell:focus': { outline: 'none' },
          '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
          '& .MuiDataGrid-cell': {paddingInlineEnd: 0}
        }}
      />
    </Paper>
  );
};
