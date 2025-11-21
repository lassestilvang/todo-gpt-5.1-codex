import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/server/auth/session";
import { getListsByUser } from "@/server/services/list-service";
import { getLabels } from "@/server/services/label-service";
import { SidebarMobile } from "@/features/views/components/sidebar-mobile";
import { DashboardSidebar } from "@/features/views/components/dashboard-sidebar";
import { SidebarNavProvider } from "@/features/views/components/sidebar-nav-context";
import type { ViewNavItem } from "@/features/views/components/view-nav";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userId = await getCurrentUserId();
  if (!userId) {
    notFound();
  }

  const [lists, labels] = await Promise.all([
    getListsByUser(userId),
    getLabels(userId),
  ]);

  const viewItems: ViewNavItem[] = [
    {
      viewKey: "today",
      href: "/today",
      label: "Today",
      description: "Focus for the next 24h",
    },
    {
      viewKey: "next",
      href: "/next",
      label: "Next 7 days",
      description: "Plan the week ahead",
    },
    {
      viewKey: "upcoming",
      href: "/upcoming",
      label: "Upcoming",
      description: "Scheduled beyond a week",
    },
    {
      viewKey: "all",
      href: "/all",
      label: "All tasks",
      description: "Browse every task",
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="lg:w-72 lg:shrink-0 lg:sticky lg:top-8 lg:self-start">
          <SidebarMobile>
            <DashboardSidebar
              viewItems={viewItems}
              lists={lists}
              labels={labels}
            />
          </SidebarMobile>
          <div className="hidden lg:block">
            <SidebarNavProvider>
              <DashboardSidebar
                viewItems={viewItems}
                lists={lists}
                labels={labels}
              />
            </SidebarNavProvider>
          </div>
        </aside>
        <main className="flex-1 rounded-3xl border border-border/60 bg-background/95 p-6 shadow-sm lg:min-h-[calc(100vh-5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
