# Side menu — plan for issue #8

> Two-level side menu (General / Accounting / …), RTL-safe, translated, with the
> navigation tree promoted to the single source of truth for pages.

## 1. Where we actually are

There *is* a sidebar today: `frontend/src/features/app/Sidebar.tsx` (143 lines). It is a
permanent MUI `Drawer` (280px) rendering a **flat list of 13 items** with hardcoded English
labels. So #8 is a restructure, not a greenfield build.

Gaps against the issue:

| Gap | Evidence |
| --- | --- |
| Flat list — "Accounting" is a sibling of its own children | `Sidebar.tsx` `menuItems` |
| Labels hardcoded in English | `title: 'Members'` etc. |
| No active-item highlight | `ListItemButton` has no `selected` |
| Mobile broken — drawer is `variant="permanent"` and the TopBar hamburger has **no `onClick`** | `TopBar.tsx` mobile `IconButton` |
| No collapse / expand, no persisted state | — |
| Tab titles pushed from the menu are English literals | `openTab(pageId, title, path)` |

RTL is in better shape than the issue implies. `ThemeContext` already swaps an emotion RTL
cache (`stylis-plugin-rtl`), sets `documentElement.dir`, and builds the theme with
`direction: 'rtl'`; MUI flips `Drawer anchor="left"` automatically. The issue's testing note
("go to the rails console and update the locale attribute") is stale — locale is now
user-editable in-app via the settings modal.

## 2. Decisions (locked)

- **Scope** — sidebar rewrite **plus** the navigation-config refactor (phases 1–4 below).
- **IA** — expanded: `Dashboard` standalone + four groups.
- **Labels** — nouns (`Members`), not verbs (`Manage Members`).

## 3. Target information architecture

```
Dashboard                       (standalone, ungrouped)
General
  Members · Departments · Roles · Groups · Permissions
Accounting
  Chart of Accounts · Centers · Center Types · Currencies
  Journal Entries            (slot reserved for #24)
Settings
  Organization · Accounting · Fiscal Years
History
  Record History · Permission History
```

`Currencies` and `Journal Entries` have no page yet. They are declared in the config with
`enabled: false` so they render disabled with a tooltip, or are filtered out entirely — one
line to flip when #24 lands.

## 4. The architectural point

The same page list is hardcoded in **five** places, and they have already drifted:

1. `App.tsx` — router routes
2. `features/app/Sidebar.tsx` — `menuItems`
3. `components/tabs/tabPaths.ts` — `getTabPath` switch
4. `components/tabs/PageRegistry.tsx` — `PAGE_REGISTRY`
5. `components/tabs/RouteSynchronizer.tsx` — URL→tab if/else chain

**RouteSynchronizer is missing** fiscal-years, organization settings, and all four
accounting pages. Live consequence: deep-link or hard-refresh on
`/app/organizations/1/accounting/centers` and no tab activates.

Fix: a `features/app/navigation.ts` tree that is the source of truth. The sidebar renders it;
`getTabPath` and `RouteSynchronizer` derive from it; `PAGE_REGISTRY` is keyed by the same
`pageId`. Adding a page becomes one config entry plus one route.

```ts
export interface NavLeaf {
  pageId: string;        // key into PAGE_REGISTRY
  titleKey: string;      // i18n key, namespaced: 'members:members'
  path: string;          // organization-relative: '/members'
  icon: ReactNode;
  enabled?: boolean;     // false → reserved slot (Journal Entries)
  permission?: string;   // declared now, NOT enforced yet — see §9
}

export interface NavGroup {
  groupId: string;
  titleKey: string;      // 'shared:nav.accounting'
  icon: ReactNode;
  children: NavLeaf[];
}
```

Derived helpers in the same module:

- `NAV_LEAVES` — flattened list
- `LEAF_BY_PAGE_ID` — lookup
- `getTabPath(pageId, orgId)` — replaces the switch
- `resolvePageId(pathname, orgId)` — replaces the if/else chain

`resolvePageId` must match **longest path first**, then exact-or-child:

```ts
suffix === leaf.path || suffix.startsWith(leaf.path + '/')
```

Naive `includes()` (what the current code does) breaks on sibling prefixes such as
`/accounting/centers` vs `/accounting/center-types`, while still letting a future detail
route like `/members/5/edit` resolve to the `members` page.

## 5. i18n: reference, do not duplicate

Every page label **already exists** in both `en` and `fa`, inside its feature namespace:

| Label | Key | fa |
| --- | --- | --- |
| Members | `members:members` | اعضا |
| Departments | `departments:departments` | واحد های سازمانی |
| Roles | `roles:roles` | سمت‌ها |
| Groups | `groups:groups` | گروه‌ها |
| Permissions | `permissions:permissions` | دسترسی‌ها |
| Fiscal Years | `fiscalYears:fiscalYears` | سال‌های مالی |
| Chart of Accounts | `accounting:chartOfAccounts` | نمودار حساب‌ها |
| Centers | `accounting:centers` | مراکز |
| Center Types | `accounting:centerTypes` | انواع مرکز |
| Currencies | `accounting:currencies` | ارزها |
| Accounting Settings | `accounting:accountingSettings` | تنظیمات حسابداری |
| Organization Settings | `organizations:organizationSettings` | — |

All twelve namespaces are preloaded in `i18n/index.ts`, so `t('members:members')` resolves
without extra loading. Referencing them keeps the menu label and the page heading identical
**by construction** — no drift, no re-translation.

Only genuinely new strings go into `shared.json` under a `nav` block: the four group headers
(`general`, `accounting`, `settings`, `history`) plus `dashboard`, `recordHistory`,
`permissionHistory`, `journalEntries`. Both locale files keep identical key sets (they are
symmetric today) and the existing `{"en": { … }}` wrapper format.

## 6. Component shape

```
features/app/
  navigation.ts        # config + derived helpers (no JSX beyond icons)
  Sidebar.tsx          # drawer shell, responsive variant, width
  NavGroup.tsx         # collapsible section header + <Collapse>
  NavItem.tsx          # single leaf, selected state, tooltip in rail mode
  useSidebarState.ts   # open/collapsed/expanded-groups + localStorage
```

Behaviour:

- **Independent collapse** per group (not accordion) — accordion fights you when hopping
  between General and Accounting. Expanded set persisted to
  `localStorage['sidebar-groups-<orgId>']`.
- **Auto-expand** the group containing the active route on mount, so a refresh on Centers
  opens inside Accounting.
- **Active highlight** via `resolvePageId(location.pathname)` — derived from the URL, not
  from click state, so it stays correct on back/forward and deep links.
- **Mobile** (`< md`): `variant="temporary"`, wire the dead hamburger, close on navigate.
  Desktop stays `permanent`.

## 7. Open question — what should a menu click do to tabs?

`useTabOperations.openTab` is explicitly *"Always create a new tab — no deduplication"*, and
appends a counter to the title. So clicking **Members** five times yields
`Members`, `Members (2)` … `Members (5)`.

For a browser-style tab strip that is defensible. For a side menu it is not what people
expect. Three options:

1. **Focus-or-open (recommended).** Add `openOrFocusTab(pageId)` used *only* by the sidebar:
   activate an existing tab for that `pageId` if one exists, otherwise open one. `openTab`
   keeps its current always-new behaviour for duplicate/split. Additive, no regression.
2. Keep always-new. Zero work, but the tab strip fills with duplicates.
3. Modifier-aware: plain click focuses, ctrl/cmd-click opens a second tab. Nicest, slightly
   more work, and needs a matching affordance.

Related: `openTab` always appends to `panels[0]`, so with a split workspace every menu click
lands in the first panel regardless of which panel has focus. Worth deciding whether the
menu should target the focused panel.

**This is the one item still needing a call before implementation.**

## 8. Bugs found while surveying (fixed or flagged)

- **RouteSynchronizer coverage hole** — accounting, fiscal-years and settings pages never
  activate a tab on deep-link. *Fixed by §4.*
- **Stale tab titles across locale switch** — `useTabPersistence` writes the literal title
  string into `localStorage['workspace-layout-<orgId>']`. Switching to Persian leaves the
  old English titles. *Fix:* `SortableTab` renders `t(leaf.titleKey)` from `tab.pageId` and
  keeps only the numeric suffix on the tab, instead of rendering the frozen `tab.title`.
- **Type lie** — `TabContextType` declares `updateTabTitle: (pageId, title)` but
  `useTabOperations` implements `updateTabTitle(tabId, title)`. Flag; fix if it is in reach.
- **Duplicated `drawerWidth = 280`** in both `AppLayout.tsx` and `Sidebar.tsx`, with main
  sized by `calc(100% - 280px)`. A collapsible drawer breaks that. *Fix:* drop the calc, let
  flex do it (`flexGrow: 1; minWidth: 0`) — also removes a physical-direction assumption.

## 9. Deliberately out of scope

- **Permission-gated menu items.** The client has no effective-permission set: `/me` returns
  only `id, email, first_name, last_name, locale, timezone`. Gating needs a backend change
  (expose effective permissions on `/me` or the organization payload). The `permission` field
  is declared in the config so the wiring is a one-liner later, but nothing is filtered now —
  otherwise this issue swallows a backend task.
- **Icon-rail collapse mode** and **menu search**. Both are good; both overlap issue #9's
  visual language. Separable follow-ups.
- **Tab-less mobile mode** described in `docs/UI/page_browsing.md`. Not implemented today
  either; keeping mobile scoped to "the drawer works".

## 10. Phases

| # | Phase | Files |
| --- | --- | --- |
| 1 | Nav config + i18n | `features/app/navigation.ts`, `public/locales/{en,fa}/shared.json` |
| 2 | Sidebar rewrite | `Sidebar.tsx`, `NavGroup.tsx`, `NavItem.tsx`, `useSidebarState.ts` |
| 3 | Mobile drawer | `Sidebar.tsx`, `TopBar.tsx`, `AppLayout.tsx` |
| 4 | De-duplicate | `tabPaths.ts`, `RouteSynchronizer.tsx`, `SortableTab.tsx` |

Phases 1–4 are one coherent PR: roughly 400 lines net across ~9 files, and it deletes the
`getTabPath` switch and the `RouteSynchronizer` chain outright.

## 11. Verification

No frontend test runner is configured (`frontend/package.json` has no `test` script and
`src/tests` is near-empty), so verification is manual plus static:

- `npm run build` (`tsc -b && vite build`) and `npm run lint` clean.
- Click every leaf; confirm one tab opens, the correct page renders, the item highlights.
- Hard-refresh on each URL; confirm the right tab activates and its group auto-expands —
  this is the RouteSynchronizer hole, so it is the regression test that matters.
- Switch the user locale to `fa`; confirm labels translate, the drawer moves to the right,
  chevrons mirror, and no label clips.
- Narrow to < 900px; confirm the hamburger opens the drawer and it closes on navigate.
- Toggle dark mode; check selected/hover contrast against the indigo primary.

Adding Vitest for `resolvePageId` (pure, and exactly the function with the sibling-prefix
trap) would be a cheap, high-value first frontend test — optional.
