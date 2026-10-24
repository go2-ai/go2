import { useParams } from 'react-router-dom';
import { Alert, Box, Chip, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetReportQuery } from './reportingApi';
import { ReportActionsMenu } from './components/ReportActionsMenu';
import { useOpenPage } from '../../components/tabs/useOpenPage';
import { useCurrentTabId, useTabManager } from '../../components/tabs';
import { StatementViewer } from '../accounting/statements/StatementViewer';
import { TrialBalanceViewer } from '../accounting/trialBalance/TrialBalanceViewer';
import { RatiosViewer } from '../accounting/ratios/RatiosViewer';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import type { ReportSummary } from './types';

/** Viewers by report type; each system registers its own. */
const VIEWERS: Record<string, React.ComponentType<{ organizationId: number; report: ReportSummary }>> = {
  'accounting.statement': StatementViewer,
  'accounting.trial_balance': TrialBalanceViewer,
  'accounting.ratios': RatiosViewer,
};

export const ReportViewerPage = () => {
  const { organizationId, reportId } = useParams<{ organizationId: string; reportId: string }>();
  const orgId = Number(organizationId);
  const id = Number(reportId);
  const { t } = useTranslation('reporting');
  const { openPage } = useOpenPage(orgId);
  const { closeTab, layout } = useTabManager();
  const tabId = useCurrentTabId();
  const { data: report, isLoading, isError, error } = useGetReportQuery({ organizationId: orgId, id }, { skip: !orgId || !id });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !report) {
    return (
      <Container sx={{ py: 2 }}>
        <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>
      </Container>
    );
  }

  // The report is gone: close its tab.
  const closeCurrentTab = () => {
    const panel = tabId ? layout.panels.find((p) => p.tabs.some((tab) => tab.id === tabId)) : undefined;
    if (panel && tabId) closeTab(tabId, panel.id);
  };

  const Viewer = VIEWERS[report.report_type];
  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2, gap: 2 }}>
      <Box sx={{ flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h4">{report.name}</Typography>
          <Chip size="small" label={report.system ? t('catalog.system') : t('catalog.organization')} />
          {report.archived_at && <Chip size="small" color="warning" label={t('catalog.archived')} />}
          <ReportActionsMenu
            organizationId={orgId}
            report={report}
            onCopied={(copy) => openPage('report-viewer', copy.name, `reporting/reports/${copy.id}`)}
            onDeleted={closeCurrentTab}
          />
        </Stack>
        {report.description && (
          <Typography variant="body2" color="text.secondary">
            {report.description}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {Viewer ? <Viewer organizationId={orgId} report={report} /> : <Alert severity="info">{t('viewer.unsupported')}</Alert>}
      </Box>
    </Container>
  );
};
