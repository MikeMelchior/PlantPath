import { z } from "zod";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { WorkspaceRole } from "generated/prisma";

import {
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "~/server/api/trpc";

// Invites lapse after a week so a leaked link can't be redeemed indefinitely.
const INVITE_TTL_DAYS = 7;

// An invite may grant any role, including OWNER (co-owners are a supported shape).
const inviteRoleSchema = z.nativeEnum(WorkspaceRole);

// Owner-only gate, applied inside resolvers. We don't use a dedicated
// `ownerProcedure` here to keep this router independent of trpc.ts changes;
// once an ownerProcedure exists it can replace these calls.
function assertOwner(role: WorkspaceRole) {
  if (role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only workspace owners can manage invitations",
    });
  }
}

export const invitationRouter = createTRPCRouter({
  /**
   * Create a shareable invitation link. Owner-only. Returns the row including
   * its `token`; the client builds the `/invite/<token>` URL from it.
   */
  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email().optional(),
        role: inviteRoleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      const token = randomBytes(24).toString("base64url");
      const expiresAt = new Date(
        Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      return ctx.db.workspaceInvitation.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email ?? null,
          role: input.role,
          token,
          inviterId: ctx.userId,
          expiresAt,
        },
      });
    }),

  /**
   * List pending (unaccepted, unexpired) invitations for a workspace. Owner-only.
   */
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return ctx.db.workspaceInvitation.findMany({
        where: {
          workspaceId: input.workspaceId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Revoke a pending invitation. Owner-only. Idempotent-ish: 404 if it doesn't
   * exist, isn't in this workspace, or was already accepted.
   */
  revoke: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      const result = await ctx.db.workspaceInvitation.deleteMany({
        where: {
          id: input.invitationId,
          workspaceId: input.workspaceId,
          acceptedAt: null,
        },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found or already used",
        });
      }

      return { success: true };
    }),

  /**
   * Resolve an invite token for the accept screen. Requires sign-in (so we can
   * tell whether the viewer is already a member) but NOT workspace membership.
   */
  getByToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.workspaceInvitation.findUnique({
        where: { token: input.token },
        include: { workspace: { select: { name: true, slug: true } } },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      const alreadyMember = await ctx.db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: ctx.userId,
          },
        },
        select: { id: true },
      });

      return {
        workspaceName: invite.workspace.name,
        workspaceSlug: invite.workspace.slug,
        role: invite.role,
        expired: invite.expiresAt.getTime() < Date.now(),
        accepted: invite.acceptedAt !== null,
        alreadyMember: alreadyMember !== null,
      };
    }),

  /**
   * Accept an invitation. Adds the signed-in user to the workspace at the
   * invited role (no-op if already a member) and marks the invite spent.
   * Single-use: a spent or expired token is rejected.
   */
  accept: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.workspaceInvitation.findUnique({
        where: { token: input.token },
        include: { workspace: { select: { slug: true } } },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }
      if (invite.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has already been used",
        });
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has expired",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        const existing = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: invite.workspaceId,
              userId: ctx.userId,
            },
          },
          select: { id: true },
        });

        if (!existing) {
          await tx.workspaceMember.create({
            data: {
              workspaceId: invite.workspaceId,
              userId: ctx.userId,
              role: invite.role,
            },
          });
        }

        await tx.workspaceInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), accepterId: ctx.userId },
        });
      });

      return { slug: invite.workspace.slug };
    }),
});
