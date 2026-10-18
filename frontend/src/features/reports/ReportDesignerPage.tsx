import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ReportDesigner } from '@ariana-reports/react';
import {
  apiErrorMessage,
  useGetReportTemplateQuery,
  useUpdateReportTemplateMutation,
} from '../reportTemplates/reportTemplatesApi';
import { useToast } from '../../contexts/ToastContext';
import { REPORT_FONT_FAMILIES } from './reportEngine';
import { useReportData } from './useReportData';
import { useReportSetup } from './useReportSetup';
import { parseId, useTabSearchParams } from './useTabSearchParams';
import { useTabLoading } from '../../components/tabs/TabLoadingContext';

// Path: report-designer?template_id=1&record_id=42 (record_id is optional and
// provides sample data for field detection and the preview).
export const ReportDesignerPage = () => {
  const { t: tReports } = useTranslation('reports');
  const { organizationId } = useParams<{ organizationId: string }>();
  const { showSuccess, showError } = useToast();
  const searchParams = useTabSearchParams();
  const { theme, uiLocale, fonts, fontsReady } = useReportSetup();

  const orgId = parseInt(organizationId || '0', 10);
  const templateId = parseId(searchParams.get('template_id'));
  const recordId = parseId(searchParams.get('record_id'));

  const { data: template, isLoading: templateLoading } = useGetReportTemplateQuery(
    { organizationId: orgId, id: templateId ?? 0 },
    { skip: !templateId || !orgId }
  );
  const sample = useReportData(template?.report_key ?? '', orgId, recordId);

  const [updateTemplate] = useUpdateReportTemplateMutation();

  const preview = useMemo(
    () => ({ measurer: fonts?.measurer, pdf: { fonts: fonts?.fonts } }),
    [fonts]
  );

  const handleSave = useCallback(
    async (_template: unknown, json: string) => {
      if (!templateId) return;
      try {
        await updateTemplate({ organizationId: orgId, id: templateId, data: { template_file: json } }).unwrap();
        showSuccess(tReports('saveTemplateSuccess'));
      } catch (err) {
        showError(apiErrorMessage(err) || tReports('saveTemplateFailed'));
      }
    },
    [orgId, templateId, updateTemplate, showSuccess, showError, tReports]
  );

  if (!templateId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{tReports('noTemplateSelected')}</Alert>
      </Box>
    );
  }

  // The designer reads its template and sample data once, so wait for both.
  useTabLoading(templateLoading || sample.isLoading || !fontsReady);
  if (templateLoading || sample.isLoading || !fontsReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!template) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{tReports('templateNotFound')}</Alert>
      </Box>
    );
  }

  if (template.system) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">{tReports('systemTemplateReadOnly')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <ReportDesigner
        key={template.id}
        template={template.template_file}
        sampleData={sample.data}
        onSave={handleSave}
        fonts={REPORT_FONT_FAMILIES}
        preview={preview}
        theme={theme}
        uiLocale={uiLocale}
      />
    </Box>
  );
};
