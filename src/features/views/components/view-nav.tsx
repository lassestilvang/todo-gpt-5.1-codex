"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { useViewTransition } from "@/client/hooks/use-view-transition";
import { cn } from "@/lib/utils";

export type ViewKey = "today" | "next" | "upcoming" | "all";

const VIEW_ICONS: Record<ViewKey, LucideIcon> = {
  today: CalendarCheck2,
  next: CalendarDays,
  upcoming: CalendarClock,
  all: ListChecks,
};

export type ViewNavItem = {
  viewKey: ViewKey;
  href: string;
  label: string;
  description?: string;
  count?: number;
};

export function ViewNav({ items }: { items: ViewNavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { withViewTransition } = useViewTransition();

  const normalizedPath = useMemo(
    () => pathname?.replace(/\/$/, "") ?? "/",
    [pathname]
  );

  return (
    <nav aria-label="Primary views" className="space-y-1">
      {items.map((item) => {
        const Icon = VIEW_ICONS[item.viewKey];
        const isActive =
          normalizedPath === item.href ||
          (item.href !== "/" && normalizedPath.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={(event) => {
              event.preventDefault();
              withViewTransition(() => router.push(item.href));
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition hover:border-border",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="flex-1 text-left">
              <span className="font-medium leading-tight block">
                {item.label}
              </span>
              {item.description ? (
                <span className="block text-xs text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
            <AnimatePresence initial={false}>
              {typeof item.count === "number" ? (
                <motion.span
                  key={`${item.href}-${item.count}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                  aria-label={`${item.count} tasks`}
                >
                  {item.count}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );
}
