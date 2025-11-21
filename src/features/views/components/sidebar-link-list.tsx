"use client";
import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useViewTransition } from "@/client/hooks/use-view-transition";
import { cn } from "@/lib/utils";
import { useSidebarNav } from "./sidebar-nav-context";

export type SidebarLinkItem = {
  href?: string;
  label: string;
  count?: number;
  color?: string | null;
  emoji?: string | null;
  actionSlot?: ReactNode;
};

interface SidebarLinkListProps {
  items: SidebarLinkItem[];
  ariaLabel: string;
}

export function SidebarLinkList({ items, ariaLabel }: SidebarLinkListProps) {
  const router = useRouter();
  const { withViewTransition } = useViewTransition();
  const { onNavigate } = useSidebarNav();

  const pathname = usePathname();
  const normalizedPath = useMemo(
    () => pathname?.replace(/\/$/, "") ?? "/",
    [pathname]
  );

  return (
    <div role="navigation" aria-label={ariaLabel} className="space-y-1">
      {items.map((item) => {
        const destination = item.href ?? normalizedPath;
        const isNavigable = Boolean(item.href);
        const isActive =
          destination !== "/"
            ? normalizedPath.startsWith(destination)
            : normalizedPath === destination;

        return (
          <div
            key={`${item.label}-${item.href ?? "noop"}`}
            className="group flex items-center gap-2"
          >
            <Link
              href={destination}
              prefetch={isNavigable}
              onClick={(event) => {
                if (!isNavigable) {
                  event.preventDefault();
                  onNavigate?.();
                  return;
                }
                event.preventDefault();
                withViewTransition(() => {
                  router.push(item.href!);
                  onNavigate?.();
                });
              }}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition hover:border-border",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.emoji ? (
                <span aria-hidden className="text-base">
                  {item.emoji}
                </span>
              ) : (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{
                    backgroundColor: item.color ?? "hsl(var(--accent))",
                  }}
                />
              )}
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {typeof item.count === "number" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
            </Link>
            {item.actionSlot ? (
              <div
                className="opacity-0 transition group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
                aria-hidden
              >
                {item.actionSlot}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
