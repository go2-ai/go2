import type { WorkspaceLayout } from "@/types/tabs";
import { useNavigate } from "@tanstack/react-router";

export function useTabNavigation(
  layout: WorkspaceLayout,
  setActiveTab: (panelId: string, tabId: string) => void,
) {
  const navigate = useNavigate();

  const handleTabChange = (panelId: string, tabId: string) => {
    // 1. Update state
    setActiveTab(panelId, tabId);

    // 2. Sync URL if main panel
    const panelIndex = layout.panels.findIndex((p) => p.id === panelId);
    if (panelIndex === 0) {
      const panel = layout.panels.find((p) => p.id === panelId);
      const tab = panel?.tabs.find((t) => t.id === tabId);

      if (tab) {
        let path = "/organizations";
        switch (tab.pageId) {
          case "tables":
            path = "/tables";
            break;
          case "settings":
            path = "/settings";
            break;
          case "members":
            path = "/members";
            break;
          case "organizations":
            path = "/organizations";
            break;
          default:
            path = "/organizations";
        }
        navigate({ to: path });
      }
    }
  };

  return { handleTabChange };
}
