// src/features/app/Sidebar.tsx

import { useEffect, useMemo, useState } from 'react';
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
  Tooltip,
  IconButton,
  Typography,
  alpha,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useGetPermissionsQuery } from '../permissions/permissionsApi';
import { SIDEBAR_MODULES, type SidebarModule, type SidebarPageItem } from './sidebarConfig';

const RAIL_WIDTH = 68;
const PANEL_WIDTH = 220;
const EXPANDED_WIDTH = RAIL_WIDTH + PANEL_WIDTH;

// enterNextDelay defaults to 0 in MUI and governs every tooltip shown
// after the first one within the hysteresis window — set it equal to
// enterDelay so the delay is consistent on every hover, not just the first.
const TOOLTIP_ENTER_DELAY = 500;

export function Sidebar() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { openTab } = useTabManager();
  const { t, i18n } = useTranslation('shared');

  const orgId = parseInt(organizationId || '0', 10);
  const isRtl = i18n.language === 'fa' || i18n.language === 'ar';

  const [activeModuleId, setActiveModuleId] = useState<string>('administration');
  const [collapsed, setCollapsed] = useState(false);

  const { data: permissions } = useGetPermissionsQuery(
    { organizationId: orgId },
    { skip: !orgId }
  );

  const permissionCodes = useMemo(
    () => new Set((permissions ?? []).map((p) => p.code)),
    [permissions]
  );

  const visibleModules = useMemo<SidebarModule[]>(() => {
    return SIDEBAR_MODULES.map((module) => ({
      ...module,
      items: module.items.filter(
        (item) =>
          !item.requiredPermission || permissionCodes.has(item.requiredPermission)
      ),
    })).filter((module) => module.items.length > 0);
  }, [permissionCodes]);

  useEffect(() => {
    if (visibleModules.length > 0 && !visibleModules.some((m) => m.id === activeModuleId)) {
      setActiveModuleId(visibleModules[0].id);
    }
  }, [visibleModules, activeModuleId]);

  const activeModule = useMemo(
    () => visibleModules.find((m) => m.id === activeModuleId) ?? null,
    [visibleModules, activeModuleId]
  );

  const handleModuleClick = (moduleId: string) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setActiveModuleId(moduleId);
  };

  const handlePageClick = (page: SidebarPageItem) => {
    const title = t(`menu.${page.titleKey}`);
    openTab(page.pageId, title, page.path);
    navigate(`/app/organizations/${organizationId}${page.path}`);
  };

  const drawerWidth = collapsed ? RAIL_WIDTH : EXPANDED_WIDTH;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          borderRadius: 0,
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        },
      }}
    >
      <Toolbar />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Column 1: Module rail */}
        <Box
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: 'background.default',
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <List disablePadding>
            {visibleModules.map((module) => {
              const ModuleIcon = module.icon;
              const isActive = activeModule?.id === module.id;

              return (
                <ListItem key={module.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleModuleClick(module.id)}
                    disableRipple
                    sx={{
                      minHeight: 52,
                      borderRadius: 0,
                      justifyContent: 'center',
                      px: 0,
                      borderInlineStart: '2px solid',
                      borderInlineStartColor: isActive ? 'primary.main' : 'transparent',
                      transition: (theme) =>
                        theme.transitions.create(['background-color', 'border-color'], {
                          duration: theme.transitions.duration.shortest,
                        }),
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        justifyContent: 'center',
                        color: isActive ? 'text.primary' : 'text.disabled',
                        transition: (theme) =>
                          theme.transitions.create('color', {
                            duration: theme.transitions.duration.shortest,
                          }),
                      }}
                    >
                      <Tooltip
                        title={t(`menu.${module.titleKey}`)}
                        placement={isRtl ? 'left' : 'right'}
                        enterDelay={TOOLTIP_ENTER_DELAY}
                        enterNextDelay={TOOLTIP_ENTER_DELAY}
                        leaveDelay={0}
                      >

                        <ModuleIcon fontSize="small" />
                      </Tooltip>
                    </ListItemIcon>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Column 2: Page labels for active module */}
        {!collapsed && (
          <Box
            sx={{
              width: PANEL_WIDTH,
              flexShrink: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {activeModule ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    pt: 1.5,
                    pb: 1,
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {t(`menu.${activeModule.titleKey}`)}
                </Typography>
                <Divider />
                <List disablePadding>
                  {activeModule.items.map((page) => (
                    <ListItem key={page.pageId} disablePadding>
                      <ListItemButton
                        onClick={() => handlePageClick(page)}
                        disableRipple
                        sx={{
                          minHeight: 32,
                          px: 2,
                          borderRadius: 0,
                          transition: (theme) =>
                            theme.transitions.create('background-color', {
                              duration: theme.transitions.duration.shortest,
                            }),
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.05),
                          },
                        }}
                      >
                        <ListItemText
                          primary={t(`menu.${page.titleKey}`)}
                          primaryTypographyProps={{
                            fontSize: 13,
                            fontWeight: 400,
                            color: 'text.primary',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2,
                  color: 'text.secondary',
                  fontSize: 13,
                }}
              >
                {t('menu.selectModule')}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Tooltip title={collapsed ? t('menu.expand') : t('menu.collapse')}>
          <IconButton onClick={() => setCollapsed((prev) => !prev)} size="small" sx={{ borderRadius: 0 }}>
            {collapsed ? <MenuIcon fontSize="small" /> : isRtl ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
}