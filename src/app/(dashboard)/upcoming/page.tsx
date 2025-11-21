import { Suspense } from "react";

import { getCurrentUserId } from "@/server/auth/session";
import { TaskViewContent } from "../_components/task-view-content";
import { ViewListSkeleton } from "@/features/views/components/view-list-skeleton";

export const revalidate = 0;

export default async function UpcomingViewPage() {
  const userId = await getCurrentUserId();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upcoming
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Look beyond the horizon
        </h1>
        <p className="text-sm text-muted-foreground">
          Keep track of tasks scheduled after the next week.
        </p>
      </header>
      <Suspense fallback={<ViewListSkeleton />}>
        <TaskViewContent
          userId={userId}
          view="upcoming"
          emptyLabel="No upcoming tasks on the radar."
        />
      </Suspense>
    </div>
  );
}
