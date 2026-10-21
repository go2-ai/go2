import type { Account } from './accountsApi';
import type { Ledger } from '../ledgers/ledgersApi';
import type { AccountingSetting } from '../settings/settingsApi';

/** Where a resolved FX gain/loss account comes from. */
export type FxAccountSource = 'account' | 'ledger' | 'settings';

export interface ResolvedFxAccount {
  accountId: number | null;
  source: FxAccountSource;
}

type Overrides = Pick<Account, 'fx_gain_account_id' | 'fx_loss_account_id'>;

/**
 * FX gain/loss accounts a revaluation uses, in the same order as the server
 * (Revaluation::FxAccountResolver): the account's override, then the
 * ledger's, then the accounting settings. Pass account: null to resolve for
 * a ledger.
 */
export const resolveFxAccounts = (
  account: Overrides | null | undefined,
  ledger: Overrides | null | undefined,
  settings: Pick<AccountingSetting, 'default_fx_gain_account_id' | 'default_fx_loss_account_id'> | null | undefined
): { gain: ResolvedFxAccount; loss: ResolvedFxAccount } => {
  const pick = (own: number | null | undefined, fromLedger: number | null | undefined, fromSettings: number | null | undefined) =>
    own ? { accountId: own, source: 'account' as const }
      : fromLedger ? { accountId: fromLedger, source: 'ledger' as const }
        : { accountId: fromSettings ?? null, source: 'settings' as const };
  return {
    gain: pick(account?.fx_gain_account_id, ledger?.fx_gain_account_id, settings?.default_fx_gain_account_id),
    loss: pick(account?.fx_loss_account_id, ledger?.fx_loss_account_id, settings?.default_fx_loss_account_id),
  };
};

/** Accounts revaluations reach: monetary ledger and accepting other currencies. */
export const isRevaluable = (account: Pick<Account, 'accepts_other_currencies'>, ledger: Pick<Ledger, 'is_monetary'> | null | undefined) =>
  !!ledger?.is_monetary && account.accepts_other_currencies;
