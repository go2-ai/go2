export interface Tab {
  id: string;
  pageId: string;
  title: string;
  pinned?: boolean;
  path?: string; // full path (incl. query) this tab should navigate to
}

export interface PanelConfig {
  id: string;
  tabs: Tab[];
  activeTabId: string;
  // Most-recently-activated tab ids in this panel, oldest → newest.
  // Used to pick a sensible "next active" tab when the active one closes.
  activationHistory: string[];
}

export interface WorkspaceLayout {
  panels: PanelConfig[];
  direction: 'horizontal' | 'vertical';
  sizes: number[];
}