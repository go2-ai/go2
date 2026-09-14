import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import {
  AiChatPanel,
  type AiActionBannerConfig,
  type PendingAttachment,
} from '../../ai';
import {
  useGetOrCreateChatMutation,
  useGetChatQuery,
  usePostMessageMutation,
  useAcceptProposalMutation,
} from './chartOfAccountsAiApi';
import type { Proposal, ProposalError } from './types';
import { useDocumentUpload } from '../../documents/hooks/useDocumentUpload';
import { useToast } from '../../../contexts/ToastContext';

interface ChartOfAccountsAiChatPanelProps {
  organizationId: number;
  onAccepted?: () => void;
  onProposalChange?: (proposal: Proposal | null) => void;
}

function safeProposal(raw: unknown): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<Proposal>;
  if (!Array.isArray(candidate.ledgers)) return null;
  if (!Array.isArray(candidate.accounts)) return null;

  return {
    categories: Array.isArray(candidate.categories) ? candidate.categories : [],
    ledgers: candidate.ledgers,
    accounts: candidate.accounts,
  };
}

export const ChartOfAccountsAiChatPanel: React.FC<
  ChartOfAccountsAiChatPanelProps
> = ({ organizationId, onAccepted, onProposalChange }) => {
  const { t } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [chatId, setChatId] = useState<number | null>(null);
  const [pollingInterval, setPollingInterval] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const chatRequestRef = useRef<{ orgId: number; promise: Promise<{ id: number }> } | null>(null);

  const [getOrCreate, { error: createError }] = useGetOrCreateChatMutation();
  const [postMessage] = usePostMessageMutation();
  const [acceptProposal] = useAcceptProposalMutation();

  useEffect(() => {
    let cancelled = false;

    if (!chatRequestRef.current || chatRequestRef.current.orgId !== organizationId) {
      chatRequestRef.current = {
        orgId: organizationId,
        promise: getOrCreate({ organizationId }).unwrap(),
      };
    }

    chatRequestRef.current.promise
      .then((chat) => {
        if (!cancelled) setChatId(chat.id);
      })
      .catch(() => {
        if (chatRequestRef.current?.orgId === organizationId) {
          chatRequestRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, getOrCreate]);

  const { data: chat } = useGetChatQuery(
    { organizationId, chatId: chatId! },
    { skip: chatId === null, pollingInterval },
  );

  const processing = chat?.state?.processing === true;

  useEffect(() => {
    setPollingInterval(processing ? 2000 : 0);
  }, [processing]);

  const { uploadFiles, uploading } = useDocumentUpload({
    organizationId,
    documentableType: 'AiChat',
    documentableId: chatId ?? 0,
    onUploaded: (doc) => {
      setPendingAttachments((prev) => [...prev, { id: doc.id, filename: doc.name }]);
    },
  });

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (content: string, attachmentIds: number[]) => {
    if (!chatId) return;
    try {
      await postMessage({
        organizationId,
        chatId,
        content,
        attachmentIds,
      }).unwrap();
      setPendingAttachments([]);
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || t('aiAssistant.messageFailed'));
    }
  };

  const handleAccept = async () => {
    if (!chatId) return;
    try {
      await acceptProposal({ organizationId, chatId }).unwrap();
      showSuccess(t('aiAssistant.proposalAccepted'));
      onProposalChange?.(null);
      onAccepted?.();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || t('aiAssistant.acceptFailed'));
    }
  };

  // ── Derived data ────────────────────────────────────────────────────
  const proposal = useMemo(
    () => safeProposal(chat?.state?.latest_proposal),
    [chat?.state?.latest_proposal],
  );

  const isValid = chat?.state?.valid === true;
  const isClosed = chat?.status === 'accepted' || chat?.status === 'abandoned';
  const errors: ProposalError[] = Array.isArray(chat?.state?.errors)
    ? (chat!.state!.errors as ProposalError[])
    : [];

  // Identity of "the currently proposed state" — used to tell whether
  // a proposal is NEW (should show the banner again) versus one the
  // person already dismissed via "Keep editing". Cheap to recompute;
  // avoids a deep-equal check.
  const proposalKey = useMemo(
    () => (chat?.state?.latest_proposal ? JSON.stringify(chat.state.latest_proposal) : null),
    [chat?.state?.latest_proposal],
  );

  // Tracks the proposalKey the person last dismissed via "Keep
  // editing". Reset implicitly: once the AI produces a different
  // proposal, proposalKey no longer matches this and the banner
  // reappears on its own.
  const [dismissedProposalKey, setDismissedProposalKey] = useState<string | null>(null);

  const handleKeepEditing = () => {
    setDismissedProposalKey(proposalKey);
  };

  const banner: AiActionBannerConfig | null = useMemo(() => {
    // Don't show "Proposal ready" while the assistant is actively
    // working on the NEXT turn — the currently-stored proposal may be
    // stale (about to be replaced) or the person may be mid-edit-request.
    if (processing) return null;
    if (!isValid || !proposal || isClosed) return null;
    if (dismissedProposalKey !== null && dismissedProposalKey === proposalKey) return null;

    const ledgerCount = proposal.ledgers.length;
    const accountCount = proposal.accounts.length;

    const message =
      t('aiAssistant.proposalSummary', {
        ledgers: ledgerCount,
        accounts: accountCount,
      }) +
      (errors.length > 0
        ? ` · ${t('aiAssistant.validationWarnings', { count: errors.length })}`
        : '');

    return {
      title: t('aiAssistant.proposalReady'),
      message,
      severity: 'success',
      icon: <CheckCircleIcon color="success" fontSize="small" />,
      actions: [
        {
          label: t('aiAssistant.accept'),
          onClick: handleAccept,
          variant: 'contained',
          color: 'success',
        },
        {
          label: t('aiAssistant.keepEditing'),
          onClick: handleKeepEditing,
          variant: 'outlined',
          color: 'primary',
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing, isValid, proposal, isClosed, errors.length, dismissedProposalKey, proposalKey, t]);

  useEffect(() => {
    if (!onProposalChange) return;
    if (isValid && proposal && !isClosed) {
      onProposalChange(proposal);
    } else {
      onProposalChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, proposal, isClosed]);

  if (chatId === null) {
    if (createError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">{t('aiAssistant.notAvailable')}</Alert>
        </Box>
      );
    }
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!chat) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <AiChatPanel
        messages={chat.messages ?? []}
        processing={processing}
        emptyStateLabel={t('aiAssistant.emptyState')}
        thinkingLabel={t('aiAssistant.thinking')}
        inputDisabled={processing}
        inputPlaceholder={t('aiAssistant.typeMessage')}
        sendTooltip={t('aiAssistant.send')}
        attachTooltip={t('aiAssistant.attachFiles')}
        onSend={handleSend}
        onPickFiles={handlePickFiles}
        uploading={uploading}
        attachments={pendingAttachments}
        onRemoveAttachment={handleRemoveAttachment}
        banner={banner}
        closedFooter={isClosed ? t('aiAssistant.chatClosed') : undefined}
      />
    </>
  );
};