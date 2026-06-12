import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { InvitationManager } from "./_components/invitation-manager";

export default async function InvitationsPage({
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

  // Managing invitations is an owner-only capability.
  if (workspace.role !== "OWNER") {
    redirect(`/w/${slug}`);
  }

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/w/${slug}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← {workspace.name}
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-bold">Invitations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a shareable link to invite someone to {workspace.name}. Anyone
          with the link can join at the chosen role until it expires or you
          revoke it.
        </p>
      </header>

      <InvitationManager workspaceId={workspace.id} />
    </main>
  );
}
