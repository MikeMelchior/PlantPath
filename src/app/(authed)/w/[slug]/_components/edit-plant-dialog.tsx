"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlantStatus } from "generated/prisma";

import type { RouterOutputs } from "~/trpc/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Plant = RouterOutputs["plant"]["get"];

const STATUS_LABEL: Record<PlantStatus, string> = {
  ACTIVE: "Active",
  DORMANT: "Dormant",
  DEAD: "Dead",
  ARCHIVED: "Archived",
};

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
  status: z.nativeEnum(PlantStatus),
  notes: z
    .string()
    .max(10_000, "Notes must be at most 10,000 characters")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditPlantDialog({
  plant,
  trigger,
}: {
  plant: Plant;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: plant.name,
      variety: plant.variety ?? "",
      generation: plant.generation ?? "",
      status: plant.status,
      notes: plant.notes ?? "",
    },
  });

  // Re-seed the form from the latest plant data each time the dialog opens, so
  // it reflects edits made elsewhere rather than the values from first render.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      form.reset({
        name: plant.name,
        variety: plant.variety ?? "",
        generation: plant.generation ?? "",
        status: plant.status,
        notes: plant.notes ?? "",
      });
    }
    setOpen(next);
  };

  const updateMutation = api.plant.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const onSubmit = (values: FormValues) => {
    // Empty optional fields are sent as null to clear them (the column is nullable).
    updateMutation.mutate({
      workspaceId: plant.workspaceId,
      plantId: plant.id,
      name: values.name,
      variety: values.variety === "" ? null : values.variety,
      generation: values.generation === "" ? null : values.generation,
      status: values.status,
      notes: values.notes === "" ? null : values.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit plant</DialogTitle>
          <DialogDescription>
            Update this plant&apos;s details. Status reflects its real-world
            state and is separate from removing it.
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
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  disabled={updateMutation.isPending}
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
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  disabled={updateMutation.isPending}
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
                  disabled={updateMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PlantStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  aria-invalid={fieldState.invalid}
                  disabled={updateMutation.isPending}
                />
                {fieldState.invalid && fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {updateMutation.error && (
            <p className="text-destructive text-sm">
              {updateMutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
