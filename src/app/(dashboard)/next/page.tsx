import { Suspense } from "react";

import { getCurrentUserId } from "@/server/auth/session";
import { TaskViewContent } from "../_components/task-view-content";
import { ViewListSkeleton } from "@/features/views/components/view-list-skeleton";

export const revalidate = 0;

export default async function NextViewPage() {
  const userId = await getCurrentUserId();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Next 7 days
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Plan the week ahead
        </h1>
        <p className="text-sm text-muted-foreground">
          Review everything scheduled for the next seven days.
        </p>
      </header>
      <Suspense fallback={<ViewListSkeleton />}>
        <TaskViewContent
          userId={userId}
          view="next"
          emptyLabel="Nothing scheduled for the next week."
        />
      </Suspense>
    </div>
  );
}
