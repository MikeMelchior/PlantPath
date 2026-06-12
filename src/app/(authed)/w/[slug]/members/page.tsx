import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { MemberRoleSelect } from "./_components/member-role-select";
import { RemoveMemberButton } from "./_components/remove-member-button";

const roleBadgeVariant = {
  OWNER: "default",
  EDITOR: "secondary",
  VIEWER: "outline",
} as const;

function initials(name: string | null, email: string): string {
  const source = name?.trim() ?? "";
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await api.workspace.getBySlug({ slug });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  const members = await api.workspace.listMembers({
    workspaceId: workspace.id,
  });
  const isOwner = workspace.role === "OWNER";

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Members</h1>
        <p className="text-muted-foreground text-sm">
          {members.length} member{members.length === 1 ? "" : "s"} in{" "}
          {workspace.name}
          {isOwner
            ? " · you can change roles and remove members"
            : " · view only"}
        </p>
      </header>

      <ul className="divide-y rounded-lg border">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center gap-4 px-4 py-3"
          >
            <Avatar>
              {member.imageUrl && (
                <AvatarImage
                  src={member.imageUrl}
                  alt={member.name ?? member.email}
                />
              )}
              <AvatarFallback>
                {initials(member.name, member.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {member.name ?? member.email}
              </p>
              {member.name && (
                <p className="text-muted-foreground truncate text-sm">
                  {member.email}
                </p>
              )}
            </div>

            {isOwner ? (
              <div className="flex items-center gap-2">
                <MemberRoleSelect
                  workspaceId={workspace.id}
                  userId={member.userId}
                  role={member.role}
                />
                <RemoveMemberButton
                  workspaceId={workspace.id}
                  userId={member.userId}
                  memberLabel={member.name ?? member.email}
                />
              </div>
            ) : (
              <Badge variant={roleBadgeVariant[member.role]}>
                {member.role.toLowerCase()}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
