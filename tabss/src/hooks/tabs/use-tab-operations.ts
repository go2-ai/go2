import type { PanelConfig, Tab, WorkspaceLayout } from "@/types/tabs";
import { useCallback } from "react";

function createTab(pageId: string, title: string): Tab {
  return { id: `${pageId}-${Date.now()}`, pageId, title };
}

export function useTabOperations(
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>,
) {
  const openTab = useCallback(
    (pageId: string, title: string) => {
      setLayout((prev) => {
        // Check existing in any panel
        for (const panel of prev.panels) {
          const existing = panel.tabs.find((t) => t.pageId === pageId);
          if (existing) {
            return {
              ...prev,
              panels: prev.panels.map((p) =>
                p.id === panel.id ? { ...p, activeTabId: existing.id } : p,
              ),
            };
          }
        }
        // Add to first panel if not found
        const newTab = createTab(pageId, title);
        return {
          ...prev,
          panels: prev.panels.map((p, i) =>
            i === 0
              ? { ...p, tabs: [...p.tabs, newTab], activeTabId: newTab.id }
              : p,
          ),
        };
      });
    },
    [setLayout],
  );

  const openDuplicateTab = useCallback(
    (pageId: string, title: string) => {
      setLayout((prev) => {
        // Find all existing tabs with the same pageId across all panels
        const allTabs = prev.panels.flatMap((p) => p.tabs);
        const sameTitleTabs = allTabs.filter((t) => t.pageId === pageId);

        // Extract numbers from existing titles
        const baseTitle = title.replace(/\s*\(\d+\)$/, ""); // Remove any existing (N)
        const existingNumbers = sameTitleTabs
          .map((t) => {
            const match = t.title.match(/^.*\((\d+)\)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n) => n > 0);

        // Calculate next number
        const nextNumber =
          existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

        const newTab = createTab(pageId, `${baseTitle} (${nextNumber})`);
        return {
          ...prev,
          panels: prev.panels.map((p, i) =>
            i === 0
              ? { ...p, tabs: [...p.tabs, newTab], activeTabId: newTab.id }
              : p,
          ),
        };
      });
    },
    [setLayout],
  );

  const closeTab = useCallback(
    (tabId: string, panelId: string) => {
      setLayout((prev) => {
        const panel = prev.panels.find((p) => p.id === panelId);
        if (!panel) return prev;

        const tab = panel.tabs.find((t) => t.id === tabId);
        if (tab?.pinned) return prev;

        const newTabs = panel.tabs.filter((t) => t.id !== tabId);
        const newActiveId =
          panel.activeTabId === tabId
            ? newTabs[newTabs.length - 1]?.id || ""
            : panel.activeTabId;

        if (newTabs.length === 0 && prev.panels.length > 1) {
          const newPanels = prev.panels.filter((p) => p.id !== panelId);
          return {
            ...prev,
            panels: newPanels,
            sizes: newPanels.map(() => 100 / newPanels.length),
          };
        }

        return {
          ...prev,
          panels: prev.panels.map((p) =>
            p.id === panelId
              ? { ...p, tabs: newTabs, activeTabId: newActiveId }
              : p,
          ),
        };
      });
    },
    [setLayout],
  );

  const splitTab = useCallback(
    (
      tabId: string,
      panelId: string,
      direction: "horizontal" | "vertical" = "horizontal",
    ) => {
      setLayout((prev) => {
        const panel = prev.panels.find((p) => p.id === panelId);
        const tab = panel?.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;

        const newTab = createTab(tab.pageId, tab.title);
        const newPanel: PanelConfig = {
          id: `panel-${Date.now()}`,
          tabs: [newTab],
          activeTabId: newTab.id,
        };

        const newPanels = [...prev.panels, newPanel];
        return {
          ...prev,
          panels: newPanels,
          direction: direction,
          sizes: newPanels.map(() => 100 / newPanels.length),
        };
      });
    },
    [setLayout],
  );

  const resetLayout = useCallback(() => {
    const defaultTab = createTab("organizations", "Organizations");
    setLayout({
      panels: [
        {
          id: "panel-1",
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
        },
      ],
      direction: "horizontal",
      sizes: [100],
    });
  }, [setLayout]);

  const shareLayout = useCallback((layout: WorkspaceLayout) => {
    if (typeof window === "undefined") return "";
    const tabSummary = layout.panels
      .flatMap((p) => p.tabs.map((t) => t.pageId))
      .join(",");
    const url = new URL(window.location.href);
    url.searchParams.set("tabs", tabSummary);
    url.searchParams.set("active", layout.panels[0]?.activeTabId || "");
    return url.toString();
  }, []);

  return {
    openTab,
    openDuplicateTab,
    closeTab,
    splitTab,
    resetLayout,
    shareLayout,
  };
}
