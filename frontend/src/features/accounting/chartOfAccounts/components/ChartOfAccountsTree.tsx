import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  alpha,
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { ChartOfAccountsNode } from '../utils/buildChartOfAccountsTree';

interface ChartOfAccountsTreeProps {
  tree: ChartOfAccountsNode[];
  /**
   * When present (non-empty), the tree renders this instead of `tree`.
   * Draft nodes are visually distinct and read-only. Used by the AI
   * chart-of-accounts assistant to preview a proposal.
   */
  draftTree?: ChartOfAccountsNode[];
  selectedNode: ChartOfAccountsNode | null;
  onSelectNode: (node: ChartOfAccountsNode) => void;
  onAddLedger: (category: ChartOfAccountsNode) => void;
  onAddAccount: (ledger: ChartOfAccountsNode) => void;
  onAddCategory: () => void;
  /** Called when the user clicks "Discard draft" in the draft banner. */
  onDiscardDraft?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  category: '#bff376',
  ledger: '#9cdcd9',
  account: '#bfa6e6',
};

const TYPE_LABELS: Record<string, string> = {
  category: 'accountCategory',
  ledger: 'ledger',
  account: 'account',
};

export const ChartOfAccountsTree = ({
  tree,
  draftTree,
  selectedNode,
  onSelectNode,
  onAddLedger,
  onAddAccount,
  onAddCategory,
  onDiscardDraft,
}: ChartOfAccountsTreeProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const isDraftMode = !!draftTree && draftTree.length > 0;
  const effectiveTree = isDraftMode ? draftTree! : tree;

  const collectExpandableIds = useCallback((nodes: ChartOfAccountsNode[]): string[] => {
    const ids: string[] = [];
    nodes.forEach((node) => {
      if (node.hasChildren) {
        ids.push(node.id);
        ids.push(...collectExpandableIds(node.children));
      }
    });
    return ids;
  }, []);

  const expandableIds = useMemo(
    () => collectExpandableIds(effectiveTree),
    [effectiveTree, collectExpandableIds]
  );

  // Auto-expand all when the tree (or a new draft) appears.
  useEffect(() => {
    if (effectiveTree.length === 0) return;
    setExpandedNodes(new Set(collectExpandableIds(effectiveTree)));
  }, [effectiveTree, collectExpandableIds]);

  const isAllExpanded = expandableIds.length > 0 && expandedNodes.size === expandableIds.length;

  const handleExpandAll = () => {
    setExpandedNodes(new Set(expandableIds));
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const flattenTree = useCallback(
    (nodes: ChartOfAccountsNode[], level: number): ChartOfAccountsNode[] => {
      let result: ChartOfAccountsNode[] = [];
      for (const node of nodes) {
        result.push({ ...node, level });
        if (node.children.length > 0 && expandedNodes.has(node.id)) {
          result = result.concat(flattenTree(node.children, level + 1));
        }
      }
      return result;
    },
    [expandedNodes]
  );

  const visibleRows = useMemo(() => {
    const flattened = flattenTree(effectiveTree, 0);

    if (!searchTerm.trim()) return flattened;

    const term = searchTerm.toLowerCase();
    return flattened.filter(
      (node) =>
        node.code.toLowerCase().includes(term) ||
        node.name.toLowerCase().includes(term)
    );
  }, [effectiveTree, flattenTree, searchTerm]);

  const columns: GridColDef<ChartOfAccountsNode>[] = [
    {
      field: 'name',
      headerName: t('name'),
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<ChartOfAccountsNode>) => {
        const isDraft = !!params.row.isDraft;

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              height: '100%',
              opacity: isDraft ? 0.85 : 1,
            }}
          >
            {params.row.level > 0 && (
              <Box sx={{ width: params.row.level * 20, flexShrink: 0 }} />
            )}
            {params.row.hasChildren ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpand(params.row.id);
                }}
                sx={{ p: 0.5 }}
              >
                {expandedNodes.has(params.row.id) ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : isRtl ? (
                  <ChevronLeftIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
              </IconButton>
            ) : (
              <Box sx={{ width: 28, flexShrink: 0 }} />
            )}

            <Typography
              variant="body2"
              sx={{ ml: 1 }}
              fontWeight={params.row.level === 0 ? 600 : 400}
            >
              <Box
                component="span"
                sx={{
                  direction: 'ltr',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Tooltip title={tAccounting(TYPE_LABELS[params.row.type])}>
                  <Typography
                    component="span"
                    fontFamily="monospace"
                    fontWeight={params.row.level === 0 ? 600 : 400}
                    bgcolor={TYPE_COLORS[params.row.type]}
                    color="black"
                    sx={{
                      mr: 2,
                      py: 0.5,
                      px: 1,
                      borderRadius: 0.5,
                      ...(isDraft && {
                        outline: '1px dashed',
                        outlineColor: 'text.secondary',
                        outlineOffset: 2,
                      }),
                    }}
                  >
                    {params.row.code}
                  </Typography>
                </Tooltip>
                {params.row.name}
              </Box>
            </Typography>

            {params.row.type === 'category' && params.row.isSystem && !isDraft && (
              <Chip
                label={tAccounting('system')}
                size="small"
                color="info"
                variant="outlined"
                sx={{ ml: 1, height: 18, fontSize: '0.625rem' }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 50,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<ChartOfAccountsNode>) => {
        // Draft rows are read-only: no add-child action, no context.
        if (params.row.isDraft) return null;

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            {(params.row.type === 'category' || params.row.type === 'ledger') && (
              <Tooltip title={tAccounting('addChild')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (params.row.type === 'category') {
                      onAddLedger(params.row);
                    } else {
                      onAddAccount(params.row);
                    }
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {isDraftMode && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'warning.main',
            bgcolor: (theme) =>
              alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} color="warning.main">
                {tAccounting('aiAssistant.draftBanner')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {tAccounting('aiAssistant.draftBannerHint')}
              </Typography>
            </Box>
            {onDiscardDraft && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<CloseIcon fontSize="small" />}
                onClick={onDiscardDraft}
                sx={{ flexShrink: 0 }}
              >
                {tAccounting('aiAssistant.discardDraft')}
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6">{tAccounting('chartOfAccounts')}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={tAccounting('addAccountCategory')}>
              <span>
                <IconButton size="small" onClick={onAddCategory} disabled={isDraftMode}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={tAccounting('expandAll')}>
              <span>
                <IconButton size="small" onClick={handleExpandAll} disabled={isAllExpanded}>
                  <UnfoldMoreIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={tAccounting('collapseAll')}>
              <span>
                <IconButton size="small" onClick={handleCollapseAll} disabled={expandedNodes.size === 0}>
                  <UnfoldLessIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder={tAccounting('searchChartOfAccounts')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.3),
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.5),
            },
          },
          scrollbarWidth: 'thin',
          scrollbarColor: (theme) =>
            `${alpha(theme.palette.text.secondary, 0.3)} transparent`,
        }}
      >
        <DataGrid
          rows={visibleRows}
          columns={columns}
          hideFooterPagination
          hideFooter
          disableRowSelectionOnClick
          disableColumnMenu
          onRowClick={(params) => {
            onSelectNode(params.row);
          }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
            '& .MuiDataGrid-row:hover': {
              cursor: isDraftMode ? 'default' : 'pointer',
            },
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
            ...(selectedNode && {
              [`& .MuiDataGrid-row[data-id="${selectedNode.id}"]`]: {
                backgroundColor: 'action.selected',
              },
            }),
          }}
        />
      </Box>
    </Paper>
  );
};