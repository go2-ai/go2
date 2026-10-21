import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ClosingLine } from '../fiscalYearClosingApi';
import { formatAmount, useClosingLabels } from '../useClosingLabels';

interface Props {
  orgId: number;
  lines: ClosingLine[];
  /** Total debit (= total credit) of the entry. */
  total: string;
  /** Lines on this account (e.g. the closing target) are highlighted. */
  highlightAccountId?: number;
}

/** Preview of a closing entry's lines. */
export const ClosingLinesTable = ({ orgId, lines, total, highlightAccountId }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { mainDigits, mainCurrencyId, accountLabel, centerLabel, centerLevels, currencyAbr, currencyDigits } = useClosingLabels(orgId);
  const levels = Array.from({ length: centerLevels }, (_, i) => i);

  return (
    <TableContainer sx={{ maxHeight: 420 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{tAccounting('revaluations.account')}</TableCell>
            {levels.map((i) => (
              <TableCell key={i}>{tAccounting('revaluations.centerLevel', { level: i + 1 })}</TableCell>
            ))}
            <TableCell>{tAccounting('revaluations.currency')}</TableCell>
            <TableCell align="right">{tAccounting('closing.tempClosing.currencyAmount')}</TableCell>
            <TableCell align="right">{tAccounting('closing.tempClosing.debit')}</TableCell>
            <TableCell align="right">{tAccounting('closing.tempClosing.credit')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={index} sx={line.account_id === highlightAccountId ? { bgcolor: 'action.hover' } : undefined}>
              <TableCell>{accountLabel(line.account_id)}</TableCell>
              {levels.map((i) => <TableCell key={i}>{centerLabel(line.center_ids[i])}</TableCell>)}
              <TableCell>{currencyAbr(line.currency_id)}</TableCell>
              <TableCell align="right">
                {line.currency_id !== mainCurrencyId && Number(line.currency_amount) !== 0
                  ? formatAmount(line.currency_amount, currencyDigits(line.currency_id))
                  : ''}
              </TableCell>
              <TableCell align="right">{Number(line.debit) !== 0 ? formatAmount(line.debit, mainDigits) : ''}</TableCell>
              <TableCell align="right">{Number(line.credit) !== 0 ? formatAmount(line.credit, mainDigits) : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3 + centerLevels}>{tAccounting('closing.tempClosing.total')}</TableCell>
            <TableCell align="right">{formatAmount(total, mainDigits)}</TableCell>
            <TableCell align="right">{formatAmount(total, mainDigits)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
};
