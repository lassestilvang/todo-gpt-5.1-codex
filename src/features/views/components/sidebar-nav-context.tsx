"use client";

import { createContext, ReactNode, useContext } from "react";

type SidebarNavContextValue = {
  onNavigate?: () => void;
};

const SidebarNavContext = createContext<SidebarNavContextValue>({});

export function SidebarNavProvider({
  children,
  onNavigate,
}: {
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <SidebarNavContext.Provider value={{ onNavigate }}>
      {children}
    </SidebarNavContext.Provider>
  );
}

export function useSidebarNav() {
  return useContext(SidebarNavContext);
}
