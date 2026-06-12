"use client";

import type * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
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

export function RemoveMemberButton({
  workspaceId,
  userId,
  memberLabel,
}: {
  workspaceId: string;
  userId: string;
  memberLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const removeMember = api.workspace.removeMember.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {memberLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will lose access to this workspace. You can re-invite them
            later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {removeMember.error && (
          <p className="text-destructive text-sm">
            {removeMember.error.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMember.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removeMember.isPending}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault(); // keep dialog open until the mutation resolves
              removeMember.mutate({ workspaceId, userId });
            }}
          >
            {removeMember.isPending ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
