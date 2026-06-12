"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ParentRole } from "generated/prisma";

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

const ROLE_OPTIONS: { value: ParentRole; label: string }[] = [
  { value: ParentRole.SEED, label: "Seed parent" },
  { value: ParentRole.POLLEN, label: "Pollen parent" },
  { value: ParentRole.SELF, label: "Self" },
  { value: ParentRole.UNKNOWN, label: "Unknown" },
];

// A plant has 0, 1, or 2 parents; this is the local editing shape for that.
interface ParentDraft {
  plantId: string;
  role: ParentRole;
}

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
  const [parents, setParents] = useState<ParentDraft[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", variety: "", generation: "", notes: "" },
  });

  // Candidate parents: existing plants in this workspace. Only fetched while the
  // dialog is open.
  const candidates = api.plant.list.useQuery(
    { workspaceId },
    { enabled: open },
  );

  const reset = () => {
    form.reset();
    setParents([]);
  };

  const createMutation = api.plant.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      reset();
      router.refresh(); // new plant shows up in the list on this page
    },
  });

  const addParent = () => {
    if (parents.length >= 2) return;
    setParents((prev) => [...prev, { plantId: "", role: ParentRole.SEED }]);
  };

  const updateParent = (index: number, patch: Partial<ParentDraft>) => {
    setParents((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  };

  const removeParent = (index: number) => {
    setParents((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (values: FormValues) => {
    const chosenParents = parents.filter((p) => p.plantId !== "");
    createMutation.mutate({
      workspaceId,
      name: values.name,
      variety: values.variety === "" ? undefined : values.variety,
      generation: values.generation === "" ? undefined : values.generation,
      notes: values.notes === "" ? undefined : values.notes,
      parents: chosenParents.length > 0 ? chosenParents : undefined,
    });
  };

  const availablePlants = candidates.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Parents{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addParent}
                disabled={
                  parents.length >= 2 ||
                  availablePlants.length === 0 ||
                  createMutation.isPending
                }
              >
                Add parent
              </Button>
            </div>

            {availablePlants.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Add other plants first to record this one&apos;s lineage.
              </p>
            ) : parents.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Founder seed — no parents recorded. Add one for a self, two for
                a cross.
              </p>
            ) : (
              <div className="space-y-2">
                {parents.map((parent, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={parent.plantId}
                      onValueChange={(v) => updateParent(index, { plantId: v })}
                      disabled={createMutation.isPending}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a plant" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlants.map((plant) => (
                          <SelectItem key={plant.id} value={plant.id}>
                            {plant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={parent.role}
                      onValueChange={(v) =>
                        updateParent(index, { role: v as ParentRole })
                      }
                      disabled={createMutation.isPending}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParent(index)}
                      disabled={createMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
