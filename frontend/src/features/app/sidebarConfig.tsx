// src/features/app/sidebarConfig.tsx
import type { ComponentType } from 'react';
import {
  People,
  Business,
  Assignment,
  Group,
  Lock,
  Settings,
  AccountBalance,
  CalendarMonth,
  AccountTree,
  ReceiptLong,
  AdminPanelSettings,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

export interface SidebarPageItem {
  pageId: string;
  titleKey: string;
  path: string;
  icon: SvgIconComponent;
  requiredPermission?: string;
}

export interface SidebarModule {
  id: string;
  titleKey: string;
  icon: SvgIconComponent;
  items: SidebarPageItem[];
}

export const PERMISSION_CODES = {
  ORG_ADMIN: 'Organization.admin',
  ACCOUNTING_MANAGE_SETTINGS: 'Accounting.manage_settings',
  ACCOUNTING_VIEW_SETTINGS: 'Accounting.view_settings',
  ACCOUNTING_MANAGE_CENTERS: 'Accounting.manage_centers',
  ACCOUNTING_VIEW_CENTERS: 'Accounting.view_centers',
  ACCOUNTING_MANAGE_ACCOUNTS: 'Accounting.manage_accounts',
  ACCOUNTING_VIEW_ACCOUNTS: 'Accounting.view_accounts',
  ACCOUNTING_MANAGE_JOURNAL_ENTRIES: 'Accounting.manage_journal_entries',
  ACCOUNTING_VIEW_JOURNAL_ENTRIES: 'Accounting.view_journal_entries',
  ACCOUNTING_APPROVE_JOURNAL_ENTRIES: 'Accounting.approve_journal_entries',
} as const;

export const SIDEBAR_MODULES: SidebarModule[] = [
  {
    id: 'administration',
    titleKey: 'administration',
    icon: AdminPanelSettings,
    items: [
      {
        pageId: 'members',
        titleKey: 'members',
        path: '/members',
        icon: People,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'departments',
        titleKey: 'departments',
        path: '/departments',
        icon: Business,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'roles',
        titleKey: 'roles',
        path: '/roles',
        icon: Assignment,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'groups',
        titleKey: 'groups',
        path: '/groups',
        icon: Group,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'permissions',
        titleKey: 'permissions',
        path: '/permissions',
        icon: Lock,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'fiscal-years',
        titleKey: 'fiscalYears',
        path: '/fiscal-years',
        icon: CalendarMonth,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
      {
        pageId: 'organization-settings',
        titleKey: 'settings',
        path: '/settings',
        icon: Settings,
        requiredPermission: PERMISSION_CODES.ORG_ADMIN,
      },
    ],
  },
  {
    id: 'accounting',
    titleKey: 'accounting',
    icon: AccountBalance,
    items: [
      {
        pageId: 'journal-entry',
        titleKey: 'journalEntry',
        path: '/accounting/journal-entry',
        icon: ReceiptLong,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
      },
      {
        pageId: 'journal-entries',
        titleKey: 'journalEntries',
        path: '/accounting/journal-entries',
        icon: ReceiptLong,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_VIEW_JOURNAL_ENTRIES,
      },
      {
        pageId: 'chart-of-accounts',
        titleKey: 'chartOfAccounts',
        path: '/accounting/chart-of-accounts',
        icon: AccountTree,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_VIEW_ACCOUNTS,
      },
      {
        pageId: 'centers',
        titleKey: 'centers',
        path: '/accounting/centers',
        icon: AccountBalance,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_VIEW_CENTERS,
      },
      {
        pageId: 'center-types',
        titleKey: 'centerTypes',
        path: '/accounting/center-types',
        icon: AccountTree,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_VIEW_CENTERS,
      },
      {
        pageId: 'accounting-settings',
        titleKey: 'accountingSettings',
        path: '/accounting/settings',
        icon: Settings,
        requiredPermission: PERMISSION_CODES.ACCOUNTING_VIEW_SETTINGS,
      },
    ],
  },
];