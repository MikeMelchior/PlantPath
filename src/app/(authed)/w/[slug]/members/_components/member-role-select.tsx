"use client";

import { useRouter } from "next/navigation";

import type { WorkspaceRole } from "generated/prisma";
import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
] satisfies { value: WorkspaceRole; label: string }[];

export function MemberRoleSelect({
  workspaceId,
  userId,
  role,
}: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  const router = useRouter();

  const updateRole = api.workspace.updateMemberRole.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Select
        value={role}
        disabled={updateRole.isPending}
        onValueChange={(value) =>
          updateRole.mutate({
            workspaceId,
            userId,
            role: value as WorkspaceRole,
          })
        }
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {updateRole.error && (
        <p className="text-destructive max-w-48 text-right text-xs">
          {updateRole.error.message}
        </p>
      )}
    </div>
  );
}
