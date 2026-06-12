import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EventType } from "generated/prisma";

import {
  createTRPCRouter,
  workspaceProcedure,
  editorProcedure,
} from "~/server/api/trpc";

const eventTypeSchema = z.nativeEnum(EventType);

export const eventRouter = createTRPCRouter({
  /**
   * Record a dated event on a plant. Editor-only. Verifies the plant belongs
   * to the workspace and isn't soft-deleted before writing.
   */
  create: editorProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plantId: z.string(),
        type: eventTypeSchema,
        occurredAt: z.coerce.date(),
        notes: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plant = await ctx.db.plant.findFirst({
        where: {
          id: input.plantId,
          workspaceId: input.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!plant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plant not found",
        });
      }

      return ctx.db.event.create({
        data: {
          workspaceId: input.workspaceId,
          plantId: input.plantId,
          type: input.type,
          occurredAt: input.occurredAt,
          notes: input.notes ?? null,
        },
      });
    }),

  /**
   * List a plant's events, most recent first. Any workspace member may read.
   */
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), plantId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.event.findMany({
        where: {
          workspaceId: input.workspaceId,
          plantId: input.plantId,
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      });
    }),

  /**
   * Delete an event. Editor-only. Scoped by workspaceId so one workspace can't
   * delete another's events even with a guessed id.
   */
  delete: editorProcedure
    .input(z.object({ workspaceId: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.event.deleteMany({
        where: {
          id: input.eventId,
          workspaceId: input.workspaceId,
        },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found",
        });
      }

      return { success: true };
    }),
});
