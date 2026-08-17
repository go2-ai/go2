import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import { useTranslation } from 'react-i18next';
import type { ChartOfAccountsNode } from '../utils/buildChartOfAccountsTree';
import type { CenterType } from '../../centerTypes/centerTypesApi';

interface AccountDetailPanelProps {
  node: ChartOfAccountsNode | null;
  tree: ChartOfAccountsNode[];
  centerTypes: CenterType[];
  centerLevels: number;
  onEdit: () => void;
  onDelete: () => void;
  onChangeLog: () => void;
}

const BALANCE_TYPE_BY_IDENTIFIER: Record<string, string> = {
  CA: 'debit',
  LA: 'debit',
  EX: 'debit',
  CL: 'credit',
  LL: 'credit',
  RE: 'credit',
  OE: 'credit',
};

export const AccountDetailPanel = ({
  node,
  tree,
  centerTypes,
  centerLevels,
  onEdit,
  onDelete,
  onChangeLog,
}: AccountDetailPanelProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');

  if (!node) {
    return (
      <Paper sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography color="text.secondary">
          {tAccounting('selectNodeToView')}
        </Typography>
      </Paper>
    );
  }

  // ─── DEBUG ──────────────────────────────────────────────────────────────
  console.log('=== AccountDetailPanel Debug ===');
  console.log('Node type:', node.type);
  console.log('Node raw:', node.raw);
  console.log('centerTypes prop:', centerTypes);
  console.log('centerLevels:', centerLevels);

  const canDelete = !(node.type === 'category' && node.isSystem);

  const findNodeById = (type: string, sourceId: number): ChartOfAccountsNode | null => {
    const search = (nodes: ChartOfAccountsNode[]): ChartOfAccountsNode | null => {
      for (const n of nodes) {
        if (n.type === type && n.sourceId === sourceId) return n;
        const found = search(n.children);
        if (found) return found;
      }
      return null;
    };
    return search(tree);
  };

  const getCategoryBalanceType = (identifier: string | null): string | null => {
    if (!identifier) return null;
    return BALANCE_TYPE_BY_IDENTIFIER[identifier] ?? null;
  };

  const isBalanceSheetCategory = (identifier: string | null): boolean => {
    return ['CA', 'LA', 'CL', 'LL', 'OE'].includes(identifier ?? '');
  };

  const renderCenterTypes = (ids: number[] | null | undefined): React.ReactNode => {
    if (!ids || ids.length === 0) return '—';
    const resolved = ids
      .map((id) => centerTypes.find((c) => c.id === id))
      .filter((ct): ct is CenterType => ct !== undefined);

    if (resolved.length === 0) return '—';

    return (
      <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5 }}>
        {resolved.map((ct) => (
          <Chip key={ct.id} label={ct.name} size="small" variant="outlined" />
        ))}
      </Box>
    );
  };

  const renderField = (label: string, value: React.ReactNode) => (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );

  return (
    <Paper sx={{ height: '100%', overflow: 'auto' }}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            {node.code} — {node.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              onClick={onChangeLog}
            >
              {t('changeLog')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              {t('commonActions.edit')}
            </Button>
            {canDelete && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={onDelete}
              >
                {t('commonActions.delete')}
              </Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {renderField(tAccounting('type'),
            node.type === 'category'
              ? tAccounting('accountCategory')
              : node.type === 'ledger'
                ? tAccounting('ledger')
                : tAccounting('account')
          )}

          {renderField(tAccounting('code'),
            <Typography component="span" fontFamily="monospace">{node.code}</Typography>
          )}

          {renderField(t('name'), node.name)}

          {/* ─── Category-specific fields ─── */}
          {node.type === 'category' && (() => {
            const category = node.raw as any;
            const balanceType = getCategoryBalanceType(category.identifier);
            return (
              <>
                {category.identifier &&
                  renderField(tAccounting('identifier'),
                    <Chip label={category.identifier} size="small" variant="outlined" />
                  )
                }
                {renderField(tAccounting('system'), node.isSystem ? t('yes') : t('no'))}
                {balanceType && renderField(tAccounting('balanceType'),
                  tAccounting(balanceType)
                )}
              </>
            );
          })()}

          {/* ─── Ledger-specific fields ─── */}
          {node.type === 'ledger' && (() => {
            const ledger = node.raw as any;
            const contraNode = ledger.contra_for_id
              ? findNodeById('ledger', ledger.contra_for_id)
              : null;
            const category = findNodeById('category', ledger.account_category_id);
            const categoryIdentifier = (category?.raw as any)?.identifier;
            const balanceType = getCategoryBalanceType(categoryIdentifier ?? null);
            const isBalanceSheet = isBalanceSheetCategory(categoryIdentifier ?? null);
            return (
              <>
                {renderField(tAccounting('contraLedger'),
                  contraNode ? `${contraNode.code} — ${contraNode.name}` : '—'
                )}
                {renderField(tAccounting('unexpectedBalance'),
                  ledger.unexpected_balance
                    ? tAccounting(ledger.unexpected_balance)
                    : '—'
                )}
                {isBalanceSheet && renderField(tAccounting('isMonetary'),
                  ledger.is_monetary ? t('yes') : t('no')
                )}
                {balanceType && renderField(tAccounting('balanceType'),
                  tAccounting(balanceType)
                )}
              </>
            );
          })()}

          {/* ─── Account-specific fields ─── */}
          {node.type === 'account' && (() => {
            const account = node.raw as any;
            const contraNode = account.contra_for_id
              ? findNodeById('account', account.contra_for_id)
              : null;

            const allowedCenterTypesKeys = [
              'allowed_center_types_1',
              'allowed_center_types_2',
              'allowed_center_types_3',
              'allowed_center_types_4',
              'allowed_center_types_5',
              'allowed_center_types_6',
            ];

            return (
              <>
                {renderField(tAccounting('contraAccount'),
                  contraNode ? `${contraNode.code} — ${contraNode.name}` : '—'
                )}
                {renderField(tAccounting('acceptsOtherCurrencies'),
                  account.accepts_other_currencies ? t('yes') : t('no')
                )}
                {renderField(tAccounting('allowedCenterTypes'),
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {allowedCenterTypesKeys.slice(0, centerLevels).map((key, index) => (
                      <Box key={key}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                          {`${tAccounting('centerLevel')} ${index + 1}:`} {renderCenterTypes(account[key])}
                        </Typography>
                        
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            );
          })()}
        </Box>
      </Box>
    </Paper>
  );
};