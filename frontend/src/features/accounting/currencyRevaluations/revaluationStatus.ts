import type { RevaluationStatus } from './currencyRevaluationsApi';

export const STATUS_COLORS: Record<RevaluationStatus, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  posted: 'success',
  superseded: 'default',
};
