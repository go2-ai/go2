import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../components/tabs/useTabManager';
import { findDefaultTemplate, useGetReportTemplatesQuery } from '../reportTemplates/reportTemplatesApi';

export const useOpenReport = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();
  const orgId = parseInt(organizationId || '0', 10);

  const { data: templates } = useGetReportTemplatesQuery(orgId, { skip: !orgId });

  /**
   * Opens a report tab for a record. The report page loads the record's data
   * itself (see useReportData), so the tab survives page refreshes.
   */
  const openReport = useCallback(
    (reportKey: string, recordId: number, title?: string, templateId?: number) => {
      const template = templateId
        ? templates?.find((t) => t.id === templateId)
        : findDefaultTemplate(templates, reportKey);

      if (!template) {
        console.error(`No template found for report key: ${reportKey} (templateId: ${templateId || 'default'})`);
        return;
      }

      const params = new URLSearchParams({
        template_id: String(template.id),
        report_key: reportKey,
        record_id: String(recordId),
      });
      const path = `/app/organizations/${orgId}/reports?${params.toString()}`;

      openTab('reports', title || `Report: ${reportKey}`, path);
      navigate(path);
    },
    [orgId, templates, openTab, navigate]
  );

  return { openReport };
};
