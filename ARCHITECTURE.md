# Architecture

This document explains the design decisions behind PlantPath. It is not a setup guide (see [README.md](./README.md)) or a project plan (see the foundational spec, kept separately as project context). Its job is to answer "why is the code shaped this way?" for someone reading the repo cold.

## Project at a glance

PlantPath is a multi-tenant SaaS for small-scale plant breeders and seed savers. Users group their work into workspaces, track individual plants, and record cross-pollinations that produce new plants in successive filial generations (F1, F2, …). The genealogy graph — which plant descended from which — is the central piece of domain logic.

The stack is the modern T3 combo: Next.js 15 (App Router) + TypeScript + tRPC + Prisma + PostgreSQL on [Neon](https://neon.com), with [Clerk](https://clerk.com) for authentication, [shadcn/ui](https://ui.shadcn.com) on Tailwind for components, and Vercel for hosting. The choices that aren't defaults are explained below.

## Architecture at a glance

- **Authentication is decoupled from tenancy.** Clerk owns user identity (signup, login, sessions). Workspaces, members, roles, and invitations are modeled in our own Postgres schema rather than using Clerk Organizations.
- **Multi-tenancy is shared-schema with row-level scoping by `workspaceId`.** Enforced through layered tRPC procedures, not through database-level row security (yet).
- **The genealogy graph uses a join table (`PlantParent`), not parent columns on `Plant`.** This handles founders, selfing, and crosses with the same shape and supports recursive CTE queries cleanly.
- **Plants soft-delete; everything else hard-deletes.** Driven by referential integrity needs in the genealogy graph, not by a general "soft-delete everything" preference.
- **A Clerk webhook mirrors users into the local `User` table** so foreign keys can reference users with referential integrity, and member lookups don't need to fan out to Clerk's API.

## Key design decisions

### Clerk for identity, not for tenancy

Clerk has a built-in [Organizations](https://clerk.com/docs/organizations/overview) feature that handles members, roles, invitations, and a switcher UI. Using it would have saved roughly a week of build time in Phase 2. I chose to build that layer ourselves anyway, for two reasons.

First, the multi-tenancy model is easier to reason about when the entire domain lives in one Postgres schema. Joins from `Plant` to `Workspace` to `WorkspaceMember` to `User` are single queries; permission checks are unique-index lookups. With Clerk Organizations, the membership and role data lives in Clerk and has to be either re-fetched or synced to use locally.

Second, if Clerk's pricing or product changes, swapping to another auth provider while keeping Clerk's tenancy model would be much harder than swapping just the auth layer.

Cost: roughly an extra week to build invitations and member management.

### Mirroring Clerk users into the local DB

Even though Clerk owns user identity, we maintain a local `User` table populated by webhook. On `user.created`, `user.updated`, and `user.deleted` events, the handler at `/api/webhooks/clerk` upserts (or deletes) the corresponding row.

The alternative — storing only the Clerk user ID as a string on `WorkspaceMember`, with no local user table — was rejected for three reasons:

- **Single-query joins.** "List all members of this workspace with their names and avatars" is one Prisma query if mirrored, an N+1 fanout to Clerk's API if not.
- **Referential integrity.** Foreign keys catch bugs that string-IDs-floating-in-tables don't.
- **Future features.** "Plant created by X," "@mention a user," "transferred ownership to Y" — all need a queryable user record.

We use Clerk's user ID directly as our `User.id` PK (string, not cuid). This keeps logs and joins free of dual-ID confusion at the cost of being less portable if we ever migrated off Clerk — a tradeoff we accepted.

The webhook handler is small but careful. Three things drive its shape:

- **Signature verification.** The endpoint is public-facing. Without verification, anyone could POST fake events. Clerk signs every request via [Svix](https://www.svix.com); we verify before trusting any payload.
- **Idempotency.** Webhooks can be retried — network blips, server restarts, slow responses. Both `user.created` and `user.updated` use the same `upsert` logic, so duplicate deliveries are non-operations. `user.deleted` uses `deleteMany` so a missing row doesn't throw.
- **Return-code semantics.** Clerk's retry policy treats 5xx as "retry" and 4xx as "don't retry." A malformed event returns 400 (don't retry — it'll never succeed); a transient DB error returns 500 (retry — the next attempt might work).

### Multi-tenancy via shared schema and tRPC middleware

Every domain row carries a `workspaceId`. Enforcement happens at the tRPC layer through two layered procedures:

- **`workspaceProcedure`** takes a `workspaceId` input, looks up the user's `WorkspaceMember` row via the unique index on `(workspaceId, userId)`, and throws `FORBIDDEN` if the user isn't a member. The membership (with role) is attached to ctx for downstream use.
- **`editorProcedure`** composes `workspaceProcedure` and additionally rejects if `membership.role === VIEWER`. Used for any mutation.

The alternative — Postgres row-level security policies — was considered and deferred. RLS is a stronger guarantee (the database itself enforces tenancy regardless of application bugs), but it adds operational complexity and isn't needed at this scale. It's noted as a future migration path; the application-level enforcement is the right starting point.

### Genealogy via a join table, not columns on `Plant`

The intuitive model puts `parentAId` and `parentBId` directly on `Plant`. We rejected that for three reasons:

- **Selfing and founder plants get awkward.** A self-pollinated plant has one parent (or one *recorded* parent); a founder plant has zero. Two nullable columns conflate "selfed," "unknown second parent," and "founder."
- **No metadata on the relationship.** The seed (maternal) vs. pollen (paternal) distinction matters to breeders. Columns can't carry that without splitting into a separate model anyway.
- **Recursive ancestor/descendant queries are messier** against two parallel columns than against a normalized edge table.

`PlantParent(childId, parentId, role)` handles all four cases (founders, selfing, crosses, partial knowledge) with the same shape. The `role` enum is `SEED | POLLEN | SELF | UNKNOWN`. Recursive CTEs walk the table cleanly in both directions.

Generation (F0, F1, F2, …) is **stored on `Plant`, not derived**. Computing it from the parent graph on every query is expensive for deep lineages, and users sometimes know the generation but not the full lineage (imported data). A mutation recomputes it when parents change.

### Soft-delete on plants only — driven by cascade integrity

The decision to soft-delete plants isn't a general preference; it's required by the cascade choices on `PlantParent`:

- **`child onDelete: Cascade`** — deleting a plant removes its incoming parent edges (they're meaningless without the child).
- **`parent onDelete: Restrict`** — you cannot hard-delete a plant that is referenced as a parent of another. The DB refuses.

Without `Restrict`, hard-deleting an old plant would either silently orphan its descendants' lineage (with `Cascade` on parent) or break referential integrity. With `Restrict`, the user gets an error instead of silent data loss. Soft-delete (`deletedAt` on `Plant`) is the user-facing alternative: the plant disappears from default queries but the row and its edges stay intact, preserving the genealogy graph.

`PlantStatus` (`ACTIVE | DORMANT | DEAD | ARCHIVED`) is deliberately separate from `deletedAt`. Status describes the plant's real-world state — a dead plant is still visible (with a marker) and can still be referenced as a parent. `deletedAt` describes whether the user wants to see it. Conflating the two creates bugs like "I marked my plant as dead and now I can't see it in my list."

Workspaces, members, and other operational records hard-delete normally. The distinction is **historical vs. operational data**: historical data restricts deletes on the side that other rows reference; operational data cascades freely.

### Ownership as a role, not a column

`Workspace` has no `ownerId` column. Ownership is expressed through `WorkspaceMember.role = OWNER`. This supports multi-owner workspaces cleanly and avoids syncing a single-owner column with the membership table. "Find owner" becomes a filtered query against an indexed small set, which is fast in practice.

### Slugs are stable on rename

Workspaces have both an internal `id` (cuid, FK target, never changes) and a `slug` (URL handle, globally unique, stable by default on rename). Renaming a workspace doesn't change its URL. Users can change their workspace's URL via an explicit action, decoupling display name from URL identity.

## Open questions

These are decisions deferred, not avoided. Each one will need an answer before its implementing phase ships:

- **Sole-owner deletion policy.** When the only OWNER deletes their account, what happens? Default lean: block the deletion and require explicit ownership transfer (GitHub model). Alternatives: auto-promote the longest-tenured EDITOR, or cascade-delete the workspace. Decide before Phase 2 ships member management.
- **Variety as string vs. lookup table.** Currently a free-text string on `Plant`. Migrate to a `Variety` lookup table when autocomplete and standardization become valuable (likely Phase 3).
- **Trait modeling.** Free-text tags vs. structured trait taxonomy. Start with tags, formalize if useful.
- **Real-time collaboration.** Multiple workspace members editing simultaneously. Not needed for Phase 1–2; revisit if it becomes a pain point.

## Pointers

- **Schema:** [`prisma/schema.prisma`](./prisma/schema.prisma)
- **tRPC middleware (forthcoming):** `src/server/api/trpc.ts`
- **Webhook handler:** [`src/app/api/webhooks/clerk/route.ts`](./src/app/api/webhooks/clerk/route.ts)
- **Setup and local development:** [README.md](./README.md)