"use client";

import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

type ViewTask = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  scheduledDate?: string | null;
};

interface ViewTaskListProps {
  tasks: ViewTask[];
  emptyLabel?: string;
}

export function ViewTaskList({ tasks, emptyLabel }: ViewTaskListProps) {
  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-card/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {emptyLabel ?? "You are all caught up."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <motion.li
            key={task.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold leading-tight">
                  {task.title}
                </p>
                {task.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {task.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {task.scheduledDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      {format(new Date(task.scheduledDate), "EEE, MMM d")}
                    </span>
                  ) : null}
                  {task.status ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                      {task.status}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
