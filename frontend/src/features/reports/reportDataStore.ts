// In-memory store for report data. This avoids putting large data in URLs.
// Data is lost on page refresh, but tabs persist via localStorage only for
// template_id and report_key — the actual data is re-fetched when needed.

const reportDataStore = new Map<string, any>();

export const setReportData = (key: string, data: any): void => {
  reportDataStore.set(key, data);
};

export const getReportData = (key: string): any | undefined => {
  return reportDataStore.get(key);
};

export const clearReportData = (key: string): void => {
  reportDataStore.delete(key);
};