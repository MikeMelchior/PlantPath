"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

// `generation` comes off a number input as a string; coerce empty -> undefined,
// otherwise parse to an int the server schema (min 0) will accept.
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Plant name is required")
    .max(200, "Plant name must be at most 200 characters"),
  variety: z
    .string()
    .max(200, "Variety must be at most 200 characters")
    .optional(),
  generation: z
    .union([
      z.literal(""),
      z.coerce.number().int().min(0, "Generation can't be negative"),
    ])
    .optional(),
  notes: z
    .string()
    .max(10_000, "Notes must be at most 10,000 characters")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreatePlantDialog({
  workspaceId,
  trigger,
}: {
  workspaceId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", variety: "", generation: "", notes: "" },
  });

  const createMutation = api.plant.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh(); // new plant shows up in the list on this page
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      workspaceId,
      name: values.name,
      variety: values.variety === "" ? undefined : values.variety,
      generation: values.generation === "" ? undefined : values.generation,
      notes: values.notes === "" ? undefined : values.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add plant</DialogTitle>
          <DialogDescription>
            Track a new plant in this workspace. You can record its lineage and
            events later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Reaper x Ghost #3"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  disabled={createMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="variety"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Variety</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Carolina Reaper"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  disabled={createMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="generation"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Generation</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  min={0}
                  placeholder="0 = F0 (founder), 1 = F1, ..."
                  aria-invalid={fieldState.invalid}
                  disabled={createMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={3}
                  placeholder="Anything worth remembering about this plant."
                  aria-invalid={fieldState.invalid}
                  disabled={createMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {createMutation.error && (
            <p className="text-destructive text-sm">
              {createMutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add plant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
