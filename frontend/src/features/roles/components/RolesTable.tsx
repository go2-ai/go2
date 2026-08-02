import { useState, useMemo, useEffect } from 'react';
import {
  Paper,
  Box,
  TextField,
  InputAdornment,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Role } from '../rolesApi';
import { useDeleteRoleMutation, useUpdateRoleMutation } from '../rolesApi';
import { useConfirm } from '../../../contexts/confirmContext';
import { useToast } from '../../../contexts/ToastContext';

interface RolesTableProps {
  roles?: Role[];
  organizationId: number;
  onRowClick: (role: Role) => void;
  onAddChildRole: (parentId: number) => void;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

// Extend Role with tree-specific properties
interface RoleTreeNode extends Role {
  level: number;
  children?: RoleTreeNode[];
  isExpanded?: boolean;
  isVisible?: boolean;
}

export const RolesTable = ({
  roles,
  organizationId,
  onRowClick,
  onAddChildRole,
  isLoading,
  error,
  onRetry,
}: RolesTableProps) => {
  const { t } = useTranslation('shared');
  const { t: tRoles } = useTranslation('roles');

  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRoleForMenu, setSelectedRoleForMenu] = useState<Role | null>(null);

  const [deleteRole] = useDeleteRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const confirm = useConfirm();
  const { showSuccess, showError } = useToast();

  // Auto-expand all nodes when roles change (default expanded)
  useEffect(() => {
    if (roles && roles.length > 0) {
      const allIds = new Set(roles.map((r) => r.id));
      setExpandedNodes(allIds);
    }
  }, [roles]);

  // Auto-expand after adding a child role
  useEffect(() => {
    if (roles && roles.length > 0) {
      const allIds = new Set(roles.map((r) => r.id));
      setExpandedNodes((prev) => new Set([...prev, ...allIds]));
    }
  }, [roles]);

  const handleDelete = async () => {
    if (!selectedRoleForMenu) return;

    const confirmed = await confirm({
      title: tRoles('deleteRoleTitle'),
      message: tRoles('deleteRoleMessage', { name: selectedRoleForMenu.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!confirmed) {
      setMenuAnchorEl(null);
      return;
    }

    try {
      await deleteRole({
        organizationId: organizationId.toString(),
        id: selectedRoleForMenu.id,
      }).unwrap();
      showSuccess(tRoles('deleteSuccess'));
    } catch (error: any) {
      console.error('Failed to delete role:', error);
      showError(error?.data?.errors?.[0] || tRoles('deleteFailed'));
    }
    setMenuAnchorEl(null);
  };

  const handleToggleActive = async () => {
    if (!selectedRoleForMenu) return;

    try {
      await updateRole({
        organizationId: organizationId.toString(),
        id: selectedRoleForMenu.id,
        data: { active: !selectedRoleForMenu.active },
      }).unwrap();
      showSuccess(
        selectedRoleForMenu.active ? tRoles('roleDeactivated') : tRoles('roleActivated')
      );
    } catch (error: any) {
      console.error('Failed to toggle role status:', error);
      showError(error?.data?.errors?.[0] || tRoles('toggleFailed'));
    }
    setMenuAnchorEl(null);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, role: Role) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedRoleForMenu(role);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRoleForMenu(null);
  };

  // Toggle expand/collapse for a node
  const toggleExpand = (roleId: number) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  // ✅ Build tree structure with search applied - RECURSIVE APPROACH
  const treeData = useMemo(() => {
    if (!roles) return [];

    // First, create a map for quick lookups
    const roleMap = new Map<number, RoleTreeNode>();
    roles.forEach((role) => {
      roleMap.set(role.id, {
        ...role,
        level: 0,
        children: [],
        isExpanded: true,
        isVisible: true,
      });
    });

    // ✅ Recursive function to build tree from a parent node
    const buildTree = (parentId: number | null, level: number): RoleTreeNode[] => {
      const result: RoleTreeNode[] = [];

      // Find all roles with this parent_id
      const children = roles.filter((role) => role.parent_id === parentId);

      // Sort children by name for consistent ordering
      children.sort((a, b) => a.id - b.id);

      for (const child of children) {
        const node = roleMap.get(child.id)!;
        node.level = level;

        // Recursively build children
        const grandchildren = buildTree(child.id, level + 1);
        if (grandchildren.length > 0) {
          node.children = grandchildren;
        }

        result.push(node);
      }

      return result;
    };

    // Start from root nodes (parent_id is null)
    const roots = buildTree(null, 0);

    // If search is active, filter visible nodes
    if (globalSearch !== '') {
      const searchTerm = globalSearch.toLowerCase();
      const matchingIds = new Set<number>();
      const ancestorIds = new Set<number>();

      // Find matching roles
      roles.forEach((role) => {
        const matches =
          role.name.toLowerCase().includes(searchTerm) ||
          (role.description?.toLowerCase() || '').includes(searchTerm) ||
          (role.department?.name?.toLowerCase() || '').includes(searchTerm) ||
          (role.member?.name?.toLowerCase() || '').includes(searchTerm);

        if (matches) {
          matchingIds.add(role.id);
          // Add all ancestors
          let current = role;
          while (current.parent_id) {
            const parent = roles.find((r) => r.id === current.parent_id);
            if (parent) {
              ancestorIds.add(parent.id);
              current = parent;
            } else {
              break;
            }
          }
        }
      });

      const visibleIds = new Set([...matchingIds, ...ancestorIds]);



      // Mark visibility recursively
      const markVisibility = (nodes: RoleTreeNode[]): RoleTreeNode[] => {
        return nodes.filter((node) => {
          node.isVisible = visibleIds.has(node.id);
          node.isExpanded = true;
          if (node.children && node.children.length > 0) {
            node.children = markVisibility(node.children);
          }
          return node.isVisible;
        });
      };



      return markVisibility(roots);
    }

    // No search - show all nodes, set expansion state
    const setVisibility = (nodes: RoleTreeNode[]) => {
      for (const node of nodes) {
        node.isVisible = true;
        node.isExpanded = expandedNodes.has(node.id);
        if (node.children && node.children.length > 0) {
          setVisibility(node.children);
        }
      }
    };
    setVisibility(roots);

    return roots;
  }, [roles, globalSearch, expandedNodes]);

  // Flat list of visible rows for DataGrid
  const visibleRows = useMemo(() => {
    const flatten = (nodes: RoleTreeNode[]): RoleTreeNode[] => {
      let result: RoleTreeNode[] = [];
      for (const node of nodes) {
        if (node.isVisible) {
          result.push(node);
          if (node.children && node.isExpanded) {
            result = result.concat(flatten(node.children));
          }
        }
      }
      return result;
    };
    return flatten(treeData);
  }, [treeData]);

  const handleToggleExpand = (e: React.MouseEvent, roleId: number) => {
    e.stopPropagation();
    toggleExpand(roleId);
  };

  const columns: GridColDef<RoleTreeNode>[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 350,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<RoleTreeNode>) => {
        const hasChildren = params.row.children && params.row.children.length > 0;
        const isExpanded = params.row.isExpanded;

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              gap: 0.5,
            }}
          >
            {/* Indent based on level */}
            <Box sx={{ width: params.row.level * 24 }} />

            {/* Always render the container, even if no children */}
            <Box
              sx={{
                width: 28,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasChildren && (
                <IconButton
                  size="small"
                  onClick={(e) => handleToggleExpand(e, params.row.id)}
                  sx={{ p: 0.5 }}
                >
                  {isExpanded ? (
                    <ExpandMoreIcon fontSize="small" />
                  ) : (
                    <ChevronRightIcon fontSize="small" />
                  )}
                </IconButton>
              )}
            </Box>

            <Typography
              variant="body2"
              fontWeight={params.row.level === 0 ? 600 : 400}
            >
              {params.row.name}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'description',
      headerName: t('description'),
      width: 250,
      disableColumnMenu: true,
      valueGetter: (value: string | null) => value || '—',
    },
    {
      field: 'department',
      headerName: tRoles('department'),
      width: 180,
      disableColumnMenu: true,
      valueGetter: (value: Role['department']) => value?.name || '—',
    },
    {
      field: 'member',
      headerName: tRoles('assignedMember'),
      width: 180,
      disableColumnMenu: true,
      valueGetter: (value: Role['member']) => value?.name || '—',
    },
    {
      field: 'active',
      headerName: t('status'),
      width: 120,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<RoleTreeNode>) => (
        <Chip
          label={params.row.active ? tRoles('active') : tRoles('inactive')}
          color={params.row.active ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<RoleTreeNode>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onAddChildRole(params.row.id);
            }}
            variant="outlined"
            color="primary"
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              minWidth: 'auto',
              py: 0.5,
              px: 1,
            }}
          >
            {tRoles('addChild')}
          </Button>

          <IconButton
            size="small"
            onClick={(e) => handleMenuOpen(e, params.row)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Paper sx={{ p: 4, gap: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography>{tRoles('loadingRoles')}</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            onRetry && (
              <Button color="inherit" size="small" onClick={onRetry}>
                {tRoles('tryAgain')}
              </Button>
            )
          }
        >
          {tRoles('failedToLoadRoles')}
        </Alert>
      </Paper>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {tRoles('noRolesFound')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={tRoles('searchRoles')}
          value={globalSearch}
          onChange={(e) => {
            setGlobalSearch(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Box>

      <DataGrid
        rows={visibleRows}
        columns={columns}
        hideFooterPagination
        hideFooter
        disableRowSelectionOnClick
        disableColumnMenu
        onRowClick={(params) => onRowClick(params.row)}
        getRowClassName={(params) => {
          return !params.row.active ? 'inactive-row' : '';
        }}
        sx={{
          flexGrow: 1,
          '& .MuiDataGrid-cell:focus': { outline: 'none' },
          '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
          '& .MuiDataGrid-cell': { paddingInlineEnd: 0 },
          '& .inactive-row': {
            '& .MuiDataGrid-cell': {
              color: 'text.disabled',
            },
          },
        }}
      />

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleToggleActive}>
          {selectedRoleForMenu?.active ? tRoles('deactivate') : tRoles('activate')}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          {t('commonActions.delete')}
        </MenuItem>
      </Menu>
    </Paper>
  );
};