import Link from "next/link";

import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { CreateWorkspaceDialog } from "./_components/create-workspace-dialog";

export default async function DashboardPage() {
  const workspaces = await api.workspace.list();

  return (
      <main className="container mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workspaces</h1>
            <p className="text-sm text-muted-foreground">
              {workspaces.length === 0
                ? "Create your first workspace to get started."
                : `You have access to ${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}.`}
            </p>
          </div>

          {workspaces.length > 0 && (
            <CreateWorkspaceDialog
              trigger={<Button>Create workspace</Button>}
            />
          )}
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <h2 className="text-lg font-semibold">No workspaces yet</h2>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">
              A workspace is where you track your plants, crosses, and trials.
            </p>
            <CreateWorkspaceDialog
              trigger={<Button>Create your first workspace</Button>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link key={workspace.id} href={`/w/${workspace.slug}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle>{workspace.name}</CardTitle>
                    <CardDescription>
                      {workspace.role.toLowerCase()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
  );
}