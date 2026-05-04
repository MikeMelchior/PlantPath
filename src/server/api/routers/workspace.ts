import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

/**
 * Slugify a name into a URL-safe slug.
 * "My Pepper Garden!" -> "my-pepper-garden"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // drop everything that isn't alphanum, space, hyphen
    .replace(/\s+/g, "-")           // spaces -> hyphens
    .replace(/-+/g, "-")            // collapse runs of hyphens
    .replace(/^-|-$/g, "");         // trim leading/trailing hyphens
}

export const workspaceRouter = createTRPCRouter({
  /**
   * Create a new workspace. The creating user becomes the OWNER.
   * Slug is derived from the name; collisions are resolved with a counter suffix.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const baseSlug = slugify(input.name);

      if (!baseSlug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace name must contain at least one alphanumeric character",
        });
      }

      // Find a free slug — try base, then base-2, base-3, etc.
      let slug = baseSlug;
      let counter = 2;
      while (await ctx.db.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
        if (counter > 100) {
          // Sanity escape — should be unreachable in practice.
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not generate a unique slug",
          });
        }
      }

      // Create workspace + OWNER membership atomically.
      // If either insert fails, both roll back — no orphaned workspace.
      const workspace = await ctx.db.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: input.name,
            slug,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: ctx.userId,
            role: "OWNER",
          },
        });

        return ws;
      });

      return workspace;
    }),

  /**
   * List all workspaces the current user is a member of.
   * Returns each workspace along with the user's role in it.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.workspaceMember.findMany({
      where: { userId: ctx.userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));
  }),
});