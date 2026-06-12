import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { PlantStatusBadge } from "../../_components/plant-status-badge";
import { EditPlantDialog } from "../../_components/edit-plant-dialog";
import { DeletePlantDialog } from "../../_components/delete-plant-dialog";

const ROLE_LABEL: Record<string, string> = {
  SEED: "seed parent",
  POLLEN: "pollen parent",
  SELF: "self",
  UNKNOWN: "unknown",
};

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

      <section className="mt-8">
        <h2 className="text-muted-foreground text-sm font-semibold">Lineage</h2>
        <div className="mt-2 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">Parents</h3>
            {plant.parents.length === 0 ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Founder — no parents recorded.
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {plant.parents.map((edge) => (
                  <li key={edge.parent.id} className="text-sm">
                    <Link
                      href={`/w/${slug}/plants/${edge.parent.id}`}
                      className="hover:underline"
                    >
                      {edge.parent.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {" · "}
                      {ROLE_LABEL[edge.role] ?? edge.role}
                      {edge.parent.generation !== null
                        ? ` · F${edge.parent.generation}`
                        : ""}
                      {edge.parent.deletedAt ? " · removed" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium">Children</h3>
            {plant.children.length === 0 ? (
              <p className="text-muted-foreground mt-1 text-sm">
                No children recorded yet.
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {plant.children.map((edge) => (
                  <li key={edge.child.id} className="text-sm">
                    <Link
                      href={`/w/${slug}/plants/${edge.child.id}`}
                      className="hover:underline"
                    >
                      {edge.child.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {" · "}
                      {ROLE_LABEL[edge.role] ?? edge.role}
                      {edge.child.generation !== null
                        ? ` · F${edge.child.generation}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
