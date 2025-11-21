"use client";

import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { SidebarNavProvider } from "./sidebar-nav-context";

export function SidebarMobile({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SidebarNavProvider onNavigate={() => setOpen(false)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="flex w-full items-center gap-2 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
            Menu
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-full max-w-sm overflow-y-auto border-r bg-background"
        >
          <div className="pt-6">{children}</div>
        </SheetContent>
      </Sheet>
    </SidebarNavProvider>
  );
}
