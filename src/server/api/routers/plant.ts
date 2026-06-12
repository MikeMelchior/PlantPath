import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "generated/prisma";
import { ParentRole, PlantStatus } from "generated/prisma";

import {
  createTRPCRouter,
  workspaceProcedure,
  editorProcedure,
} from "~/server/api/trpc";

const plantStatusSchema = z.nativeEnum(PlantStatus);
const parentRoleSchema = z.nativeEnum(ParentRole);

// One parent edge supplied when creating a plant.
const parentInputSchema = z.object({
  plantId: z.string(),
  role: parentRoleSchema,
});

// Shape returned by the ancestor/descendant recursive-CTE queries.
interface LineageRow {
  id: string;
  name: string;
  variety: string | null;
  generation: number | null;
  status: PlantStatus;
  deletedAt: Date | null;
  depth: number;
  role: ParentRole;
}

// Nested-plant selection reused for the immediate parents/children on `get`.
const lineagePlantSelect = {
  id: true,
  name: true,
  variety: true,
  generation: true,
  status: true,
  deletedAt: true,
} satisfies Prisma.PlantSelect;

// Keep at most one edge per parent plant, preserving the first role given.
function dedupeParents(
  parents: { plantId: string; role: ParentRole }[],
): { plantId: string; role: ParentRole }[] {
  const seen = new Map<string, ParentRole>();
  for (const p of parents) {
    if (!seen.has(p.plantId)) seen.set(p.plantId, p.role);
  }
  return [...seen].map(([plantId, role]) => ({ plantId, role }));
}

export const plantRouter = createTRPCRouter({
  /**
   * Create a new plant in a workspace.
   */
  create: editorProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(200),
        variety: z.string().max(200).optional(),
        generation: z.number().int().min(0).optional(),
        notes: z.string().max(10_000).optional(),
        // 0, 1, or 2 parents — same shape handles founders, selfing, and crosses.
        parents: z.array(parentInputSchema).max(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, parents, ...rest } = input;

      // De-dupe parents by plantId (a plant can't be its own parent twice).
      const parentEdges = dedupeParents(parents ?? []);

      // A new plant has no descendants, so it can't introduce a cycle — we
      // only need to confirm the parents live in this workspace and aren't
      // soft-deleted. (Adding parents to an *existing* plant, which can form
      // cycles, is a separate mutation to be added with the cross flow.)
      let resolvedGeneration = rest.generation ?? null;
      if (parentEdges.length > 0) {
        const parentPlants = await ctx.db.plant.findMany({
          where: {
            id: { in: parentEdges.map((p) => p.plantId) },
            workspaceId,
            deletedAt: null,
          },
          select: { id: true, generation: true },
        });

        if (parentPlants.length !== parentEdges.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more parents don't exist in this workspace",
          });
        }

        // Auto-derive generation from parents when the caller didn't set it:
        // one past the deepest known parent. Left null if no parent has a
        // recorded generation.
        if (resolvedGeneration === null) {
          const knownGenerations = parentPlants
            .map((p) => p.generation)
            .filter((g): g is number => g !== null);
          if (knownGenerations.length > 0) {
            resolvedGeneration = Math.max(...knownGenerations) + 1;
          }
        }
      }

      return ctx.db.plant.create({
        data: {
          workspaceId,
          name: rest.name,
          variety: rest.variety ?? null,
          generation: resolvedGeneration,
          notes: rest.notes ?? null,
          parents: {
            create: parentEdges.map((p) => ({
              parentId: p.plantId,
              role: p.role,
            })),
          },
        },
      });
    }),

  /**
   * List active (non-soft-deleted) plants in a workspace.
   * Sorted newest-first; pagination deferred until we have enough plants to need it.
   */
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.plant.findMany({
        where: {
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Get a single plant by ID. Scoped to the workspace; returns NOT_FOUND if the
   * plant doesn't exist OR belongs to a different workspace OR has been soft-deleted.
   */
  get: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plantId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plant = await ctx.db.plant.findFirst({
        where: {
          id: input.plantId,
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        include: {
          // Immediate parents (edges where this plant is the child).
          // A soft-deleted parent is still shown — lineage outlives removal.
          parents: {
            include: { parent: { select: lineagePlantSelect } },
          },
          // Immediate children (edges where this plant is the parent),
          // excluding ones the user has removed from view.
          children: {
            where: { child: { deletedAt: null } },
            include: { child: { select: lineagePlantSelect } },
          },
        },
      });

      if (!plant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found",
        });
      }

      return plant;
    }),

  /**
   * Update editable fields on a plant. All fields are optional — partial updates supported.
   * Refuses to update soft-deleted plants (would be a confusing UX otherwise).
   */
  update: editorProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plantId: z.string(),
        name: z.string().min(1).max(200).optional(),
        variety: z.string().max(200).nullable().optional(),
        generation: z.number().int().min(0).nullable().optional(),
        status: plantStatusSchema.optional(),
        notes: z.string().max(10_000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, plantId, ...updates } = input;

      // Verify the plant belongs to this workspace and isn't soft-deleted.
      // updateMany with the scoping in `where` would also work, but findFirst
      // gives us a clean NOT_FOUND error path.
      const existing = await ctx.db.plant.findFirst({
        where: {
          id: plantId,
          workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found",
        });
      }

      return ctx.db.plant.update({
        where: { id: plantId },
        data: updates,
      });
    }),

  /**
   * Soft-delete a plant. Sets `deletedAt` rather than removing the row, so the
   * plant remains available as a parent in the genealogy graph (Phase 3).
   * Idempotent: deleting an already-deleted plant is a no-op.
   */
  delete: editorProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plantId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // updateMany scopes by workspaceId + not-yet-deleted in one query.
      // Returns { count }; count=0 means either it didn't exist or was already deleted.
      const result = await ctx.db.plant.updateMany({
        where: {
          id: input.plantId,
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found or already deleted",
        });
      }

      return { success: true };
    }),

  /**
   * All ancestors of a plant, walked up the genealogy DAG via a recursive CTE.
   * Soft-deleted ancestors are included — a removed plant is still a real link
   * in the lineage. `depth` is 1 for direct parents, 2 for grandparents, etc.
   * The depth cap is a belt-and-suspenders guard against a cyclic data state
   * (the graph is acyclic by construction).
   */
  getAncestors: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), plantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const root = await ctx.db.plant.findFirst({
        where: {
          id: input.plantId,
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!root) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found",
        });
      }

      return ctx.db.$queryRaw<LineageRow[]>`
                WITH RECURSIVE ancestors AS (
                    SELECT pp."parentId", pp."childId", pp."role", 1 AS depth
                    FROM "PlantParent" pp
                    WHERE pp."childId" = ${input.plantId}
                    UNION ALL
                    SELECT pp."parentId", pp."childId", pp."role", a.depth + 1
                    FROM "PlantParent" pp
                    JOIN ancestors a ON pp."childId" = a."parentId"
                    WHERE a.depth < 50
                )
                SELECT p."id", p."name", p."variety", p."generation",
                       p."status", p."deletedAt", a.depth, a."role"
                FROM ancestors a
                JOIN "Plant" p ON p."id" = a."parentId"
                WHERE p."workspaceId" = ${input.workspaceId}
                ORDER BY a.depth ASC, p."name" ASC
            `;
    }),

  /**
   * All descendants of a plant, walked down the DAG via a recursive CTE.
   * Excludes soft-deleted descendants (removed plants drop out of "what came
   * from this plant" views). `depth` is 1 for direct children, etc.
   */
  getDescendants: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), plantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const root = await ctx.db.plant.findFirst({
        where: {
          id: input.plantId,
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!root) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found",
        });
      }

      return ctx.db.$queryRaw<LineageRow[]>`
                WITH RECURSIVE descendants AS (
                    SELECT pp."parentId", pp."childId", pp."role", 1 AS depth
                    FROM "PlantParent" pp
                    WHERE pp."parentId" = ${input.plantId}
                    UNION ALL
                    SELECT pp."parentId", pp."childId", pp."role", d.depth + 1
                    FROM "PlantParent" pp
                    JOIN descendants d ON pp."parentId" = d."childId"
                    WHERE d.depth < 50
                )
                SELECT p."id", p."name", p."variety", p."generation",
                       p."status", p."deletedAt", d.depth, d."role"
                FROM descendants d
                JOIN "Plant" p ON p."id" = d."childId"
                WHERE p."workspaceId" = ${input.workspaceId}
                  AND p."deletedAt" IS NULL
                ORDER BY d.depth ASC, p."name" ASC
            `;
    }),
});
