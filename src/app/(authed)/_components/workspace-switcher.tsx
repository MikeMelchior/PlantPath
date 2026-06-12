"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "~/app/(authed)/dashboard/_components/create-workspace-dialog";

type Workspace = RouterOutputs["workspace"]["list"][number];

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: Workspace[];
}) {
  const pathname = usePathname();

  // Active slug is the segment after /w/ (if we're on a workspace route).
  const match = /^\/w\/([^/]+)/.exec(pathname);
  const activeSlug = match?.[1];
  const activeWorkspace = workspaces.find((w) => w.slug === activeSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56">
          <span className="truncate">
            {activeWorkspace?.name ?? "Select workspace"}
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
        ) : (
          workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} asChild>
              <Link href={`/w/${workspace.slug}`}>
                <span className="truncate">{workspace.name}</span>
                {workspace.slug === activeSlug && (
                  <Check className="ml-auto" />
                )}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <CreateWorkspaceDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Plus />
              Create workspace
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
