import { cn } from "@/lib/utils";

export function ViewListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border/60 bg-card/40 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-3 h-3 w-64 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
