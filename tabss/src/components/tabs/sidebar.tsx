import ThemeToggle from "@/components/theme/ThemeToggle";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Building2,
  Hexagon,
  Settings,
  Table as TableIcon,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const SIDEBAR_WIDTH = 64;

export function Sidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { t } = useTranslation("pages");

  const items = [
    {
      title: "Organizations",
      pageId: "organizations",
      icon: Building2,
      href: "/organizations",
    },
    {
      title: "Members",
      pageId: "members",
      icon: Users,
      href: "/members",
    },
    {
      title: "Tables",
      pageId: "tables",
      icon: TableIcon,
      href: "/tables",
    },
    {
      title: t("settings"),
      pageId: "settings",
      icon: Settings,
      href: "/settings",
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
      }}
    >
      {/* Logo */}
      <ListItem
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 2,
          color: "primary.main",
        }}
      >
        <Hexagon size={32} strokeWidth={2.5} />
      </ListItem>

      {/* Navigation Items */}
      <List sx={{ width: "100%", px: 1, py: 0 }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <ListItem key={item.pageId} disablePadding sx={{ mb: 0.5 }}>
              <Link
                to={item.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  width: "100%",
                }}
              >
                <ListItemButton
                  selected={
                    item.pageId === "dashboard"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                  }
                  sx={{
                    borderRadius: 1.5,
                    minHeight: 48,
                    justifyContent: "center",
                    px: 2,
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      "&:hover": {
                        bgcolor: "primary.dark",
                      },
                      "& .MuiListItemIcon-root": {
                        color: "inherit",
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      color: "text.secondary",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={22} />
                  </ListItemIcon>
                </ListItemButton>
              </Link>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ mt: "auto", pb: 2 }}>
        <ThemeToggle />
      </Box>
    </Drawer>
  );
}
