"use client";

import { ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  createListAction,
  deleteListAction,
  updateListAction,
} from "@/server/actions/list-actions";
import { listBaseSchema } from "@/schemas/list";

import type { z } from "zod";

type ListFormValues = z.infer<typeof listBaseSchema>;

type ListCrudSheetProps = {
  trigger: ReactNode;
  list?: {
    id: string;
    name: string;
    emoji?: string | null;
    color?: string | null;
  } | null;
};

const DEFAULT_COLOR = "#6366f1";

export function ListCrudSheet({ trigger, list }: ListCrudSheetProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo<ListFormValues>(
    () => ({
      name: list?.name ?? "",
      emoji: list?.emoji ?? "",
      color: list?.color ?? DEFAULT_COLOR,
    }),
    [list]
  );

  const form = useForm<ListFormValues>({
    resolver: zodResolver(listBaseSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const handleSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = list
        ? await updateListAction({ id: list.id, ...values })
        : await createListAction(values);

      if (!result.success) {
        setError(result.error ?? "Unable to save list");
        return;
      }

      setOpen(false);
    });
  });

  const handleDelete = () => {
    if (!list) return;
    if (!window.confirm(`Delete the list "${list.name}"?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteListAction(list.id);
      if (!result.success) {
        setError(result.error ?? "Unable to delete list");
        return;
      }
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="left"
        className="w-full space-y-6 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{list ? "Edit list" : "New list"}</SheetTitle>
          <SheetDescription>
            Give your list a name, emoji, and accent color to keep tasks
            organized.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product Roadmap" autoFocus {...field} />
                  </FormControl>
                  <FormDescription>
                    The label shown across the app.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emoji</FormLabel>
                  <FormControl>
                    <Input placeholder="✨" maxLength={4} {...field} />
                  </FormControl>
                  <FormDescription>Optional visual accent.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} className="h-10 w-16 p-1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {list ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                isLoading={isPending}
                className="w-full sm:w-auto"
              >
                Save
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
