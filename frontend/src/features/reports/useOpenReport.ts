import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useGetReportTemplatesQuery } from '../reportTemplates/reportTemplatesApi';
import { setReportData } from './reportDataStore';

export const useOpenReport = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();
  const orgId = parseInt(organizationId || '0', 10);

  const { data: templates } = useGetReportTemplatesQuery(orgId, { skip: !orgId });

  const openReport = useCallback(
    (
      reportKey: string,
      data: Record<string, any>,
      title?: string,
      templateId?: number
    ) => {
      let template;

      if (templateId) {
        // Use specific template
        template = templates?.find((t) => t.id === templateId);
      } else {
        // Use default template for this report key
        template = templates?.find(
          (t) => t.report_key === reportKey && t.is_default
        );
      }

      if (!template) {
        console.error(`No template found for report key: ${reportKey} (templateId: ${templateId || 'default'})`);
        return;
      }

      // Generate a unique data key and store the data in memory
      const dataKey = `report_${Date.now()}`;
      setReportData(dataKey, data);

      const path = `/app/organizations/${orgId}/reports?template_id=${template.id}&report_key=${reportKey}&data_key=${dataKey}`;

      openTab('reports', title || `Report: ${reportKey}`, path);
      navigate(path);
    },
    [orgId, templates, openTab, navigate]
  );

  return { openReport };
};