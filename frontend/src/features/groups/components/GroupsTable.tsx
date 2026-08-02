// frontend/src/features/groups/components/GroupsTable.tsx
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
import type { Group } from '../groupsApi';
import { useDeleteGroupMutation } from '../groupsApi';
import { useConfirm } from '../../../contexts/confirmContext';
import { useToast } from '../../../contexts/ToastContext';

interface GroupsTableProps {
  groups?: Group[];
  organizationId: number;
  onRowClick: (group: Group) => void;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

// ✅ Extend Group with computed member_count for sorting
interface GroupWithMemberCount extends Group {
  member_count: number;
}

export const GroupsTable = ({
  groups,
  organizationId,
  onRowClick,
  isLoading,
  error,
  onRetry,
}: GroupsTableProps) => {
  const { t } = useTranslation('shared');
  const { t: tGroups } = useTranslation('groups');

  const [globalSearch, setGlobalSearch] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedGroupForMenu, setSelectedGroupForMenu] = useState<Group | null>(null);

  const [deleteGroup] = useDeleteGroupMutation();
  const confirm = useConfirm();
  const { showSuccess, showError } = useToast();

  // ✅ Add member_count to each group for sorting
  const groupsWithCount = useMemo(() => {
    if (!groups) return [];
    return groups.map((group) => ({
      ...group,
      member_count: group.members?.length || 0,
    }));
  }, [groups]);

  const handleDelete = async () => {
    if (!selectedGroupForMenu) return;

    const confirmed = await confirm({
      title: tGroups('deleteGroupTitle'),
      message: tGroups('deleteGroupMessage', { name: selectedGroupForMenu.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!confirmed) {
      setMenuAnchorEl(null);
      return;
    }

    try {
      await deleteGroup({ organizationId, id: selectedGroupForMenu.id }).unwrap();
      showSuccess(tGroups('deleteSuccess'));
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      showError(error?.data?.errors?.[0] || tGroups('deleteFailed'));
    }
    setMenuAnchorEl(null);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, group: Group) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedGroupForMenu(group);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedGroupForMenu(null);
  };

  const filteredRows = useMemo(() => {
    if (!globalSearch.trim() || !groupsWithCount) return groupsWithCount || [];

    const searchTerm = globalSearch.toLowerCase();
    return groupsWithCount.filter((group) =>
      group.name.toLowerCase().includes(searchTerm) ||
      (group.description?.toLowerCase() || '').includes(searchTerm)
    );
  }, [groupsWithCount, globalSearch]);

  const columns: GridColDef<GroupWithMemberCount>[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 300,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<GroupWithMemberCount>) => (
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
      field: 'description',
      headerName: t('description'),
      width: 350,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<GroupWithMemberCount>) => (
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
      field: 'member_count', // ✅ Use this field for sorting
      headerName: tGroups('members'),
      width: 120,
      disableColumnMenu: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<GroupWithMemberCount>) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          { params.row.member_count }
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 80,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<GroupWithMemberCount>) => (
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
        <Typography>{tGroups('loadingGroups')}</Typography>
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
                {tGroups('tryAgain')}
              </Button>
            )
          }
        >
          {tGroups('failedToLoadGroups')}
        </Alert>
      </Paper>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {tGroups('noGroupsFound')}
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
          placeholder={tGroups('searchGroups')}
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
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          {t('commonActions.delete')}
        </MenuItem>
      </Menu>
    </Paper>
  );
};