// Generic AI chat types shared by every AI feature in the app.
//
// Nothing in this file knows what a chart of accounts is. Feature-specific
// types live in each feature's own folder (e.g. features/accounting/
// chartOfAccountsAi/types.ts) and extend or wrap these.

export type AiChatStatus = 'open' | 'accepted' | 'abandoned';

export type AiMessageRole = 'user' | 'assistant' | 'tool';

/**
 * The generic chat shape. The `kind` is the feature discriminator the
 * backend uses (e.g. "chart_of_accounts"). Feature-specific state is
 * tucked into `state` — the generic layer only knows it's an open
 * key/value bag with an optional `processing` flag.
 */
export interface AiChat {
  id: number;
  kind: string;
  status: AiChatStatus;
  state: AiChatState;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: AiMessage[];
}

/**
 * The generic subset of chat state that every AI feature shares.
 * Feature-specific keys are preserved via the index signature.
 */
export interface AiChatState {
  processing?: boolean;
  processing_started_at?: string;
  processing_finished_at?: string;
  [key: string]: unknown;
}

export interface AiMessageSender {
  id: number;
  name: string;
  initial: string;
  color: string;
}

export interface AiMessage {
  id: number;
  role: AiMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  sender: AiMessageSender | null;
  created_at: string;
}

/**
 * A single action shown by AiActionBanner. The banner doesn't
 * interpret `variant` — it just forwards it to the MUI Button color.
 */
export interface AiActionBannerAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  disabled?: boolean;
}

/**
 * Configuration for the optional banner shown above the input area.
 * The caller supplies a title, a body, and up to N actions. The
 * generic panel doesn't care what they do.
 */
export interface AiActionBannerConfig {
  title: string;
  message?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actions?: AiActionBannerAction[];
  /** Optional icon rendered alongside the title. */
  icon?: React.ReactNode;
}