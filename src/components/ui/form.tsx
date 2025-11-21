"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  type ControllerProps,
  type FieldValues,
  FormProvider,
  useFormContext,
  type Path,
} from "react-hook-form";

import { cn } from "@/lib/utils";

const Form = FormProvider;

const FormField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  control,
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  const formContext = useFormContext<TFieldValues>();

  return <Controller control={control ?? formContext.control} {...props} />;
};

const FormItemContext = React.createContext<{ id: string } | null>(null);
const useFormItemContext = () => {
  const context = React.useContext(FormItemContext);
  if (!context) {
    throw new Error("FormItem components must be used within <FormItem>");
  }
  return context;
};

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  const { id } = useFormItemContext();
  return (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none", className)}
      htmlFor={id}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { id } = useFormItemContext();
  return <Slot ref={ref} id={id} {...props} />;
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { id } = useFormItemContext();
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      id={`${id}-description`}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { id } = useFormItemContext();

  if (!children) {
    return null;
  }

  return (
    <p
      ref={ref}
      className={cn("text-sm font-medium text-destructive", className)}
      id={`${id}-message`}
      {...props}
    >
      {children}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
};
