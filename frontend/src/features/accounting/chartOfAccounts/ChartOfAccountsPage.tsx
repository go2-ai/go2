import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Fab,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';
import { useGetAccountCategoriesQuery } from '../accountCategories/accountCategoriesApi';
import { useGetLedgersQuery } from '../ledgers/ledgersApi';
import { useGetAccountsQuery, useGetAccountQuery } from '../accounts/accountsApi';
import { useGetCenterTypesQuery } from '../centerTypes/centerTypesApi';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import { useDeleteAccountCategoryMutation } from '../accountCategories/accountCategoriesApi';
import { useDeleteLedgerMutation } from '../ledgers/ledgersApi';
import { useDeleteAccountMutation } from '../accounts/accountsApi';
import {
  buildChartOfAccountsTree,
  type ChartOfAccountsNode,
  type ChartNodeType,
} from './utils/buildChartOfAccountsTree';
import { AccountCategoryModal } from './components/AccountCategoryModal';
import { LedgerModal } from './components/LedgerModal';
import { AccountModal } from './components/AccountModal';
import { ChartOfAccountsTree } from './components/ChartOfAccountsTree';
import { AccountDetailPanel } from './components/AccountDetailPanel';
import { ChartOfAccountsAiChatPanel } from '../chartOfAccountsAi';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useTabManager } from '../../../components/tabs/useTabManager';
import type { Proposal } from '../chartOfAccountsAi/types';
import { buildDraftTree } from '../chartOfAccountsAi/utils/buildDraftTree';

export const ChartOfAccountsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { openTab } = useTabManager();

  const {
    data: categories,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useGetAccountCategoriesQuery(orgId, { skip: !orgId });
  const {
    data: ledgers,
    isLoading: isLoadingLedgers,
    refetch: refetchLedgers,
  } = useGetLedgersQuery(orgId, { skip: !orgId });
  const {
    data: accounts,
    isLoading: isLoadingAccounts,
    refetch: refetchAccounts,
  } = useGetAccountsQuery(orgId, { skip: !orgId });
  const { data: centerTypes } = useGetCenterTypesQuery(orgId, { skip: !orgId });
  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });

  const [deleteCategory] = useDeleteAccountCategoryMutation();
  const [deleteLedger] = useDeleteLedgerMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  const isLoading = isLoadingCategories || isLoadingLedgers || isLoadingAccounts;
  const centerLevels = settings?.center_levels ?? 3;

  // ─── AI availability gate ───────────────────────────────────────────────
  // The AI panel is offered only when the org is eligible:
  //   1. the org is NOT inheriting its parent's chart, and
  //   2. the org's chart is empty (no ledgers).
  // We derive this from already-loaded cache rather than probing the API.
  const aiAvailable = useMemo(() => {
    if (!settings || !ledgers) return false;
    if (settings.use_parent_org_accounts) return false;
    if (ledgers.length > 0) return false;
    return true;
  }, [settings, ledgers]);

  // Panel 3 (AI chat) open/closed state. Defaults open whenever the
  // feature is available; the person can close it and reopen it via
  // the floating toggle button.
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  // ─── UI state ───────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<ChartOfAccountsNode | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { data: selectedAccountDetail } = useGetAccountQuery(
    { organizationId: orgId, id: selectedAccountId! },
    { skip: selectedAccountId === null }
  );

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [parentCategoryForNewLedger, setParentCategoryForNewLedger] =
    useState<{ id: number; code: string } | null>(null);

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [editingLedger, setEditingLedger] = useState<any>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [parentLedgerForNewAccount, setParentLedgerForNewAccount] =
    useState<{ id: number; fullCode: string } | null>(null);

  const [draftProposal, setDraftProposal] = useState<Proposal | null>(null);

  const tree = useMemo(() => {
    if (!categories || !ledgers || !accounts) return [];
    return buildChartOfAccountsTree(categories, ledgers, accounts);
  }, [categories, ledgers, accounts]);

  const resolvedSelectedNode = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'account' && selectedAccountDetail) {
      return {
        ...selectedNode,
        raw: selectedAccountDetail,
      };
    }
    return selectedNode;
  }, [selectedNode, selectedAccountDetail]);

  const handleSelectNode = (node: ChartOfAccountsNode) => {
    setSelectedNode(node);
    if (node.type === 'account' && !node.isDraft) {
      setSelectedAccountId(node.sourceId);
    } else {
      setSelectedAccountId(null);
    }
  };

  const handleDelete = async (node: ChartOfAccountsNode) => {
    const typeLabel =
      node.type === 'category'
        ? tAccounting('accountCategory')
        : node.type === 'ledger'
          ? tAccounting('ledger')
          : tAccounting('account');

    const confirmed = await confirm({
      title: tAccounting('deleteNodeTitle', { type: typeLabel }),
      message: tAccounting('deleteNodeMessage', {
        type: typeLabel,
        code: node.code,
        name: node.name,
      }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      if (node.type === 'category') {
        await deleteCategory({ organizationId: orgId, id: node.sourceId }).unwrap();
      } else if (node.type === 'ledger') {
        await deleteLedger({ organizationId: orgId, id: node.sourceId }).unwrap();
      } else {
        await deleteAccount({ organizationId: orgId, id: node.sourceId }).unwrap();
      }

      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
        setSelectedAccountId(null);
      }
      showSuccess(tAccounting('nodeDeleted'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('deleteFailed'));
    }
  };

  const handleChangeLog = (node: ChartOfAccountsNode) => {
    const typeMap: Record<ChartNodeType, string> = {
      category: 'Accounting::AccountCategory',
      ledger: 'Accounting::Ledger',
      account: 'Accounting::Account',
    };

    const recordType = typeMap[node.type];
    const path = `/app/organizations/${orgId}/record-history?type=${recordType}&id=${node.sourceId}`;
    const name = node.name;

    setTimeout(() => {
      openTab('record-history', `History: ${name}`, path);
      navigate(path);
    }, 0);
  };

  const handleAddLedger = (category: ChartOfAccountsNode) => {
    setParentCategoryForNewLedger({ id: category.sourceId, code: category.code });
    setEditingLedger(null);
    setLedgerModalOpen(true);
  };

  const handleAddAccount = (ledger: ChartOfAccountsNode) => {
    setParentLedgerForNewAccount({ id: ledger.sourceId, fullCode: ledger.code });
    setEditingAccount(null);
    setAccountModalOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const handleEditSelected = () => {
    if (!resolvedSelectedNode) return;

    if (resolvedSelectedNode.type === 'category') {
      setEditingCategory(resolvedSelectedNode.raw);
      setCategoryModalOpen(true);
    } else if (resolvedSelectedNode.type === 'ledger') {
      setEditingLedger(resolvedSelectedNode.raw);
      setLedgerModalOpen(true);
    } else {
      setEditingAccount(resolvedSelectedNode.raw);
      setAccountModalOpen(true);
    }
  };

  const handleDeleteSelected = () => {
    if (!resolvedSelectedNode) return;
    handleDelete(resolvedSelectedNode);
  };

  const handleChangeLogSelected = () => {
    if (!resolvedSelectedNode) return;
    handleChangeLog(resolvedSelectedNode);
  };

  const draftTree = useMemo(() => {
    // buildDraftTree needs the org's real categories to resolve
    // system-category references (CA, LA, EX, ...) that the AI's
    // proposal never redeclares.
    if (!draftProposal || !categories) return undefined;
    return buildDraftTree(draftProposal, categories);
  }, [draftProposal, categories]);

  // Fired when the AI panel successfully accepts a proposal. The AI
  // chat's own RTK Query cache gets invalidated automatically, but
  // categories/ledgers/accounts live in separate API slices that
  // aren't wired to those tags — so without this, the tree keeps
  // showing pre-acceptance (empty) data until a hard refresh.
  const handleAiAccepted = useCallback(() => {
    refetchCategories();
    refetchLedgers();
    refetchAccounts();
  }, [refetchCategories, refetchLedgers, refetchAccounts]);

  const showAiPanel = aiAvailable && aiPanelOpen;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', p: 2, position: 'relative' }}>
      <Group orientation="horizontal" id="chart-of-accounts-layout">
        {/* ── Panel 1: Chart of Accounts tree ─────────────────────────── */}
        <Panel defaultSize="35" minSize="25" maxSize="60">
          <ChartOfAccountsTree
            tree={tree}
            draftTree={draftTree}
            selectedNode={resolvedSelectedNode}
            onSelectNode={handleSelectNode}
            onAddLedger={handleAddLedger}
            onAddAccount={handleAddAccount}
            onAddCategory={handleAddCategory}
            onDiscardDraft={() => setDraftProposal(null)}
          />
        </Panel>

        <Separator>
          <Box
            sx={{
              width: 4,
              height: '100%',
              backgroundColor: 'divider',
              transition: 'background-color 0.2s',
              cursor: 'col-resize',
              '&:hover': { backgroundColor: 'primary.main', opacity: 0.5 },
            }}
          />
        </Separator>

        {/* ── Panel 2: Details (always visible) ───────────────────────── */}
        <Panel defaultSize={showAiPanel ? '35' : '65'} minSize="25" maxSize="75">
          <AccountDetailPanel
            node={resolvedSelectedNode}
            tree={tree}
            centerTypes={centerTypes || []}
            centerLevels={centerLevels}
            onEdit={handleEditSelected}
            onDelete={handleDeleteSelected}
            onChangeLog={handleChangeLogSelected}
          />
        </Panel>

        {/* ── Panel 3: AI chat (closable/openable) ─────────────────────── */}
        {showAiPanel && (
          <>
            <Separator>
              <Box
                sx={{
                  width: 4,
                  height: '100%',
                  backgroundColor: 'divider',
                  transition: 'background-color 0.2s',
                  cursor: 'col-resize',
                  '&:hover': { backgroundColor: 'primary.main', opacity: 0.5 },
                }}
              />
            </Separator>

            <Panel defaultSize="30" minSize="22" maxSize="45">
              <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SmartToyIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {tAccounting('aiAssistant.tabAi')}
                    </Typography>
                  </Box>
                  <Tooltip title={t('commonActions.close')}>
                    <IconButton size="small" onClick={() => setAiPanelOpen(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ChartOfAccountsAiChatPanel
                    organizationId={orgId}
                    onAccepted={handleAiAccepted}
                    onProposalChange={setDraftProposal}
                  />
                </Box>
              </Paper>
            </Panel>
          </>
        )}
      </Group>

      {/* Floating reopen button — the only way back in once the AI
          panel is closed, since it's otherwise unmounted entirely. */}
      {aiAvailable && !aiPanelOpen && (
        <Tooltip title={tAccounting('aiAssistant.tabAi')} placement="left">
          <Fab
            size="medium"
            color="primary"
            onClick={() => setAiPanelOpen(true)}
            sx={{ position: 'absolute', bottom: 24, right: 24 }}
          >
            <SmartToyIcon />
          </Fab>
        </Tooltip>
      )}

      <AccountCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        organizationId={orgId}
        accountCategory={editingCategory}
      />

      <LedgerModal
        open={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        organizationId={orgId}
        ledger={editingLedger}
        parentCategoryId={parentCategoryForNewLedger?.id}
        parentCategoryCode={parentCategoryForNewLedger?.code}
      />

      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        organizationId={orgId}
        account={editingAccount}
        parentLedgerId={parentLedgerForNewAccount?.id}
        parentLedgerFullCode={parentLedgerForNewAccount?.fullCode}
      />
    </Box>
  );
};