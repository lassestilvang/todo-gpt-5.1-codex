import { Suspense } from "react";

import { getCurrentUserId } from "@/server/auth/session";
import { TaskViewContent } from "../_components/task-view-content";
import { ViewListSkeleton } from "@/features/views/components/view-list-skeleton";

export const revalidate = 0;

export default async function AllTasksViewPage() {
  const userId = await getCurrentUserId();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All tasks
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Full backlog overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Scan every task regardless of schedule to keep nothing from falling
          through.
        </p>
      </header>
      <Suspense fallback={<ViewListSkeleton />}>
        <TaskViewContent
          userId={userId}
          view="all"
          emptyLabel="No tasks recorded yet."
        />
      </Suspense>
    </div>
  );
}
