import { ViewTaskList } from "@/features/views/components/view-task-list";
import { listTasksByView } from "@/server/services/task-service";

const viewToServiceMap = {
  today: "today",
  next: "next7",
  upcoming: "upcoming",
  all: "all",
} as const;

type DashboardTaskView = keyof typeof viewToServiceMap;

type TaskViewContentProps = {
  userId: string;
  view: DashboardTaskView;
  emptyLabel?: string;
};

export async function TaskViewContent({
  userId,
  view,
  emptyLabel,
}: TaskViewContentProps) {
  const tasks = await listTasksByView(userId, viewToServiceMap[view]);

  const displayTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    scheduledDate:
      task.scheduledDate instanceof Date
        ? task.scheduledDate.toISOString()
        : (task.scheduledDate ?? null),
  }));

  return <ViewTaskList tasks={displayTasks} emptyLabel={emptyLabel} />;
}

export type { DashboardTaskView };
