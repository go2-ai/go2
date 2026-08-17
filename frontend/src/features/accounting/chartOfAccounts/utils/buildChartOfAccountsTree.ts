import type { AccountCategory } from '../../accountCategories/accountCategoriesApi';
import type { Ledger } from '../../ledgers/ledgersApi';
import type { Account } from '../../accounts/accountsApi';

export type ChartNodeType = 'category' | 'ledger' | 'account';

export interface ChartOfAccountsNode {
  id: string;
  type: ChartNodeType;
  level: number;
  code: string;
  name: string;
  sourceId: number;
  isSystem: boolean;
  hasChildren: boolean;
  children: ChartOfAccountsNode[];
  raw: AccountCategory | Ledger | Account;
}

const naturalSort = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });

export function buildChartOfAccountsTree(
  categories: AccountCategory[],
  ledgers: Ledger[],
  accounts: Account[]
): ChartOfAccountsNode[] {
  const ledgerMap = new Map<number, Ledger[]>();
  const accountMap = new Map<number, Account[]>();

  for (const ledger of ledgers) {
    const list = ledgerMap.get(ledger.account_category_id) ?? [];
    list.push(ledger);
    ledgerMap.set(ledger.account_category_id, list);
  }

  for (const account of accounts) {
    const list = accountMap.get(account.ledger_id) ?? [];
    list.push(account);
    accountMap.set(account.ledger_id, list);
  }

  const buildAccountNode = (account: Account, fullCode: string): ChartOfAccountsNode => ({
    id: `account-${account.id}`,
    type: 'account',
    level: 2,
    code: fullCode,
    name: account.name,
    sourceId: account.id,
    isSystem: false,
    hasChildren: false,
    children: [],
    raw: account,
  });

  const buildLedgerNode = (ledger: Ledger, categoryCode: string): ChartOfAccountsNode => {
    const fullCode = `${categoryCode}${ledger.code}`;
    const children = (accountMap.get(ledger.id) ?? [])
      .slice()
      .sort((a, b) => naturalSort(a.code, b.code))
      .map((account) => buildAccountNode(account, `${fullCode}${account.code}`));

    return {
      id: `ledger-${ledger.id}`,
      type: 'ledger',
      level: 1,
      code: fullCode,
      name: ledger.name,
      sourceId: ledger.id,
      isSystem: false,
      hasChildren: children.length > 0,
      children,
      raw: ledger,
    };
  };

  const buildCategoryNode = (category: AccountCategory): ChartOfAccountsNode => {
    const children = (ledgerMap.get(category.id) ?? [])
      .slice()
      .sort((a, b) => naturalSort(a.code, b.code))
      .map((ledger) => buildLedgerNode(ledger, category.code));

    return {
      id: `category-${category.id}`,
      type: 'category',
      level: 0,
      code: category.code,
      name: category.name,
      sourceId: category.id,
      isSystem: category.identifier !== null,
      hasChildren: children.length > 0,
      children,
      raw: category,
    };
  };

  return categories
    .slice()
    .sort((a, b) => naturalSort(a.code, b.code))
    .map(buildCategoryNode);
}