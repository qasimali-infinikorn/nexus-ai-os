"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

type ShellLayout = {
  sidebarCollapsed: boolean;
  contextPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
};

const ShellLayoutContext = createContext<ShellLayout | null>(null);

const SIDEBAR_KEY = "nexus_sidebar";
const RAIL_KEY = "nexus_rail";

function applyShellAttrs(sidebarCollapsed: boolean, contextPanelOpen: boolean) {
  const root = document.documentElement;
  if (sidebarCollapsed) {
    root.setAttribute("data-sidebar", "collapsed");
  } else {
    root.removeAttribute("data-sidebar");
  }
  if (contextPanelOpen) {
    root.removeAttribute("data-rail");
  } else {
    root.setAttribute("data-rail", "hidden");
  }
}

export function ShellLayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    const railOpen = localStorage.getItem(RAIL_KEY) !== "hidden";
    applyShellAttrs(collapsed, railOpen);
    startTransition(() => {
      setSidebarCollapsed(collapsed);
      setContextPanelOpen(railOpen);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyShellAttrs(sidebarCollapsed, contextPanelOpen);
  }, [hydrated, sidebarCollapsed, contextPanelOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }, []);

  const toggleContextPanel = useCallback(() => {
    setContextPanelOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RAIL_KEY, next ? "open" : "hidden");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      contextPanelOpen,
      toggleSidebar,
      toggleContextPanel
    }),
    [sidebarCollapsed, contextPanelOpen, toggleSidebar, toggleContextPanel]
  );

  return (
    <ShellLayoutContext.Provider value={value}>{children}</ShellLayoutContext.Provider>
  );
}

export function useShellLayout(): ShellLayout {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) {
    throw new Error("useShellLayout must be used within ShellLayoutProvider");
  }
  return ctx;
}
