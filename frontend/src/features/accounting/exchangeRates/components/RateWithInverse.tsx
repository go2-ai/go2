import { Box, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatRate, inverseRate } from '../rateFormat';

interface Props {
  rate: string | number;
  /** Currency the rate is for (1 unit of it = rate × quote). */
  currency: string;
  /** Currency the rate is expressed in (usually the main currency). */
  quote: string;
  /** Extra tooltip line, e.g. the date of the rate. */
  note?: string;
}

/**
 * An exchange rate; the tooltip spells out both directions
 * (1 EUR = 1.1 USD, 1 USD = 0.90909091 EUR).
 */
export const RateWithInverse = ({ rate, currency, quote, note }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const inverse = inverseRate(rate);
  const direct = currency && quote ? tAccounting('exchangeRates.rateEquation', { from: currency, rate: formatRate(rate), to: quote }) : '';
  const reverse = inverse && currency && quote ? tAccounting('exchangeRates.rateEquation', { from: quote, rate: inverse, to: currency }) : '';
  const lines = [direct, reverse, note].filter(Boolean);
  const value = <Box component="span" sx={{ fontFamily: 'monospace' }}>{formatRate(rate)}</Box>;
  if (lines.length === 0) return value;
  return (
    <Tooltip disableInteractive title={<>{lines.map((line, i) => <div key={i}>{line}</div>)}</>}>
      {value}
    </Tooltip>
  );
};
