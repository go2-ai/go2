import { Alert, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetAccountsQuery } from '../accountsApi';
import type { ResolvedFxAccount } from '../fxAccounts';

type InheritedFxAccount = ResolvedFxAccount;

interface Props {
  organizationId: number;
  gain: InheritedFxAccount;
  loss: InheritedFxAccount;
  /** 'ledger' or 'account': which record the overrides below belong to. */
  level: 'ledger' | 'account';
}

/**
 * The FX gain/loss accounts revaluations use when no override is set
 * (resolved from the accounting settings and, for accounts, the ledger),
 * with a note that the overrides below are only needed for different ones.
 */
export const InheritedFxAccounts = ({ organizationId, gain, loss, level }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { data: accounts = [] } = useGetAccountsQuery(organizationId, { skip: !organizationId });

  const row = (kind: 'gain' | 'loss', inherited: InheritedFxAccount) => {
    const account = inherited.accountId ? accounts.find((a) => a.id === inherited.accountId) : undefined;
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ minWidth: 120 }}>{tAccounting(`closingSettings.inherited.${kind}`)}</Typography>
        <Typography variant="body2" fontWeight={600}>
          {account ? `${account.full_code} - ${account.name}` : tAccounting('closingSettings.inherited.notSet')}
        </Typography>
        {account && (
          <Typography variant="body2" color="text.secondary">
            ({tAccounting(`closingSettings.inherited.from.${inherited.source}`)})
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Alert severity="info" variant="outlined">
      <Typography variant="body2" sx={{ mb: 0.5 }}>{tAccounting(`closingSettings.inherited.intro.${level}`)}</Typography>
      {row('gain', gain)}
      {row('loss', loss)}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {tAccounting(`closingSettings.inherited.overrideHint.${level}`)}
      </Typography>
    </Alert>
  );
};
