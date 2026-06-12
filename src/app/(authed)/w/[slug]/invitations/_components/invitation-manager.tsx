"use client";

import { useState } from "react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";

// Inviting a co-owner is supported by the API but kept out of this UI — the
// common, safe cases are editor and viewer.
type InviteRole = "EDITOR" | "VIEWER";

const ROLE_LABEL: Record<InviteRole, string> = {
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export function InvitationManager({ workspaceId }: { workspaceId: string }) {
  const utils = api.useUtils();
  const list = api.invitation.list.useQuery({ workspaceId });

  const [role, setRole] = useState<InviteRole>("EDITOR");
  const [email, setEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const create = api.invitation.create.useMutation({
    onSuccess: () => {
      setEmail("");
      void utils.invitation.list.invalidate({ workspaceId });
    },
  });

  const revoke = api.invitation.revoke.useMutation({
    onSuccess: () => {
      void utils.invitation.list.invalidate({ workspaceId });
    },
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      workspaceId,
      role,
      email: email.trim() === "" ? undefined : email.trim(),
    });
  };

  const onCopy = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const invitations = list.data ?? [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="grower@example.com"
                autoComplete="off"
                disabled={create.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="text-sm font-medium">
                Role
              </label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as InviteRole)}
                disabled={create.isPending}
              >
                <SelectTrigger id="invite-role" className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create link"}
            </Button>
          </form>

          {create.error && (
            <p className="text-destructive mt-3 text-sm">
              {create.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Pending invitations
        </h2>

        {list.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : invitations.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No pending invitations. Create a link above to invite someone.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {ROLE_LABEL[inv.role as InviteRole] ?? inv.role}
                    </Badge>
                    {inv.email && (
                      <span className="truncate text-sm">{inv.email}</span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    Expires {inv.expiresAt.toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onCopy(inv.token)}
                  >
                    {copiedToken === inv.token ? "Copied!" : "Copy link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate({
                        workspaceId,
                        invitationId: inv.id,
                      })
                    }
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
