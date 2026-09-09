import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useCurrentTabId } from '../../components/tabs/TabIdContext';
import { useGetReportTemplateQuery } from '../reportTemplates/reportTemplatesApi';
import { ReportViewer } from './components/ReportViewer';
import { getReportData } from './reportDataStore';

export const ReportPage = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useTranslation('reports');
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();

  const orgId = parseInt(organizationId || '0', 10);

  const { reportTemplateId, reportData, reportKey } = useMemo(() => {
    const tab = layout.panels
      .flatMap((p) => p.tabs)
      .find((tab) => tab.id === tabId);

    if (!tab?.path) return { reportTemplateId: null, reportData: null, reportKey: '' };

    const url = new URL(tab.path, window.location.origin);
    const dataKey = url.searchParams.get('data_key') || '';
    
    return {
      reportTemplateId: url.searchParams.get('template_id')
        ? parseInt(url.searchParams.get('template_id')!, 10)
        : null,
      reportData: dataKey ? getReportData(dataKey) : null,
      reportKey: url.searchParams.get('report_key') || '',
    };
  }, [layout, tabId]);

  const { data: template, isLoading } = useGetReportTemplateQuery(
    { organizationId: orgId, id: reportTemplateId! },
    { skip: !reportTemplateId }
  );

  if (!reportTemplateId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('noTemplateSelected')}</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!template) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('templateNotFound')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%'}}>
      <ReportViewer
        templateFile={template.template_file}
        data={reportData || undefined}
        reportKey={reportKey}
      />
    </Box>
  );
};