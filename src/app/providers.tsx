"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";

import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200} disableHoverableContent>
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
