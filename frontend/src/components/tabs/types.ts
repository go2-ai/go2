export interface Tab {
  id: string;
  pageId: string;
  title: string;
  pinned?: boolean;
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