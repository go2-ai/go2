import type { Proposal } from '../types';
import type { AccountCategory } from '../../accountCategories/accountCategoriesApi';
import type {
  ChartOfAccountsNode,
  ChartNodeType,
} from '../../chartOfAccounts/utils/buildChartOfAccountsTree';

/**
 * Converts a Proposal (from the AI chat's state.latest_proposal) into
 * the same tree shape the real Chart of Accounts page uses, so the tree
 * component can render it without any special-case logic beyond the
 * `isDraft` flag.
 *
 * IMPORTANT: `proposal.categories` only ever contains CUSTOM ("other")
 * categories — per ContextBuilder's own system prompt, the assistant is
 * told NOT to redeclare the nine system categories (CA, LA, CL, LL, OE,
 * RE, CO, EX, ...) because they already exist for every organization.
 * A ledger's `category` field, however, references those system
 * categories by identifier constantly (e.g. "CA", "EX"). If we only
 * seed the lookup table from `proposal.categories`, every ledger whose
 * parent is a system category fails to resolve, gets orphaned (no
 * `parent.children.push`), and the returned tree ends up empty for any
 * typical proposal. That was the original bug — the fix is to seed the
 * lookup with the org's real, already-loaded system categories first,
 * then let the proposal's custom categories layer on top.
 *
 * Draft nodes use synthetic ids and a sourceId of -1 (except the seeded
 * system categories, which reuse the org's real category id/code so
 * lookups by identifier keep working) — they don't correspond to
 * persisted ledgers/accounts. Interactions that assume a real id
 * (select, edit, delete, add-child, drag) are disabled by the tree when
 * it detects `isDraft === true` on the node.
 *
 * @param proposal          The AI's latest validated proposal.
 * @param existingCategories The organization's real account categories
 *                            (from useGetAccountCategoriesQuery). Always
 *                            available even when the chart is otherwise
 *                            empty, since the nine system categories are
 *                            created for every organization up front.
 */
export function buildDraftTree(
  proposal: Proposal,
  existingCategories: AccountCategory[] = []
): ChartOfAccountsNode[] {
  const categoryNodesByIdentifier: Record<string, ChartOfAccountsNode> = {};
  const categoryNodes: ChartOfAccountsNode[] = [];

  // ── Seed with the org's existing SYSTEM categories ───────────────────
  // These won't appear in proposal.categories at all for a typical
  // proposal, but ledgers reference them by identifier regardless.
  existingCategories
    .filter((c) => c.identifier !== null)
    .forEach((cat) => {
      const node: ChartOfAccountsNode = {
        id: `draft-category-${cat.identifier}`,
        type: 'category' as ChartNodeType,
        level: 0,
        code: cat.code,
        name: cat.name,
        sourceId: cat.id,
        isSystem: true,
        hasChildren: false,
        children: [],
        isDraft: true,
        raw: cat,
      };
      categoryNodesByIdentifier[cat.identifier as string] = node;
      categoryNodes.push(node);
    });

  // ── Overlay any CUSTOM categories the proposal declares ──────────────
  proposal.categories.forEach((cat) => {
    const ref = cat.identifier ?? cat.code;
    const node: ChartOfAccountsNode = {
      id: `draft-category-${ref}`,
      type: 'category' as ChartNodeType,
      level: 0,
      code: cat.code,
      name: pickName(cat.name),
      sourceId: -1,
      isSystem: cat.identifier !== null,
      hasChildren: false,
      children: [],
      isDraft: true,
      raw: cat as unknown as ChartOfAccountsNode['raw'],
    };
    categoryNodesByIdentifier[ref] = node;
    categoryNodes.push(node);
  });

  // ── Ledgers ─────────────────────────────────────────────────────────
  const ledgerNodesByRef: Record<string, ChartOfAccountsNode> = {};
  proposal.ledgers.forEach((ledger) => {
    const parent = categoryNodesByIdentifier[ledger.category];
    const ref = `${ledger.category}.${ledger.code}`;
    const fullCode = parent ? `${parent.code}${ledger.code}` : ledger.code;

    const node: ChartOfAccountsNode = {
      id: `draft-ledger-${ref}`,
      type: 'ledger' as ChartNodeType,
      level: 1,
      code: fullCode,
      name: pickName(ledger.name),
      sourceId: -1,
      isSystem: false,
      hasChildren: false,
      children: [],
      isDraft: true,
      raw: ledger as unknown as ChartOfAccountsNode['raw'],
    };
    ledgerNodesByRef[ref] = node;

    if (parent) {
      parent.children.push(node);
      parent.hasChildren = true;
    }
  });

  // ── Accounts ────────────────────────────────────────────────────────
  proposal.accounts.forEach((account) => {
    const parent = ledgerNodesByRef[account.ledger];
    const fullCode = parent ? `${parent.code}${account.code}` : account.code;

    const node: ChartOfAccountsNode = {
      id: `draft-account-${account.ledger}.${account.code}`,
      type: 'account' as ChartNodeType,
      level: 2,
      code: fullCode,
      name: pickName(account.name),
      sourceId: -1,
      isSystem: false,
      hasChildren: false,
      children: [],
      isDraft: true,
      raw: account as unknown as ChartOfAccountsNode['raw'],
    };

    if (parent) {
      parent.children.push(node);
      parent.hasChildren = true;
    }
  });

  return categoryNodes;
}

/**
 * Picks a display name from a `{ locale: string }` map. Prefers the
 * current i18n language if present, otherwise falls back to the first
 * available entry. Returns an empty string if the map is empty.
 */
function pickName(name: Record<string, string>): string {
  if (!name) return '';
  const current = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  return name[current] ?? Object.values(name)[0] ?? '';
}