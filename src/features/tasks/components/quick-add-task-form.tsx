"use client";

// ... existing code ...
import { FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createQuickTaskAction } from "@/server/actions/task-actions";

type DashboardTaskView = "today" | "next" | "upcoming" | "all";

type QuickAddTaskFormProps = {
  view: DashboardTaskView;
};

export function QuickAddTaskForm({ view }: QuickAddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) {
      setError("Enter a task title.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createQuickTaskAction({ title: trimmed, view });

      if (!result.success) {
        setError(result.error ?? "Unable to create task.");
        return;
      }

      setTitle("");
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Quick add a task..."
        className="flex-1"
        disabled={isPending}
        aria-label="Add new task"
      />
      <Button type="submit" isLoading={isPending} className="w-full sm:w-auto">
        Add task
      </Button>
      {error ? (
        <p className="text-sm text-destructive sm:ml-0">{error}</p>
      ) : null}
    </form>
  );
}
