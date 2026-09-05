import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useCurrentTabId } from '../../components/tabs/TabIdContext';
import {
  useGetReportTemplateQuery,
  useCreateReportTemplateMutation,
  useUpdateReportTemplateMutation,
} from '../reportTemplates/reportTemplatesApi';
import { useToast } from '../../contexts/ToastContext';

declare global {
  interface Window {
    Stimulsoft: any;
  }
}

const STIMULSOFT_BASE = import.meta.env.DEV ? 'http://localhost:5173' : '';

const STIMULSOFT_DESIGNER_SCRIPTS = [
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.viewer.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.designer.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.export.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.chart.js`,
];

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
};

export const ReportDesignerPage = () => {
  const { t } = useTranslation('shared');
  const { t: tReports } = useTranslation('reports');
  const { organizationId } = useParams<{ organizationId: string }>();
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();
  const { showSuccess, showError } = useToast();
  const designerRef = useRef<HTMLDivElement>(null);
  const reportInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const orgId = parseInt(organizationId || '0', 10);

  const { templateId, isNew } = useMemo(() => {
    const tab = layout.panels
      .flatMap((p) => p.tabs)
      .find((tab) => tab.id === tabId);

    if (!tab?.path) return { templateId: null, isNew: false };

    const url = new URL(tab.path, window.location.origin);
    return {
      templateId: url.searchParams.get('template_id')
        ? parseInt(url.searchParams.get('template_id')!, 10)
        : null,
      isNew: url.searchParams.get('is_new') === 'true',
    };
  }, [layout, tabId]);

  const { data: template } = useGetReportTemplateQuery(
    { organizationId: orgId, id: templateId! },
    { skip: !templateId }
  );

  const [createTemplate] = useCreateReportTemplateMutation();
  const [updateTemplate] = useUpdateReportTemplateMutation();

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      try {
        for (const src of STIMULSOFT_DESIGNER_SCRIPTS) {
          await loadScript(src);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (disposed || !designerRef.current) return;

        const Stimulsoft = window.Stimulsoft;

        // Use 'load' method (not loadString or loadFromString)
        const report = new Stimulsoft.Report.StiReport();

        if (template?.template_file && !isNew) {
          report.load(template.template_file);
        }

        reportInstanceRef.current = report;

        const designer = new Stimulsoft.Designer.StiDesigner(
  null,
  'StiDesigner',
  false
);

// Hide built-in save/open/new buttons
designer.options.toolbar.showSaveButton = false;
designer.options.toolbar.showOpenButton = false;
designer.options.toolbar.showNewButton = false;

designer.report = report;
designer.renderHtml(designerRef.current);

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize Designer:', err);
        setError(`Failed to load report designer: ${err}`);
        setLoading(false);
      }
    };

    initialize();

    return () => {
      disposed = true;
    };
  }, [template, isNew]);

  const handleSave = async () => {
    if (!reportInstanceRef.current) return;

    setSaving(true);
    try {
      const mrtJson = reportInstanceRef.current.saveToJsonString
        ? reportInstanceRef.current.saveToJsonString()
        : reportInstanceRef.current.save();

      if (isNew || !templateId) {
        await createTemplate({
          organizationId: orgId,
          data: {
            report_key: template?.report_key || '',
            template_file: mrtJson,
            name: {
              en: template?.name || 'New Report',
              fa: template?.name || 'گزارش جدید',
            },
          },
        }).unwrap();
        showSuccess(tReports('saveSuccess'));
      } else {
        await updateTemplate({
          organizationId: orgId,
          id: templateId,
          data: {
            template_file: mrtJson,
          },
        }).unwrap();
        showSuccess(tReports('saveSuccess'));
      }
    } catch (err: any) {
      console.log(err)
      showError(err?.data?.errors?.[0] || tReports('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Always render the designer container */}
      <div ref={designerRef} style={{ height: '100%', width: '100%' }} />

      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.paper',
            zIndex: 10,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Error overlay */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.paper',
            zIndex: 10,
          }}
        >
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Save button */}
      {!loading && !error && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
          }}
        >
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            size="small"
          >
            {saving ? `${t('commonActions.save')}...` : t('commonActions.save')}
          </Button>
        </Box>
      )}
    </Box>
  );
};