"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListCrudSheet } from "@/features/lists/components/list-crud-sheet";
import { LabelCrudSheet } from "@/features/labels/components/label-crud-sheet";
import { SidebarLinkList, type SidebarLinkItem } from "./sidebar-link-list";
import { SidebarSection } from "./sidebar-section";
import { ViewNav, type ViewNavItem } from "./view-nav";

export type SidebarEntity = {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
};

type DashboardSidebarProps = {
  viewItems: ViewNavItem[];
  lists: SidebarEntity[];
  labels: SidebarEntity[];
};

export function DashboardSidebar({
  viewItems,
  lists,
  labels,
}: DashboardSidebarProps) {
  const listItems: SidebarLinkItem[] = lists.map((list) => ({
    href: `/lists/${list.id}`,
    label: list.name,
    emoji: list.emoji,
    color: list.color,
    actionSlot: (
      <ListCrudSheet
        list={list}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={`Edit list ${list.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
        }
      />
    ),
  }));

  const labelItems: SidebarLinkItem[] = labels.map((label) => ({
    href: `/labels/${label.id}`,
    label: label.name,
    emoji: label.emoji,
    color: label.color,
    actionSlot: (
      <LabelCrudSheet
        label={label}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={`Edit label ${label.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
        }
      />
    ),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <ViewNav items={viewItems} />
      <SidebarSection
        title="Lists"
        action={
          <ListCrudSheet
            trigger={
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New
              </Button>
            }
          />
        }
      >
        {listItems.length ? (
          <SidebarLinkList items={listItems} ariaLabel="Personal lists" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Create your first list to group tasks.
          </p>
        )}
      </SidebarSection>
      <SidebarSection
        title="Labels"
        action={
          <LabelCrudSheet
            trigger={
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New
              </Button>
            }
          />
        }
      >
        {labelItems.length ? (
          <SidebarLinkList items={labelItems} ariaLabel="Task labels" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Add labels to track themes like #design or #finance.
          </p>
        )}
      </SidebarSection>
    </div>
  );
}
