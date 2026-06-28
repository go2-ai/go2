import type { Tab, WorkspaceLayout } from "@/types/tabs";
import { useState } from "react";

function createTab(pageId: string, title: string): Tab {
  return { id: `${pageId}-${Date.now()}`, pageId, title };
}

export function useWorkspaceState() {
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    const defaultTab = createTab("organizations", "Organizations");
    return {
      panels: [
        {
          id: "panel-1",
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
        },
      ],
      direction: "horizontal",
      sizes: [100],
    };
  });

  return { layout, setLayout, createTab };
}
