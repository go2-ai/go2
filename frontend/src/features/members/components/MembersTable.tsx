import { useState, useMemo } from 'react';
import { 
  Paper, 
  Box, 
  TextField, 
  InputAdornment, 
  Typography, 
  IconButton, 
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { Member } from '../types';
import { MemberActionsMenu } from './MemberActionsMenu';

interface MembersTableProps {
  members?: Member[];
  organizationId: number;
  onRowClick: (member: Member) => void;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

export const MembersTable = ({ 
  members, 
  organizationId, 
  onRowClick, 
  isLoading, 
  error, 
  onRetry 
}: MembersTableProps) => {
  // ✅ ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  const { t } = useTranslation('shared');
  const { t: tMembers } = useTranslation('members');
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuMember, setMenuMember] = useState<Member | null>(null);

  // Computed values (useMemo is also a hook)
  const filteredRows = useMemo(() => {
    if (!globalSearch.trim() || !members) return members || [];
    
    const searchTerm = globalSearch.toLowerCase();
    return members.filter(member => 
      member.name.toLowerCase().includes(searchTerm) ||
      member.email.toLowerCase().includes(searchTerm) ||
      member.initial.toLowerCase().includes(searchTerm)
    );
  }, [members, globalSearch]);

  // Event handlers (not hooks, these are fine after conditional returns)
  const handleActionsIconClick = (e: React.MouseEvent<HTMLElement>, member: Member) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuMember(member);
  };

  const handleCloseActionsMenu = () => {
    setAnchorEl(null);
    setMenuMember(null);
  };

  // ✅ Column definition - NOT a hook, just a regular variable
  // But it uses useMemo internally for renderCell? 
  // The column definition is fine here because it's not called conditionally
  const columns: GridColDef<Member>[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 200,
      renderCell: (params: GridRenderCellParams<Member>) => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: params.row.color || '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: (theme) => theme.palette.getContrastText(params.row.color || '#4F46E5'),
              fontWeight: 'bold',
              fontSize: '0.875rem',
              boxShadow: params.row.org_admin 
                ? '0 0 0 3px gold, 0 0 0 6px rgba(255, 215, 0, 0.2), 0 0 12px 8px rgba(255, 215, 0, 0.1)' 
                : 'none'
            }}
          >
            {params.row.initial}
          </Box>
          <Typography variant="body2">{params.row.name}</Typography>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: t('email'),
      width: 250,
    },
    {
      field: 'status',
      headerName: t('status'),
      width: 150,
      renderCell: (params: GridRenderCellParams<Member>) => {
        const member = params.row;
        
        if (member.status === 'joined') {
          return <Chip label={tMembers('joined')} color="success" size="small" variant="filled" />;
        } else if (member.status === 'invited') {
          return <Chip label={tMembers('invited')} color="warning" size="small" variant="outlined" />;
        } else if (member.status === 'archived') {
          return <Chip label={tMembers('archived')} color="secondary" size="small" variant="outlined" />;
        } else {
          return <Chip label={tMembers('notInvited')} color="default" size="small" variant="outlined" />;
        }
      }
    },
    {
      field: 'joined_at',
      headerName: tMembers('joinedAt'),
      width: 180,
      valueFormatter: (value: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString();
      },
    },
    {
      field: 'invited_at',
      headerName: tMembers('invitedAt'),
      width: 180,
      valueFormatter: (value: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString();
      },
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Member>) => (
        <Tooltip title={tMembers('moreOptions')}>
          <IconButton
            size="small"
            onClick={(e) => handleActionsIconClick(e, params.row)}
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      ),
    }
  ];

  // ✅ NOW conditional returns - AFTER all hooks have been called
  // Loading state
  if (isLoading) {
    return (
      <Paper sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ ms: 2 }}>{tMembers('loadingMembers')}</Typography>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            onRetry && (
              <Button color="inherit" size="small" onClick={onRetry}>
                {tMembers('tryAgain')}
              </Button>
            )
          }
        >
          {tMembers('failedToLoadMembers')}
        </Alert>
      </Paper>
    );
  }

  // No data state
  if (!members || members.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {tMembers('noMembersFound')}
        </Typography>
      </Paper>
    );
  }

  // Success state - render the table
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={tMembers('searchMembers')}
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
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
        rows={filteredRows}
        columns={columns}
        hideFooterPagination
        hideFooter
        disableRowSelectionOnClick
        onRowClick={(params) => onRowClick(params.row)}
        getRowClassName={(params) => {
          return params.row.status === 'archived' ? 'archived-row' : '';
        }}
        sx={{
          flexGrow: 1,
          '& .MuiDataGrid-cell:focus': { outline: 'none' },
          '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
          '& .archived-row': {
            '& .MuiDataGrid-cell': {
              color: 'text.disabled',
            },
          },
        }}
      />
      
      <MemberActionsMenu
        anchorEl={anchorEl}
        member={menuMember}
        onClose={handleCloseActionsMenu}
        organizationId={organizationId}
      />
    </Paper>
  );
};