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
- **Invitations are shareable token links, not emails.** A `WorkspaceInvitation` row carries an unguessable token with an expiry; redeeming it is single-use. No email provider is involved.
- **Lineage reads (`getAncestors`/`getDescendants`) use Postgres recursive CTEs**, not application-side graph walking — the whole traversal happens in one set-based query.

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

### Invitations are shareable links, not emails

The original Phase 2 plan called for an email-based invite flow (generate a token, send it through Resend or similar, accept via a link in the email). We built a token link model instead: `invitation.create` mints an unguessable token (`randomBytes(24).toString("base64url")`), stores a `WorkspaceInvitation` row, and returns it so the client can build a `/invite/<token>` URL the inviter shares however they like.

Reasons for dropping email:

- **No external dependency.** No Resend account, API key, deliverability tuning, or spam-folder failure mode. One fewer service to provision for a portfolio demo, and the flow works identically in local dev with no tunnel or mail sink.
- **Simpler, more demoable.** "Copy link, paste it to a collaborator" is one obvious step in a screen recording. The token in the URL *is* the credential, so there's nothing to verify on the email side.
- **`email` stays optional and purely informational.** The schema keeps an `email` column, but it's nullable and never used as an auth factor — it's a label for "who this link was meant for," not a gate. Anyone with the link can redeem it.

Single-use, time-boxed semantics are enforced on the row, not in a mailbox:

- **Expiry.** `expiresAt` is set `INVITE_TTL_DAYS` (7) out at creation. `accept` and `getByToken` both check it, so a leaked link can't be redeemed indefinitely. `list` filters to `expiresAt > now()` so the owner only sees live invites.
- **Spent-once.** `acceptedAt` is the spent marker; `accept` rejects a token that already has one. Acceptance runs in a transaction that creates the `WorkspaceMember` (no-op if the user is already a member) and stamps `acceptedAt` + `accepterId` together, so a token can't be redeemed twice even under concurrent requests.

`inviterId` and `accepterId` are stored as **bare Clerk-id strings with no foreign key** to `User`. This is deliberate: an invite is a historical record of "someone invited someone," and it should survive the inviter being removed from the workspace or deleting their account. An FK with a cascade or restrict would either delete the audit trail or block the member removal; loose ids keep the record intact and decoupled. (Contrast with the `User`-referencing FKs elsewhere — those are live relationships we *want* to join and enforce; this is a frozen log line.)

Owner-only gating is done **in-resolver** here rather than via `ownerProcedure`. `create`/`list`/`revoke` run on `workspaceProcedure` and call a local `assertOwner(ctx.membership.role)` helper. This keeps the invitation router independent of `trpc.ts`; the in-line comment notes that once `ownerProcedure` exists (it now does — see below) these can be swapped for it.

### Genealogy reads via recursive CTEs, not application graph-walking

`plant.getAncestors` and `plant.getDescendants` answer "everything up/down the lineage" with a single Postgres `WITH RECURSIVE` query (`$queryRaw`) rather than fetching `PlantParent` rows in a loop and walking the graph in Node. This is the payoff of choosing Postgres over SQLite (see the stack notes) — the lineage queries lean on it directly:

- **One round trip, walked in the database.** Application-side walking is N queries deep (one level per hop) or a full edge-table load plus an in-memory BFS. The CTE does the whole traversal set-based, close to the data, and returns a flat result already annotated with `depth` (1 = direct parent/child, 2 = grandparent, …) and the edge `role`.
- **Direction is just which column you seed and join on.** Ancestors seed on `childId = root` and recurse `pp.childId = a.parentId`; descendants mirror it (`parentId = root`, recurse `pp.parentId = d.childId`). Same query shape both ways.

**Cycle guard via a depth cap.** The recursion is bounded by `WHERE depth < 50`. The genealogy graph is acyclic *by construction* (a new plant can't be its own ancestor — see below — and the future add-parents flow will ancestor-check before linking), so this cap is belt-and-suspenders: if bad data ever introduced a cycle, the cap stops the query from looping forever instead of hanging the request.

**Soft-deleted plants are treated asymmetrically, on purpose:**

- **Ancestors keep soft-deleted plants.** A removed plant is still a real link in the chain — "this F4 descends from an F1 the user later deleted" is true and worth showing. Lineage outlives removal, so `getAncestors` does *not* filter `deletedAt`. The same logic drives `plant.get`, whose immediate-`parents` include carries no `deletedAt` filter.
- **Descendants drop soft-deleted plants.** "What came from this plant" is a forward-looking view of current offspring, so `getDescendants` filters `deletedAt IS NULL`, matching `plant.get`'s `children` include (which filters removed children out). A plant the user removed from view shouldn't reappear in a descendant list.

Both queries still filter `p.workspaceId = ${workspaceId}` in the final join — defense-in-depth, since `PlantParent` carries no `workspaceId` of its own and the edges are only scoped through the plants they connect.

### Generation auto-derivation on create

When a plant is created with parents, `plant.create` derives its `generation` as **one past the deepest known parent** (`Math.max(...knownParentGenerations) + 1`). The rule has two deliberate fallbacks:

- **Caller wins.** If the request supplies an explicit `generation`, it's used as-is — imported data may know the generation even when the lineage is incomplete.
- **Unknown stays null.** If no parent has a recorded generation, the new plant's generation is left `null` rather than guessed. A null propagates honestly instead of inventing an F-number off an unknown base.

This is the write-time half of the "store generation, don't recompute it" decision: the value is computed once when parents are set, then stored on `Plant`, so reads never re-walk the graph for it.

**Create skips cycle-checking, by construction.** A brand-new plant has no descendants yet, so it cannot be an ancestor of any plant it points at — adding parents to a freshly created node can't form a cycle. `create` therefore only validates that each parent exists in the same workspace and isn't soft-deleted; it does *not* run the ancestor walk. The expensive cycle check belongs to the *separate* future mutation that adds parents to an **existing** plant (which can already have descendants and so can close a loop) — that's where the recursive ancestor query will be used as a guard, per the spec's DAG-enforcement note.

### Owner-only operations: `ownerProcedure` and sole-owner protection

Member management (changing roles, removing members) is gated by a new `ownerProcedure` in `trpc.ts`. It composes `workspaceProcedure` exactly like `editorProcedure` does, but rejects anyone whose `membership.role !== "OWNER"`. This is the natural extension of "ownership is a role, not a column": because ownership lives on `WorkspaceMember.role`, the owner gate is just one more role check in the same composed-procedure chain — no special-cased `ownerId` lookup.

`workspace.updateMemberRole` and `workspace.removeMember` run on `ownerProcedure` and add **sole-owner protection**: before demoting an OWNER to a lesser role, or removing an OWNER, they count the workspace's owners and reject (`FORBIDDEN`, "transfer ownership first") if that owner is the last one. This closes the "what happens to the only owner?" question for member management — the answer is the GitHub model: **block the action and require explicit ownership transfer** (promote another member to OWNER first). Multi-owner workspaces are already supported (invites can grant OWNER), so transfer is just "add an owner, then demote/remove yourself."

The count-then-mutate is a small read-modify-write race in theory (two concurrent demotions could each see two owners and both proceed). At portfolio scale this is acceptable; a future hardening could wrap it in a transaction with row locking. The account-deletion side of the same question (what happens when the last owner deletes their Clerk account) is still open — see below.

### Slugs are stable on rename

Workspaces have both an internal `id` (cuid, FK target, never changes) and a `slug` (URL handle, globally unique, stable by default on rename). Renaming a workspace doesn't change its URL. Users can change their workspace's URL via an explicit action, decoupling display name from URL identity.

## Open questions

These are decisions deferred, not avoided. Each one will need an answer before its implementing phase ships:

- **Sole-owner account deletion.** Member management now blocks demoting or removing the last OWNER (transfer-first; see "Owner-only operations"). The remaining open case is the *account*-deletion path: when the only OWNER deletes their Clerk account, the webhook's `user.deleted` would cascade away their membership and orphan the workspace. Resolve before that delete path ships — likely the same transfer-or-block model, enforced at the webhook.
- **Variety as string vs. lookup table.** Currently a free-text string on `Plant`. Migrate to a `Variety` lookup table when autocomplete and standardization become valuable (likely Phase 3).
- **Trait modeling.** Free-text tags vs. structured trait taxonomy. Start with tags, formalize if useful.
- **Real-time collaboration.** Multiple workspace members editing simultaneously. Not needed for Phase 1–2; revisit if it becomes a pain point.

## Pointers

- **Schema:** [`prisma/schema.prisma`](./prisma/schema.prisma)
- **tRPC procedures (`workspace`/`editor`/`owner`):** [`src/server/api/trpc.ts`](./src/server/api/trpc.ts)
- **Invitations router:** [`src/server/api/routers/invitation.ts`](./src/server/api/routers/invitation.ts)
- **Genealogy reads & generation derivation:** [`src/server/api/routers/plant.ts`](./src/server/api/routers/plant.ts)
- **Member management & sole-owner protection:** [`src/server/api/routers/workspace.ts`](./src/server/api/routers/workspace.ts)
- **Webhook handler:** [`src/app/api/webhooks/clerk/route.ts`](./src/app/api/webhooks/clerk/route.ts)
- **Setup and local development:** [README.md](./README.md)