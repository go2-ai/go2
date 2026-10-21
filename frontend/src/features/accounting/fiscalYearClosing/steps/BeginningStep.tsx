import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Alert, AlertTitle, Box, Button, CircularProgress, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTabManager } from '../../../../components/tabs/useTabManager';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { fiscalYearsApi } from '../../../fiscalYears/fiscalYearsApi';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import { usePostBeginningMutation, type ClosingState } from '../fiscalYearClosingApi';
import { ClosingLinesTable } from '../components/ClosingLinesTable';
import { ClosingLineDescriptions } from '../components/ClosingLineDescriptions';

interface Props {
  state: ClosingState;
}

/**
 * Step 5: the ending entry, mirrored, opens the next fiscal year; posting
 * it closes this year.
 */
export const BeginningStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openTab } = useTabManager();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const [postBeginning, { isLoading: posting }] = usePostBeginningMutation();

  const preview = state.beginning;
  if (!preview) return null;
  const nextYear = preview.next_fiscal_year;

  const open = (pageId: string, title: string, path: string) => {
    const full = `/app/organizations/${orgId}/${path}`;
    openTab(pageId, title, full);
    navigate(full);
  };

  const handlePost = async () => {
    const ok = await confirm({
      title: tAccounting('closing.beginning.postTitle'),
      message: tAccounting('closing.beginning.postMessage', { name: state.fiscal_year.name, next: nextYear?.name, date: preview.date }),
      confirmText: tAccounting('closing.beginning.post'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await postBeginning({ organizationId: orgId, fiscalYearId: state.fiscal_year.id }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      dispatch(fiscalYearsApi.util.invalidateTags(['FiscalYear']));
      showSuccess(tAccounting('closing.beginning.posted', { name: state.fiscal_year.name }));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {nextYear
          ? tAccounting('closing.beginning.intro', { next: nextYear.name, date: preview.date })
          : tAccounting('closing.beginning.blockers.next_fiscal_year_missing')}
      </Typography>

      {preview.blockers.length > 0 && (
        <Alert severity="error">
          <AlertTitle>{tAccounting('closing.beginning.blockedTitle')}</AlertTitle>
          {preview.blockers.map((blocker) => (
            <Box key={blocker} sx={{ mb: 0.5 }}>
              <Typography variant="body2">{tAccounting(`closing.beginning.blockers.${blocker}`, { next: nextYear?.name })}</Typography>
              {blocker === 'manual_beginning_entries' && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {preview.manual_beginning_entries.map((entry) => (
                    <Link key={entry.id} component="button" variant="body2"
                      onClick={() => open('journal-entry-edit', tAccounting('journalEntryTabTitle', { ref: entry.ref || entry.id }),
                        `accounting/journal-entries/${entry.id}`)}>
                      #{entry.no} ({entry.date})
                    </Link>
                  ))}
                </Box>
              )}
              {blocker === 'next_year_permanent_revaluations' && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {preview.permanent_revaluations.map((revaluation) => (
                    <Link key={revaluation.id} component="button" variant="body2"
                      onClick={() => open('currency-revaluation', tAccounting('revaluations.tabTitle', { date: revaluation.as_of_date }),
                        `accounting/currency-revaluations/${revaluation.id}`)}>
                      {revaluation.as_of_date}
                    </Link>
                  ))}
                </Box>
              )}
              {blocker === 'next_fiscal_year_missing' && (
                <Button size="small" onClick={() => open('fiscal-years', t('menu.fiscalYears'), 'fiscal-years')}>
                  {tAccounting('closing.readiness.createNextYear')}
                </Button>
              )}
            </Box>
          ))}
        </Alert>
      )}

      {preview.lines.length === 0 ? (
        <Alert severity="info">{tAccounting('closing.beginning.nothingToCarry')}</Alert>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {tAccounting('closing.beginning.linesTitle', { count: preview.lines.length })}
          </Typography>
          <ClosingLinesTable orgId={orgId} lines={preview.lines} total={preview.total} />
        </Box>
      )}

      <ClosingLineDescriptions
        state={state}
        date={preview.date ?? ''}
        nextFiscalYearName={nextYear?.name}
        kinds={[{ kind: 'beginning', sample: preview.lines[0] }]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {!preview.postable && (
          <Typography variant="body2" color="text.secondary">{tAccounting('closing.tempClosing.resolveProblems')}</Typography>
        )}
        <Button variant="contained" onClick={handlePost} disabled={posting || !preview.postable}
          startIcon={posting ? <CircularProgress size={16} color="inherit" /> : null}>
          {tAccounting('closing.beginning.post')}
        </Button>
      </Box>
    </Box>
  );
};
