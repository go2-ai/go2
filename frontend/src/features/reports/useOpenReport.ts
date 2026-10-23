import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../components/tabs/useTabManager';
import { parseId } from '../../components/tabs/useTabSearchParams';

/**
 * What a report prints: a record (e.g. a journal entry) or, for list pages,
 * a source query string describing the page's data (e.g. the explorer's
 * period and filters, see explorerPrintSource).
 */
export interface ReportTarget {
  recordId?: number | null;
  source?: string | null;
}

/** The target as tab URL params: record_id or source. */
export const reportTargetParams = (target: ReportTarget, params = new URLSearchParams()): URLSearchParams => {
  if (target.recordId) params.set('record_id', String(target.recordId));
  if (target.source) params.set('source', target.source);
  return params;
};

export const reportTargetFromParams = (params: URLSearchParams): ReportTarget => ({
  recordId: parseId(params.get('record_id')),
  source: params.get('source'),
});

export const hasReportTarget = (target: ReportTarget): boolean => !!(target.recordId || target.source);

export const useOpenReport = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();
  const orgId = parseInt(organizationId || '0', 10);

  /**
   * Opens a report tab that prints a target with a template. Which template
   * is the default comes from the server (useGetReportResolutionQuery). The
   * report page loads the data itself (see useReportData), so the tab
   * survives page refreshes.
   */
  const openReport = useCallback(
    (reportKey: string, target: ReportTarget, templateId: number, title?: string) => {
      const params = reportTargetParams(
        target,
        new URLSearchParams({ template_id: String(templateId), report_key: reportKey })
      );
      const path = `/app/organizations/${orgId}/reports?${params.toString()}`;

      openTab('reports', title || `Report: ${reportKey}`, path);
      navigate(path);
    },
    [orgId, openTab, navigate]
  );

  return { openReport };
};
