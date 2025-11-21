import { Suspense } from "react";

import { getCurrentUserId } from "@/server/auth/session";
import { TaskViewContent } from "../_components/task-view-content";
import { ViewListSkeleton } from "@/features/views/components/view-list-skeleton";

export const revalidate = 0;

export default async function TodayViewPage() {
  const userId = await getCurrentUserId();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          What matters most now
        </h1>
        <p className="text-sm text-muted-foreground">
          Prioritize tasks scheduled for the next 24 hours.
        </p>
      </header>
      <Suspense fallback={<ViewListSkeleton />}>
        <TaskViewContent
          userId={userId}
          view="today"
          emptyLabel="You are all caught up for today."
        />
      </Suspense>
    </div>
  );
}
