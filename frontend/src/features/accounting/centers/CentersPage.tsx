import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Menu,
  MenuItem,
} from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import {
  useGetCentersQuery,
  useGetCenterQuery,
  useDeleteCenterMutation,
  type Center,
} from './centersApi';
import { useGetCenterTypesQuery } from '../centerTypes/centerTypesApi';
import { CenterModal } from './components/CenterModal';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useTabManager } from '../../../components/tabs/useTabManager';

export const CentersPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const [searchParams] = useSearchParams();
  const orgId = parseInt(organizationId || '0', 10);
  const centerTypeId = searchParams.get('center_type_id')
    ? parseInt(searchParams.get('center_type_id')!, 10)
    : null;
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { openTab } = useTabManager();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [fetchCenterId, setFetchCenterId] = useState<number | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedForMenu, setSelectedForMenu] = useState<Center | null>(null);

  const { data: centerTypes } = useGetCenterTypesQuery(orgId, { skip: !orgId });
  const { data: centers, isLoading, error, refetch } = useGetCentersQuery(
    { organizationId: orgId, centerTypeId: centerTypeId ?? undefined },
    { skip: !orgId }
  );

  const { data: fullCenter } = useGetCenterQuery(
    { organizationId: orgId, id: fetchCenterId! },
    { skip: fetchCenterId === null }
  );

  const [deleteCenter] = useDeleteCenterMutation();

  useEffect(() => {
    if (fullCenter) {
      setEditingCenter(fullCenter);
      setIsModalOpen(true);
      setFetchCenterId(null);
    }
  }, [fullCenter]);

  const isFilteredView = !!centerTypeId;
  const selectedCenterType = useMemo(
    () => centerTypes?.find((ct) => ct.id === centerTypeId) ?? null,
    [centerTypes, centerTypeId]
  );
  const metadataFields = selectedCenterType?.metadata || [];

  const handleAdd = () => { setEditingCenter(null); setIsModalOpen(true); };

  const handleRowClick = (center: Center) => {
    if (center.metadata !== undefined) {
      setEditingCenter(center);
      setIsModalOpen(true);
    } else {
      setFetchCenterId(center.id);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, center: Center) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedForMenu(center);
  };
  const handleMenuClose = () => { setMenuAnchorEl(null); setSelectedForMenu(null); };

  const handleDelete = async () => {
    if (!selectedForMenu) return;
    const confirmed = await confirm({
      title: tAccounting('deleteCenterTitle'),
      message: tAccounting('deleteCenterMessage', { code: selectedForMenu.code }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    handleMenuClose();
    if (!confirmed) return;
    try {
      await deleteCenter({ organizationId: orgId, id: selectedForMenu.id }).unwrap();
      showSuccess(tAccounting('centerDeleted'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('centerDeleteFailed'));
    }
  };

  const handleHistory = () => {
    if (!selectedForMenu) return;
    const path = `/app/organizations/${orgId}/record-history?type=Accounting::Center&id=${selectedForMenu.id}`;
    const name = selectedForMenu.name;
    handleMenuClose();
    setTimeout(() => { openTab('record-history', `History: ${name}`, path); navigate(path); }, 0);
  };

  const staticColumns: GridColDef<Center>[] = [
    {
      field: 'code',
      headerName: tAccounting('code'),
      width: 180,
    },
    {
      field: 'name',
      headerName: t('name'),
      minWidth: 300,
    },
    ...(isFilteredView ? [] : [{
      field: 'center_type' as const,
      headerName: tAccounting('centerType'),
      width: 200,
      valueGetter: (_value: any, row: Center) => row.center_type?.name || '—',
    }]),
  ];

  const metadataColumns: GridColDef<Center>[] = isFilteredView
    ? metadataFields.map((field) => ({
        field: `metadata_${field.id}`,
        headerName: field.name?.en || field.name?.[Object.keys(field.name || {})[0]] || field.id,
        width: 150,
        valueGetter: (_value: any, row: Center) => {
          const val = row.metadata?.[field.id];
          if (val === null || val === undefined) return '—';
          if (field.type === 'boolean') return val ? t('yes') : t('no');
          return String(val);
        },
        renderCell: (params: GridRenderCellParams) => {
          const val = params.row.metadata?.[field.id];
          if (field.type === 'boolean') {
            return <Chip label={val ? t('yes') : t('no')} size="small" color={val ? 'success' : 'default'} />;
          }
          return val ?? '—';
        },
      }))
    : [];

  const actionsColumn: GridColDef<Center> = {
    field: 'actions',
    headerName: t('actions'),
    width: 80,
    sortable: false,
    renderCell: (params: GridRenderCellParams<Center>) => (
      <IconButton size="small" onClick={(e) => handleMenuOpen(e, params.row)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
    ),
  };

  const columns = [...staticColumns, ...metadataColumns, actionsColumn];

  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {isFilteredView ? selectedCenterType?.name : tAccounting('centers')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isFilteredView ? tAccounting('centersForCenterType') : tAccounting('centersDescription')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {tAccounting('addCenter')}
        </Button>
      </Box>

      {!centers || centers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{tAccounting('noCenters')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ExtendedDataGrid
            rows={centers}
            columns={columns}
            showHeaderSearchRow
            excludeSearchFields={['actions']}
            hideFooterPagination
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            onRowClick={(params) => handleRowClick(params.row)}
            initialState={{ sorting: { sortModel: [{ field: 'code', sort: 'asc' }] } }}
            sx={{
              flex: 1,
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
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
        <MenuItem onClick={handleHistory}>{t('changeLog')}</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>{t('commonActions.delete')}</MenuItem>
      </Menu>

      <CenterModal
        open={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCenter(null); }}
        organizationId={orgId}
        center={editingCenter}
        preselectedCenterTypeId={centerTypeId ?? undefined}
      />
    </Container>
  );
};