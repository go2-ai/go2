import type { AiChat, AiChatState, AiMessage } from '../../ai/types';

// Re-export the generic types so feature consumers can import
// everything from this folder.
export type { AiChat, AiChatState, AiMessage } from '../../ai/types';

// ── Proposal shapes (chart-of-accounts specific) ────────────────────────

export interface ProposalLedger {
  category: string;
  code: string;
  name: Record<string, string>;
  unexpected_balance: 'accept' | 'warn' | 'disallow';
  is_monetary: boolean;
}

export interface ProposalAccount {
  ledger: string;
  code: string;
  name: Record<string, string>;
  accepts_other_currencies: boolean;
}

export interface ProposalCategory {
  identifier: string | null;
  code: string;
  name: Record<string, string>;
  type: string;
}

export interface Proposal {
  categories: ProposalCategory[];
  ledgers: ProposalLedger[];
  accounts: ProposalAccount[];
}

export interface ProposalError {
  path: string | null;
  field: string | null;
  message: string;
}

/**
 * The concrete chat shape for the chart-of-accounts AI feature. Extends
 * the generic AiChat by narrowing `kind` and typing the state's
 * feature-specific fields.
 */
export interface ChartOfAccountsAiChat extends AiChat {
  kind: 'chart_of_accounts';
  state: ChartOfAccountsAiChatState;
}

export interface ChartOfAccountsAiChatState extends AiChatState {
  valid?: boolean;
  errors?: ProposalError[];
  latest_proposal?: unknown; // narrowed to Proposal by a runtime guard
  accepted_at?: string;
}

// ── Request / response shapes for the API slice ─────────────────────────

export interface PostMessageArgs {
  organizationId: number;
  chatId: number;
  content: string;
  attachmentIds?: number[];
}

export interface PostMessageResponse {
  status: 'processing';
  user_message_id: number;
  chat: ChartOfAccountsAiChat;
}

export interface AcceptProposalResponse {
  chat: ChartOfAccountsAiChat;
  chart: unknown;
}