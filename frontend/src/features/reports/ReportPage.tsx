import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetReportTemplateQuery } from '../reportTemplates/reportTemplatesApi';
import { ReportViewer } from './components/ReportViewer';
import { useReportData } from './useReportData';
import { parseId, useTabSearchParams } from '../../components/tabs/useTabSearchParams';
import { useTabLoading } from '../../components/tabs/TabLoadingContext';
import { reportTargetFromParams } from './useOpenReport';

// Path: reports?template_id=1&report_key=journal_entry&record_id=42
//   or: reports?template_id=7&report_key=explorer&source=<the page's query string>
export const ReportPage = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useTranslation('reports');
  const searchParams = useTabSearchParams();

  const orgId = parseInt(organizationId || '0', 10);
  const templateId = parseId(searchParams.get('template_id'));
  const reportKey = searchParams.get('report_key') || '';
  const target = reportTargetFromParams(searchParams);

  const { data: template, isLoading: templateLoading } = useGetReportTemplateQuery(
    { organizationId: orgId, id: templateId ?? 0 },
    { skip: !templateId || !orgId }
  );
  // The data is loaded in the template's language (not the user's).
  const report = useReportData(reportKey || template?.report_key || '', orgId, target, template?.locale);

  if (!templateId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('noTemplateSelected')}</Alert>
      </Box>
    );
  }

  useTabLoading(templateLoading || report.isLoading);
  if (templateLoading || report.isLoading) {
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

  if (report.isError || !report.data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('reportDataNotFound')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%' }}>
      <ReportViewer
        templateFile={template.template_file}
        data={report.data}
        title={template.name}
        locale={template.locale}
      />
    </Box>
  );
};
