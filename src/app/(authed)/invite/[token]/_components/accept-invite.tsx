"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "an owner",
  EDITOR: "an editor",
  VIEWER: "a viewer",
};

export function AcceptInvite({
  token,
  workspaceName,
  workspaceSlug,
  role,
  expired,
  accepted,
  alreadyMember,
}: {
  token: string;
  workspaceName: string;
  workspaceSlug: string;
  role: string;
  expired: boolean;
  accepted: boolean;
  alreadyMember: boolean;
}) {
  const router = useRouter();

  const accept = api.invitation.accept.useMutation({
    onSuccess: (res) => {
      router.push(`/w/${res.slug}`);
      router.refresh();
    },
  });

  // Already a member — nothing to accept, just offer a way in.
  if (alreadyMember) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re already in</CardTitle>
          <CardDescription>
            You&apos;re already a member of {workspaceName}.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={`/w/${workspaceSlug}`}>Go to {workspaceName}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Dead link — expired or already redeemed.
  if (expired || accepted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation isn&apos;t valid</CardTitle>
          <CardDescription>
            {accepted
              ? "This invitation has already been used."
              : "This invitation has expired."}{" "}
            Ask an owner of {workspaceName} for a new link.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {workspaceName}</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join {workspaceName} as{" "}
          {ROLE_LABEL[role] ?? role.toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {accept.error && (
          <p className="text-destructive text-sm">{accept.error.message}</p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          onClick={() => accept.mutate({ token })}
          disabled={accept.isPending}
        >
          {accept.isPending ? "Joining..." : "Accept invitation"}
        </Button>
        <Button asChild variant="ghost" disabled={accept.isPending}>
          <Link href="/dashboard">Not now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
