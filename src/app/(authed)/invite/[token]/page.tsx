import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { AcceptInvite } from "./_components/accept-invite";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let invite;
  try {
    invite = await api.invitation.getByToken({ token });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  return (
    <main className="container mx-auto flex max-w-md flex-col px-6 py-16">
      <AcceptInvite
        token={token}
        workspaceName={invite.workspaceName}
        workspaceSlug={invite.workspaceSlug}
        role={invite.role}
        expired={invite.expired}
        accepted={invite.accepted}
        alreadyMember={invite.alreadyMember}
      />
    </main>
  );
}
