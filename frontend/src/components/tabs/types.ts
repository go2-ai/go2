export interface Tab {
  id: string;
  pageId: string;
  title: string;
  pinned?: boolean;
  path?: string; // NEW: full path (incl. query) this tab should navigate to
}

export interface PanelConfig {
  id: string;
  tabs: Tab[];
  activeTabId: string;
}

export interface WorkspaceLayout {
  panels: PanelConfig[];
  direction: 'horizontal' | 'vertical';
  sizes: number[];
}