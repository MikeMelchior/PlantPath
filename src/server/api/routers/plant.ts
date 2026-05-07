import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PlantStatus } from "generated/prisma";

import {
    createTRPCRouter,
    workspaceProcedure,
    editorProcedure,
} from "~/server/api/trpc";

const plantStatusSchema = z.nativeEnum(PlantStatus);

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
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { workspaceId, ...rest } = input;

            return ctx.db.plant.create({
                data: {
                    workspaceId,
                    name: rest.name,
                    variety: rest.variety ?? null,
                    generation: rest.generation ?? null,
                    notes: rest.notes ?? null,
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
});