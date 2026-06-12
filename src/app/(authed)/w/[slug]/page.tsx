import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { PlantStatusBadge } from "./_components/plant-status-badge";
import { CreatePlantDialog } from "./_components/create-plant-dialog";

export default async function WorkspacePage({
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

  const canEdit = workspace.role !== "VIEWER";
  const plants = await api.plant.list({ workspaceId: workspace.id });

  return (
    <main className="container mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workspace.name}</h1>
          <p className="text-muted-foreground text-sm">
            {plants.length === 0
              ? "No plants yet."
              : `${plants.length} plant${plants.length === 1 ? "" : "s"} · your role: ${workspace.role.toLowerCase()}`}
          </p>
        </div>

        {canEdit && plants.length > 0 && (
          <CreatePlantDialog
            workspaceId={workspace.id}
            trigger={<Button>Add plant</Button>}
          />
        )}
      </header>

      {plants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No plants yet</h2>
          <p className="text-muted-foreground mt-2 mb-6 text-sm">
            {canEdit
              ? "Add your first plant to start tracking it."
              : "Plants added to this workspace will appear here."}
          </p>
          {canEdit && (
            <CreatePlantDialog
              workspaceId={workspace.id}
              trigger={<Button>Add your first plant</Button>}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <Link key={plant.id} href={`/w/${slug}/plants/${plant.id}`}>
              <Card className="hover:bg-accent h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{plant.name}</CardTitle>
                    <PlantStatusBadge status={plant.status} />
                  </div>
                  <CardDescription>
                    {[
                      plant.variety,
                      plant.generation !== null ? `F${plant.generation}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No variety recorded"}
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
