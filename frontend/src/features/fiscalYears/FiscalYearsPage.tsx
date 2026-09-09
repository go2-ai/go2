import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslation } from 'react-i18next';
import {
  useGetFiscalYearsQuery,
  useDeleteFiscalYearMutation,
  type FiscalYear,
} from './fiscalYearsApi';
import { FiscalYearModal } from './components/FiscalYearModal';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { useTabManager } from '../../components/tabs/useTabManager';

export const FiscalYearsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tFiscalYears } = useTranslation('fiscalYears');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { openTab } = useTabManager();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFiscalYear, setEditingFiscalYear] = useState<FiscalYear | null>(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedForMenu, setSelectedForMenu] = useState<FiscalYear | null>(null);

  const { data: fiscalYears, isLoading, error, refetch } = useGetFiscalYearsQuery(orgId, { skip: !orgId });
  const [deleteFiscalYear] = useDeleteFiscalYearMutation();

  // Sort by start_date descending
  const sortedRows = useMemo(() => {
    if (!fiscalYears) return [];
    return [...fiscalYears].sort((a, b) =>
      b.start_date.localeCompare(a.start_date)
    );
  }, [fiscalYears]);

  // Calculate next start date (day after latest finish_date)
  const nextStartDate = useMemo(() => {
    if (!fiscalYears || fiscalYears.length === 0) return null;
    const latestFinish = fiscalYears
      .map((fy) => fy.finish_date)
      .sort()
      .reverse()[0];

    if (!latestFinish) return null;

    const [y, m, d] = latestFinish.split('-').map(Number);
    const date = new Date(y, m - 1, d); // local date, not UTC-parsed
    date.setDate(date.getDate() + 1);

    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, '0');
    const nd = String(date.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }, [fiscalYears]);

  const handleAdd = () => {
    setEditingFiscalYear(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (fiscalYear: FiscalYear) => {
    setEditingFiscalYear(fiscalYear);
    setIsModalOpen(true);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, fiscalYear: FiscalYear) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedForMenu(fiscalYear);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedForMenu(null);
  };

  const handleDelete = async () => {
    if (!selectedForMenu) return;

    const confirmed = await confirm({
      title: tFiscalYears('deleteTitle'),
      message: tFiscalYears('deleteMessage', { name: selectedForMenu.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    handleMenuClose();

    if (!confirmed) return;

    try {
      await deleteFiscalYear({ organizationId: orgId, id: selectedForMenu.id }).unwrap();
      showSuccess(tFiscalYears('deleteSuccess'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tFiscalYears('deleteFailed'));
    }
  };

  const handleHistory = () => {
    if (!selectedForMenu) return;

    const path = `/app/organizations/${orgId}/record-history?type=FiscalYear&id=${selectedForMenu.id}`;
    const name = selectedForMenu.name;

    handleMenuClose();

    setTimeout(() => {
      openTab('record-history', `History: ${name}`, path);
      navigate(path);
    }, 0);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingFiscalYear(null);
  };

  const columns: GridColDef<FiscalYear>[] = [
    {
      field: 'name',
      headerName: t('name'),
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
    },
    {
      field: 'start_date',
      headerName: tFiscalYears('startDate'),
      width: 160,
      sortable: false,
      disableColumnMenu: true,
    },
    {
      field: 'finish_date',
      headerName: tFiscalYears('finishDate'),
      width: 160,
      sortable: false,
      disableColumnMenu: true,
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 80,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<FiscalYear>) => (
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
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t('commonActions.retry')}
            </Button>
          }
        >
          {tFiscalYears('saveFailed')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {tFiscalYears('fiscalYears')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tFiscalYears('fiscalYearsDescription')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {tFiscalYears('addFiscalYear')}
        </Button>
      </Box>

      {!fiscalYears || fiscalYears.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {tFiscalYears('noFiscalYears')}
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DataGrid
            rows={sortedRows}
            columns={columns}
            hideFooterPagination
            hideFooter
            disableRowSelectionOnClick
            disableColumnMenu
            sortingOrder={['desc']}
            onRowClick={(params) => handleRowClick(params.row)}
            initialState={{
              sorting: {
                sortModel: [{ field: 'start_date', sort: 'desc' }],
              },
            }}
            sx={{
              flex: 1,
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
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
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          {t('commonActions.delete')}
        </MenuItem>
      </Menu>

      <FiscalYearModal
        open={isModalOpen}
        onClose={handleModalClose}
        organizationId={orgId}
        fiscalYear={editingFiscalYear}
        nextStartDate={nextStartDate}
      />
    </Container>
  );
};