import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  Container,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../components/shared/ExtendedDataGrid';
import { useOpenPage } from '../../components/tabs/useOpenPage';
import { useTabLoading } from '../../components/tabs/TabLoadingContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { useGetReportsQuery } from './reportingApi';
import { ReportActionsMenu } from './components/ReportActionsMenu';
import type { ReportCategory, ReportSummary } from './types';

const CATEGORIES: Array<'all' | ReportCategory> = ['all', 'financial_statements', 'general_ledger', 'analysis'];
type Source = 'all' | 'system' | 'organization';

/** The reports the member may see, by category, with search. */
export const ReportCenterPage = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = Number(organizationId);
  const { t } = useTranslation('reporting');
  const { openPage } = useOpenPage(orgId);
  const [category, setCategory] = useState<'all' | ReportCategory>('all');
  const [source, setSource] = useState<Source>('all');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);

  const { data: reports = [], isFetching, isError, error } = useGetReportsQuery({ organizationId: orgId, archived }, { skip: !orgId });
  useTabLoading(isFetching);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter(
      (report) =>
        (category === 'all' || report.category === category) &&
        (source === 'all' || (source === 'system') === report.system) &&
        (!archived || !!report.archived_at) &&
        (!term || `${report.name} ${report.description ?? ''}`.toLowerCase().includes(term))
    );
  }, [reports, category, source, search, archived]);

  const open = (report: ReportSummary) => openPage('report-viewer', report.name, `reporting/reports/${report.id}`);

  const columns: GridColDef<ReportSummary>[] = [
    {
      field: 'name',
      headerName: t('catalog.name'),
      flex: 1,
      minWidth: 260,
      renderCell: (cell) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
          {cell.row.primary && <StarIcon fontSize="small" color="warning" titleAccess={t('catalog.primary')} />}
          <Typography variant="body2">{cell.row.name}</Typography>
        </Stack>
      ),
    },
    {
      field: 'description',
      headerName: t('catalog.description'),
      flex: 1.5,
      minWidth: 260,
      valueGetter: (value: string | null) => value ?? '',
    },
    {
      field: 'category',
      headerName: t('catalog.category'),
      width: 180,
      valueGetter: (value: ReportCategory) => t(`categories.${value}`),
    },
    {
      field: 'standard',
      headerName: t('catalog.standard'),
      width: 110,
      valueGetter: (value: string | null) => (value ? t(`standards.${value}`, { defaultValue: value.toUpperCase() }) : ''),
    },
    {
      field: 'system',
      headerName: t('catalog.source'),
      width: 140,
      renderCell: (cell) => (
        <Chip
          size="small"
          variant={cell.row.system ? 'outlined' : 'filled'}
          color={cell.row.system ? 'default' : 'primary'}
          label={cell.row.system ? t('catalog.system') : t('catalog.organization')}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (cell) => <ReportActionsMenu organizationId={orgId} report={cell.row} onCopied={open} />,
    },
  ];

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h4" gutterBottom>
          {t('catalog.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('catalog.subtitle')}
        </Typography>
      </Box>

      <Tabs value={category} onChange={(_, value) => setCategory(value)} sx={{ mb: 2, flexShrink: 0 }} variant="scrollable">
        {CATEGORIES.map((value) => (
          <Tab key={value} value={value} label={t(`categories.${value}`)} />
        ))}
      </Tabs>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexShrink: 0 }} alignItems="center">
        <TextField
          size="small"
          placeholder={t('catalog.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup size="small" exclusive value={source} onChange={(_, value) => value && setSource(value)}>
          <ToggleButton value="all">{t('catalog.all')}</ToggleButton>
          <ToggleButton value="system">{t('catalog.system')}</ToggleButton>
          <ToggleButton value="organization">{t('catalog.organization')}</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButton size="small" value="archived" selected={archived} onChange={() => setArchived((v) => !v)}>
          {t('catalog.archived')}
        </ToggleButton>
      </Stack>

      {isError && <Alert severity="error">{apiErrorMessage(error) || t('catalog.loadFailed')}</Alert>}

      <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={rows}
          columns={columns}
          loading={isFetching}
          onRowOpen={(row) => open(row as ReportSummary)}
          rowOpenLabel={t('catalog.open')}
          hideFooter
          hideFooterPagination
          disableColumnMenu
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: t('catalog.empty') }}
        />
      </Paper>
    </Container>
  );
};
