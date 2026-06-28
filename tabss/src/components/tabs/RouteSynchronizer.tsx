"use client";

import { useTabManager } from "@/hooks/tabs/use-tab-manager";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export function RouteSynchronizer() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { openTab } = useTabManager();
  const lastPathRef = useRef("");

  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    let pageId = "";
    let title = "";

    if (pathname.startsWith("/tables")) {
      pageId = "tables";
      title = "Tables";
    } else if (pathname.startsWith("/settings")) {
      pageId = "settings";
      title = "Settings";
    } else if (pathname.startsWith("/members")) {
      pageId = "members";
      title = "Members";
    } else if (pathname.startsWith("/organizations")) {
      pageId = "organizations";
      title = "Organizations";
    }

    if (pageId) {
      openTab(pageId, title);
    }
  }, [pathname, openTab]);

  return null;
}
