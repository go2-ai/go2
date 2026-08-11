import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Menu,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import {
  useGetCenterTypesQuery,
  useDeleteCenterTypeMutation,
  type CenterType,
} from './centerTypesApi';
import { CenterTypeModal } from './components/CenterTypeModal';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { Tooltip } from '@mui/material';

export const CenterTypesPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { openTab } = useTabManager();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenterType, setEditingCenterType] = useState<CenterType | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedForMenu, setSelectedForMenu] = useState<CenterType | null>(null);

  const { data: centerTypes, isLoading, error, refetch } = useGetCenterTypesQuery(orgId, { skip: !orgId });
  const [deleteCenterType] = useDeleteCenterTypeMutation();

  // Filter and sort by first_code
  const filteredRows = useMemo(() => {
    if (!centerTypes) return [];
    let rows = centerTypes;

    if (globalSearch.trim()) {
      const searchTerm = globalSearch.toLowerCase();
      rows = rows.filter((ct) =>
        ct.name.toLowerCase().includes(searchTerm) ||
        ct.first_code.toLowerCase().includes(searchTerm) ||
        ct.last_code.toLowerCase().includes(searchTerm)
      );
    }

    return rows.slice().sort((a, b) => a.first_code.localeCompare(b.first_code));
  }, [centerTypes, globalSearch]);

  const handleAdd = () => {
    setEditingCenterType(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (centerType: CenterType) => {
    setEditingCenterType(centerType);
    setIsModalOpen(true);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, centerType: CenterType) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedForMenu(centerType);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedForMenu(null);
  };

  const handleDelete = async () => {
    if (!selectedForMenu) return;

    const confirmed = await confirm({
      title: tAccounting('deleteCenterTypeTitle'),
      message: tAccounting('deleteCenterTypeMessage', { name: selectedForMenu.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    handleMenuClose();

    if (!confirmed) return;

    try {
      await deleteCenterType({ organizationId: orgId, id: selectedForMenu.id }).unwrap();
      showSuccess(tAccounting('centerTypeDeleted'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('centerTypeDeleteFailed'));
    }
  };

  const handleHistory = () => {
    if (!selectedForMenu) return;
    const path = `/app/organizations/${orgId}/record-history?type=Accounting::CenterType&id=${selectedForMenu.id}`;
    const name = selectedForMenu.name;

    handleMenuClose();

    setTimeout(() => {
      openTab('record-history', `History: ${name}`, path);
      navigate(path);
    }, 0);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCenterType(null);
  };

  const columns: GridColDef<CenterType>[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 250,
      disableColumnMenu: true,
    },
    {
      field: 'first_code',
      headerName: tAccounting('firstCode'),
      width: 130,
      disableColumnMenu: true,
    },
    {
      field: 'last_code',
      headerName: tAccounting('lastCode'),
      width: 130,
      disableColumnMenu: true,
    },
    {
      field: 'auto_increment',
      headerName: tAccounting('autoIncrement'),
      width: 140,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<CenterType>) => (
        <Chip
          label={params.row.auto_increment ? t('yes') : t('no')}
          size="small"
          color={params.row.auto_increment ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'centers_count',
      headerName: tAccounting('centers'),
      width: 100,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<CenterType>) => {
        const count = params.row.centers_count || 0;
        return (
          <Chip
            label={count}
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              const path = `/app/organizations/${orgId}/accounting/centers?center_type_id=${params.row.id}`;
              openTab('centers', `${params.row.name} Centers`, path);
              navigate(path);
            }}
            sx={{ cursor: 'pointer' }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 80,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<CenterType>) => (
        <IconButton
          size="small"
          onClick={(e) => handleMenuOpen(e, params.row)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t('commonActions.retry')}
            </Button>
          }
        >
          {tAccounting('failedToLoadCenterTypes')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {tAccounting('centerTypes')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tAccounting('centerTypesDescription')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {tAccounting('addCenterType')}
        </Button>
      </Box>

      {!centerTypes || centerTypes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{tAccounting('noCenterTypes')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={tAccounting('searchCenterTypes')}
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
            onRowClick={(params) => handleRowClick(params.row)}
            initialState={{
              sorting: {
                sortModel: [{ field: 'first_code', sort: 'asc' }],
              },
            }}
            sx={{
              flex: 1,
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
              '& .MuiDataGrid-cell': { paddingInlineEnd: 0 },
            }}
          />
        </Paper>
      )}

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
        <Tooltip title={selectedForMenu && (selectedForMenu.centers_count || 0) > 0 ? tAccounting('cannotDeleteWithCenters') : ''}>
          <span>
            <MenuItem
              onClick={handleDelete}
              disabled={selectedForMenu ? (selectedForMenu.centers_count || 0) > 0 : false}
              sx={{ color: (selectedForMenu && (selectedForMenu.centers_count || 0) > 0) ? undefined : 'error.main' }}
            >
              {t('commonActions.delete')}
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>

      <CenterTypeModal
        open={isModalOpen}
        onClose={handleModalClose}
        organizationId={orgId}
        centerType={editingCenterType}
      />
    </Container>
  );
}