// frontend/src/features/departments/components/DepartmentsTable.tsx
import { useState, useMemo } from 'react';
import {
  Paper,
  Box,
  TextField,
  InputAdornment,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { Department } from '../types';
import { useDeleteDepartmentMutation } from '../departmentsApi';
import { useConfirm } from '../../../contexts/confirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../../components/tabs/useTabManager';

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
  onRetry,
}: DepartmentsTableProps) => {
  const { t } = useTranslation('shared');
  const { t: tDepartments } = useTranslation('departments');
  const navigate = useNavigate();
  const { organizationId: orgIdParam } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();

  const [globalSearch, setGlobalSearch] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDepartmentForMenu, setSelectedDepartmentForMenu] = useState<Department | null>(null);

  const [deleteDepartment] = useDeleteDepartmentMutation();
  const confirm = useConfirm();
  const { showSuccess, showError } = useToast();

  const handleDelete = async () => {
    if (!selectedDepartmentForMenu) return;

    const confirmed = await confirm({
      title: tDepartments('deleteDepartmentTitle'),
      message: tDepartments('deleteDepartmentMessage', { name: selectedDepartmentForMenu.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!confirmed) {
      setMenuAnchorEl(null);
      return;
    }

    try {
      await deleteDepartment({ organizationId, departmentId: selectedDepartmentForMenu.id }).unwrap();
      showSuccess(tDepartments('deleteSuccess'));
    } catch (error: any) {
      console.error('Failed to delete department:', error);
      showError(error?.data?.errors?.[0] || tDepartments('deleteFailed'));
    }
    setMenuAnchorEl(null);
  };

  const handleHistory = () => {
    if (!selectedDepartmentForMenu) return;
    const path = `/app/organizations/${orgIdParam}/record-history?type=Department&id=${selectedDepartmentForMenu.id}`;
    const departmentName = selectedDepartmentForMenu.name;

    setMenuAnchorEl(null);
    setSelectedDepartmentForMenu(null);

    setTimeout(() => {
      openTab('record-history', `History: ${departmentName}`, path);
      navigate(path);
    }, 0);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, department: Department) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedDepartmentForMenu(department);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedDepartmentForMenu(null);
  };

  const filteredRows = useMemo(() => {
    if (!globalSearch.trim() || !departments) return departments || [];

    const searchTerm = globalSearch.toLowerCase();
    return departments.filter((department) =>
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
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<Department>) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {params.row.name}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'abbreviation',
      headerName: t('abbreviation'),
      width: 150,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<Department>) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Typography variant="body2">
            {params.row.abbreviation || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'description',
      headerName: t('description'),
      width: 400,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<Department>) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Typography variant="body2">
            {params.row.description || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 80,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<Department>) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => handleMenuOpen(e, params.row)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Paper sx={{ p: 4, gap: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography>{tDepartments('loadingDepartments')}</Typography>
      </Paper>
    );
  }

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

  if (!departments || departments.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {tDepartments('noDepartmentsFound')}
        </Typography>
      </Paper>
    );
  }

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
          '& .MuiDataGrid-cell': { paddingInlineEnd: 0 },
        }}
      />

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleHistory}>
          {t('changeLog')}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          {t('commonActions.delete')}
        </MenuItem>
      </Menu>
    </Paper>
  );
};