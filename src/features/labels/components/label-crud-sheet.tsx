"use client";

import { ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/server/actions/label-actions";
import { createLabelSchema } from "@/schemas/label";

const DEFAULT_COLOR = "#10b981";

type LabelFormValues = z.infer<typeof createLabelSchema>;

type LabelCrudSheetProps = {
  trigger: ReactNode;
  label?: {
    id: string;
    name: string;
    emoji?: string | null;
    color?: string | null;
  } | null;
};

export function LabelCrudSheet({ trigger, label }: LabelCrudSheetProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo<LabelFormValues>(
    () => ({
      name: label?.name ?? "",
      emoji: label?.emoji ?? "",
      color: label?.color ?? DEFAULT_COLOR,
    }),
    [label]
  );

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(createLabelSchema),
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
      const result = label
        ? await updateLabelAction({ id: label.id, ...values })
        : await createLabelAction(values);

      if (!result.success) {
        setError(result.error ?? "Unable to save label");
        return;
      }

      setOpen(false);
    });
  });

  const handleDelete = () => {
    if (!label) return;
    if (!window.confirm(`Delete the label "${label.name}"?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteLabelAction(label.id);
      if (!result.success) {
        setError(result.error ?? "Unable to delete label");
        return;
      }
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full space-y-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{label ? "Edit label" : "New label"}</SheetTitle>
          <SheetDescription>
            Labels help you highlight themes like #design or #finance.
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
                    <Input placeholder="Design" autoFocus {...field} />
                  </FormControl>
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
                    <Input placeholder="🎨" maxLength={4} {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional icon for quick scanning.
                  </FormDescription>
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
              {label ? (
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
