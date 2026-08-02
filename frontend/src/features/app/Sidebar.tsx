// src/features/app/Sidebar.tsx

import { useTabManager } from '../../components/tabs/useTabManager';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from '@mui/material';
import {
  Dashboard,
  People,
  Business,
  Assignment,
  Group
} from '@mui/icons-material';

const drawerWidth = 280;

export function Sidebar() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();

  const handleNavigation = (pageId: string, title: string, path: string) => {
    // This now always creates a new tab (we modified openTab to always create)
    openTab(pageId, title);
    // Navigate to the route
    navigate(`/app/organizations/${organizationId}${path}`);
  };

  const menuItems = [
    {
      pageId: 'dashboard',
      title: 'Dashboard',
      icon: <Dashboard />,
      path: '',
    },
    {
      pageId: 'members',
      title: 'Members',
      icon: <People />,
      path: '/members',
    },
    {
      pageId: 'departments',
      title: 'Departments',
      icon: <Business />,
      path: '/departments',
    },
    {
      pageId: 'roles',  // Add this
      title: 'Roles',
      icon: <Assignment />,
      path: '/roles',
    },
    {
      pageId: 'groups',
      title: 'Groups',
      icon: <Group />,
      path: '/groups',
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.pageId} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.pageId, item.title, item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}