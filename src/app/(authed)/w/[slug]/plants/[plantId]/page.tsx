import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { PlantStatusBadge } from "../../_components/plant-status-badge";
import { EditPlantDialog } from "../../_components/edit-plant-dialog";
import { DeletePlantDialog } from "../../_components/delete-plant-dialog";

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ slug: string; plantId: string }>;
}) {
  const { slug, plantId } = await params;

  let workspace;
  try {
    workspace = await api.workspace.getBySlug({ slug });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  let plant;
  try {
    plant = await api.plant.get({ workspaceId: workspace.id, plantId });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  const canEdit = workspace.role !== "VIEWER";

  const metaParts = [
    plant.variety,
    plant.generation !== null ? `F${plant.generation}` : null,
  ].filter(Boolean);

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/w/${slug}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← {workspace.name}
      </Link>

      <header className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{plant.name}</h1>
            <PlantStatusBadge status={plant.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {metaParts.length > 0
              ? metaParts.join(" · ")
              : "No variety recorded"}
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <EditPlantDialog
              plant={plant}
              trigger={<Button variant="outline">Edit</Button>}
            />
            <DeletePlantDialog
              workspaceId={workspace.id}
              plantId={plant.id}
              plantName={plant.name}
              slug={slug}
              trigger={<Button variant="outline">Remove</Button>}
            />
          </div>
        )}
      </header>

      <Separator />

      <section className="mt-6">
        <h2 className="text-muted-foreground text-sm font-semibold">Notes</h2>
        {plant.notes ? (
          <p className="mt-2 text-sm whitespace-pre-wrap">{plant.notes}</p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">No notes yet.</p>
        )}
      </section>
    </main>
  );
}
