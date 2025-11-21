"use client";

import { ReactNode, useId } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type SidebarSectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SidebarSection({ title, action, children, className }: SidebarSectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("space-y-3 rounded-lg border border-border/60 bg-card/40 p-4", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <motion.h2
          id={headingId}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          {title}
        </motion.h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}
