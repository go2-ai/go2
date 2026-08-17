import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
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
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useTabManager } from '../../../components/tabs/useTabManager';

export const ChartOfAccountsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { openTab } = useTabManager();

  // ─── Data fetching ──────────────────────────────────────────────────────
  const { data: categories, isLoading: isLoadingCategories } =
    useGetAccountCategoriesQuery(orgId, { skip: !orgId });
  const { data: ledgers, isLoading: isLoadingLedgers } =
    useGetLedgersQuery(orgId, { skip: !orgId });
  const { data: accounts, isLoading: isLoadingAccounts } =
    useGetAccountsQuery(orgId, { skip: !orgId });
  const { data: centerTypes } = useGetCenterTypesQuery(orgId, { skip: !orgId });
  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });

  const [deleteCategory] = useDeleteAccountCategoryMutation();
  const [deleteLedger] = useDeleteLedgerMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  const isLoading = isLoadingCategories || isLoadingLedgers || isLoadingAccounts;
  const centerLevels = settings?.center_levels ?? 3;

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

  // ─── Build tree ─────────────────────────────────────────────────────────
  const tree = useMemo(() => {
    if (!categories || !ledgers || !accounts) return [];
    return buildChartOfAccountsTree(categories, ledgers, accounts);
  }, [categories, ledgers, accounts]);

  // ─── Resolve selected node with full account detail ────────────────────
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

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleSelectNode = (node: ChartOfAccountsNode) => {
    setSelectedNode(node);
    if (node.type === 'account') {
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
    setParentCategoryForNewLedger({
      id: category.sourceId,
      code: category.code,
    });
    setEditingLedger(null);
    setLedgerModalOpen(true);
  };

  const handleAddAccount = (ledger: ChartOfAccountsNode) => {
    setParentLedgerForNewAccount({
      id: ledger.sourceId,
      fullCode: ledger.code,
    });
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

  // ─── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', overflow: 'hidden', p: 2 }}>
      <Group orientation="horizontal" id="chart-of-accounts-layout">
        <Panel defaultSize="40" minSize="30" maxSize="70">
          <ChartOfAccountsTree
            tree={tree}
            selectedNode={resolvedSelectedNode}
            onSelectNode={handleSelectNode}
            onAddLedger={handleAddLedger}
            onAddAccount={handleAddAccount}
            onAddCategory={handleAddCategory} 
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
              '&:hover': {
                backgroundColor: 'primary.main',
                opacity: 0.5,
              },
            }}
          />
        </Separator>

        <Panel defaultSize="60" minSize="30" maxSize="70">
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
      </Group>

      {/* Modals */}
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