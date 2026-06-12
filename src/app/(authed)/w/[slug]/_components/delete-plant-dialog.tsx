"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

export function DeletePlantDialog({
  workspaceId,
  plantId,
  plantName,
  slug,
  trigger,
}: {
  workspaceId: string;
  plantId: string;
  plantName: string;
  slug: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const deleteMutation = api.plant.delete.useMutation({
    onSuccess: () => {
      setOpen(false);
      // Soft-deleted plants drop out of the list; go back to the workspace.
      router.push(`/w/${slug}`);
      router.refresh();
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {plantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This hides the plant from your workspace. Its record is kept so it
            stays valid as a parent in any lineage. You can&apos;t undo this
            from the UI yet.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteMutation.error && (
          <p className="text-destructive text-sm">
            {deleteMutation.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              // Keep the dialog open while the request is in flight; we close it
              // ourselves in onSuccess (or surface the error above).
              e.preventDefault();
              deleteMutation.mutate({ workspaceId, plantId });
            }}
          >
            {deleteMutation.isPending ? "Removing..." : "Remove plant"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
