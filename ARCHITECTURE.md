# PlantPath — Foundational Spec

> **Purpose of this document:** This is the founding context for the PlantPath project. Every chat in the PlantPath Claude project should reference this document for project vision, scope, stack rationale, domain model, and roadmap. Update it as decisions evolve.

---

## 1. Vision & Problem Statement

### What it is

PlantPath is a multi-tenant SaaS application for small-scale plant breeders and seed savers. It helps them track plants, lineages, cross-pollinations, trials, and seasonal performance — replacing the spreadsheets and notebooks they currently use.

### Why it exists (as a portfolio piece)

This project is built primarily as a portfolio piece for full-stack developer job applications. Goals:

- Demonstrate end-to-end production engineering: auth, multi-tenancy, complex data modeling, deployment, observability, testing.
- Serve as a credible artifact when applying for full-stack roles ("here's a deployed, working SaaS I built").
- Provide rich technical talking points for interviews — particularly around the multi-tenancy model, the genealogy graph data structure, and architectural decisions made along the way.

### Why this domain

- **Underserved niche:** Plant breeders and seed savers are an active community without good purpose-built software. Most use spreadsheets.
- **Personal domain knowledge:** Builder has hands-on experience growing peppers (especially high-heat varieties), which makes design decisions grounded rather than abstract.
- **Genuinely useful artifact:** The builder would actually use this, which sustains motivation and produces real demo data.
- **Memorable to recruiters:** "Built a SaaS for plant breeders" stands out vs. another to-do app or e-commerce clone.

### Non-goals

- Not a general-purpose gardening journal (apps like that exist and are crowded).
- Not a marketplace for selling seeds.
- Not a social network or community-first product.
- Not a mobile-first product (mobile-responsive web is enough; native mobile is out of scope unless extending later).

---

## 2. Tech Stack

### Stack at a glance

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 15 (App Router) | Familiar |
| Language | TypeScript | Familiar |
| API layer | tRPC | Familiar |
| ORM | Prisma | Familiar |
| Database | PostgreSQL (Neon) | Familiar |
| Auth | Clerk | New |
| UI components | shadcn/ui | New |
| Styling | Tailwind CSS | Familiar |
| Hosting | Vercel | Familiar |
| Testing | Vitest (unit), Playwright (E2E) | TBD |
| Observability | Sentry | TBD |
| Background jobs | Inngest or Trigger.dev | Phase 4+ |
| File storage | Supabase Storage or UploadThing | Phase 2 |

### Rationale by choice

**Next.js 15 + TypeScript + tRPC + Prisma + Postgres** — The T3 stack. Builder has prior experience, so we skip framework-learning cost and spend time on interesting design problems instead. This stack is also the dominant modern full-stack JS combo and highly hireable.

**Clerk for auth (user identity only) — workspaces rolled by hand.** Clerk handles signup, login, password reset, MFA, and session management. We deliberately do *not* use Clerk Organizations for the multi-tenancy layer; `Workspace`, `WorkspaceMember`, roles, and invitations are modeled in Postgres. Rationale: the multi-tenancy implementation is a primary interview talking point, and "I configured Clerk Organizations" is a much weaker story than "here's the membership table, the tRPC middleware that enforces roles, and the invitation token flow I designed." Keeping the entire domain in Postgres also means joins and permission checks stay simple and reduces lock-in. The cost is roughly an extra week in Phase 2 to build invitations and member management — accepted.

**shadcn/ui + Tailwind** — shadcn is copy-paste components (not a dependency). Beautiful defaults, fully customizable, accessible (built on Radix primitives). Looks professional immediately, which matters for portfolio screenshots. Tailwind is the industry standard.

**Postgres (not SQLite)** — The genealogy graph requires recursive CTEs for ancestor/descendant queries. Postgres handles that natively; SQLite is more limited. Postgres is also "the serious DB" in terms of hiring signal.

**Vercel** — Native Next.js deployment, free tier covers a portfolio project, automatic preview deployments per PR, edge functions if needed.

**Neon (over Supabase)** — Pure Postgres, generous free tier, and database branching that maps cleanly onto Vercel preview deployments (each PR can get an isolated DB branch). Supabase's value is its bundled services — auth, storage, realtime — and we are not using any of them (Clerk handles auth; file storage is deferred to Phase 2 and will likely use UploadThing or similar). Choosing Neon avoids paying the complexity cost of bundled features we don't need.

**Sentry** — Production error tracking. Setting it up is 10 minutes and signals operational maturity in a portfolio.

**Vitest + Playwright** — Vitest for fast unit tests on logic (genealogy calculations, business rules). Playwright for 2–3 E2E tests covering the critical user flows (signup → create workspace → add plant → invite member). 30% coverage is enough — this is portfolio, not enterprise.

**Inngest / Trigger.dev (later)** — Background jobs for things like daily reminder emails, photo processing, scheduled trial check-ins. Free tier. Defer until Phase 4.

---

## 3. Domain Model

### Core entities

```
User (managed by Clerk)
  ↓ owns/belongs to
Workspace (the tenant)
  ↓ contains
WorkspaceMember (role: owner | editor | viewer)

Workspace
  ↓ contains
Plant
  ├─ Variety (string or reference to a Variety lookup table)
  ├─ Generation (F0, F1, F2, ...)
  ├─ Parents (zero, one, or two — see genealogy notes)
  ├─ Traits (tags)
  ├─ Photos
  └─ Notes

Workspace
  ↓ contains
Season (e.g., "Spring 2026")
  ↓ groups
Plant (a plant belongs to zero or one season)

Plant
  ↓ has
Event (sow, germinate, transplant, harvest, death)
  └─ each event has date, notes, optional metrics

Workspace
  ↓ contains
Trial (a structured experiment)
  ├─ Hypothesis / question
  ├─ Conditions (temp, moisture, medium, light, etc.)
  ├─ Plants involved (many)
  └─ Outcomes
```

### The genealogy graph (the differentiator)

This is the most interesting design problem in the project.

**Shape:** A directed acyclic graph (DAG). Each plant has 0, 1, or 2 parents. Self-pollinated plants have one parent. Crosses have two. Wild/founder seeds have zero. There are no cycles (a plant cannot be its own ancestor).

**Generation calculation:**
- F0 — original founder seed (zero parents recorded, or marked as founder)
- F1 — direct cross of two F0 (or two unrelated parents)
- F2 — self of F1, or cross of two F1s from the same cross
- ...
- Generation can be auto-derived from parents but is also worth storing for query speed.

**Cross-pollination as a first-class concept:**
- A `CrossPollination` event records: `parentA`, `parentB` (or `parentA` only for selfing), date, notes, expected harvest.
- When seeds are saved from that cross, the user can later create N child Plants linked to that CrossPollination — each automatically gets both parents and the next generation number.

**Key queries to support:**
- Ancestors of a plant (all the way back to F0)
- Descendants of a plant
- Siblings (plants sharing both parents)
- Lineage path between two plants (if related)
- All F1+ from a particular F0

**Implementation approach:**
- Store parent links in a join table `PlantParent(childId, parentId, role)` — supports 0/1/2 parents cleanly. Same shape handles founders (zero rows), selfing (one row, `role = SELF`), crosses (two rows, `SEED` + `POLLEN`), and partial knowledge (one row, `role = UNKNOWN`).
- `ParentRole` enum: `SEED | POLLEN | SELF | UNKNOWN`. The `SEED`/`POLLEN` distinction matters to breeders (which plant was the maternal vs. paternal contributor) and is cheap to record.
- Cascade behavior is asymmetric and deliberate: `child onDelete: Cascade` (deleting a child removes its incoming edges — they're meaningless), `parent onDelete: Restrict` (cannot hard-delete a plant that is a parent of another plant). This is the structural reason for soft-deleting plants — `Restrict` means the user "removes from view" via `deletedAt` while the row and edges stay intact for genealogy integrity.
- Use Postgres recursive CTEs for ancestor/descendant queries.
- Visualize the graph using [React Flow](https://reactflow.dev) or `dagre` for layout.

**DAG enforcement:** Postgres cannot enforce "no plant is its own ancestor" with a constraint — that requires walking the graph. The cross-recording mutation (Phase 3) walks ancestors via the recursive CTE and rejects the cross if the proposed child is already in the proposed parent's ancestor set.

### Multi-tenancy model

**Pattern:** Shared database, shared schema, row-level scoping by `workspaceId`. Workspaces, members, roles, and invitations are modeled in our own Postgres schema — *not* via Clerk Organizations. Clerk's role is limited to user identity (signup, login, sessions); everything tenant-related is ours.

**Why this pattern:**
- Simplest to implement and reason about.
- Sufficient for portfolio scale (we are not selling to enterprise customers worried about data residency).
- Schema-per-tenant is overkill for this stage and would make migrations painful.
- Row-level security policies in Postgres are a stretch goal worth discussing as an "if I were doing this for a real company" interview talking point.

**Enforcement:**
- Every tRPC procedure that touches workspace data must validate that the current user has the required role on the requested workspace.
- Centralize this in middleware. Two layered procedures:
  - `workspaceProcedure` — takes a `workspaceId` input, looks up the user's `WorkspaceMember` row, throws `FORBIDDEN` if missing. Attaches the membership to ctx so downstream code can read the role.
  - `editorProcedure` — composes `workspaceProcedure`, then rejects if `membership.role === VIEWER`. Used for any mutation.
- Never trust `workspaceId` from the client without this check. The DB unique constraint on `(workspaceId, userId)` lets the membership lookup be a single indexed query — fast enough to run on every request.

**Distinction between operational and historical relationships in cascade choices:**
- Operational data (`WorkspaceMember`, `Workspace`) cascades freely — deleting a workspace removes its memberships; deleting a user removes their memberships. The relationship has no meaning once either side is gone.
- Historical data (`PlantParent`, eventually `CrossPollination`) restricts deletes on the historical side — you can't hard-delete a plant that is a parent of another. Soft-delete is the user-facing alternative.

**Roles:**
- `owner` — full control, can delete workspace, can invite/remove members, can change roles
- `editor` — can create/edit/delete plants, trials, seasons, events
- `viewer` — read-only access

---

## 4. Roadmap

The project is divided into phases. Each phase ends with a deployable, presentable state — so the builder can ship at any phase boundary if needed.

### Phase 1 — Foundation (Weeks 1–2)

**Goal:** A live URL where a user can sign up, create a workspace, and add plants.

- Next.js 15 project initialized with T3-style structure
- Clerk auth integrated, signup/login flows working
- Clerk webhook endpoint at `/api/webhooks/clerk` mirroring `user.created`/`user.updated`/`user.deleted` into the local `User` table (signature-verified, idempotent)
- Postgres on Neon, Prisma schema with `User`, `Workspace`, `WorkspaceMember`, `Plant`, `PlantParent` (the genealogy edge table is included in Phase 1 even though the UI to populate it ships in Phase 3 — adding it later means migrating every plant query)
- Soft-delete (`deletedAt`) implemented on `Plant` from the start; default queries filter it out
- `workspaceProcedure` and `editorProcedure` middleware in tRPC, exercised by every workspace-scoped router
- tRPC routers: `workspace.create`, `workspace.list`, `plant.create`, `plant.list`, `plant.get`, `plant.update`, `plant.delete` (soft)
- `workspace.create` runs in a transaction: insert workspace + insert OWNER membership atomically
- Pages: dashboard (list workspaces), workspace home (list plants), plant detail, create plant form
- shadcn/ui set up, basic styled forms and tables
- Deployed to Vercel with environment variables wired up; Neon DB branching mapped to Vercel preview deployments

**Exit criteria:** Builder can register, create a workspace, add a plant, edit it, soft-delete it, see active plants on a dashboard. Live on the internet. Photos and parent selection deferred to later phases.

### Phase 2 — Multi-tenancy & collaboration (Weeks 3–4)

**Goal:** Workspaces are real shared spaces, not just a label.

- Custom invitation flow: invite-token table, email send via Resend (or similar), accept/decline endpoints
- Roles: owner / editor / viewer enforced in tRPC middleware (`workspaceProcedure` / `editorProcedure`)
- Member management UI (list members, change roles, remove members)
- Workspace switcher in nav
- Permissions UI states (read-only views for viewers, hide destructive actions)
- `PlantPhoto` model + file upload (UploadThing or similar) — plants get photos here
- Sole-owner protection: block User deletion (and `OWNER` removal) when it would leave a workspace ownerless

**Exit criteria:** Two users can collaborate in one workspace with different roles. Permissions actually enforced server-side, not just hidden in UI.

### Phase 3 — Genealogy (Weeks 5–6)

**Goal:** The differentiator. Plants have lineage, and the user can see and reason about it.

- `PlantParent` join table, parent selection UI when creating plants
- `CrossPollination` model and "record a cross" flow
- Generation auto-calculation
- Visual family tree (React Flow) — click a plant, see its ancestors/descendants
- Recursive CTE-backed queries

**Exit criteria:** A user can record a cross between two plants, save seeds from it, create F1 children, and view a visual family tree showing the lineage.

### Phase 4 — Trials, seasons & events (Weeks 7–8)

**Goal:** Time and structure. The app becomes a real journal.

- Seasons model, plant-to-season assignment
- Events on plants (sow/germinate/transplant/harvest/death) with dates
- Trials with conditions and outcomes
- Per-season analytics (germination rate, success rate, days-to-germ)
- Photo uploads on events

**Exit criteria:** A user can run a structured trial, record events through the season, and view a season summary with metrics.

### Phase 5 — Polish & shipping (Weeks 9–10)

**Goal:** Portfolio-ready. Real users (even if just five friends).

- Landing page (hero, features, screenshots, demo video) at root URL
- Public plant pages (shareable URLs) with `noindex` toggle
- Demo workspace with seeded data for portfolio screenshots
- Loom or video demo
- README polish, ARCHITECTURE.md, case study writeup
- Sentry, basic analytics (Vercel Analytics or Plausible)
- Submit to communities (Show HN, r/HotPeppers, r/seedsaving) for first users

**Exit criteria:** Live URL, real users, polished portfolio presentation, blog post or detailed README documenting key technical decisions.

### Stretch / later

- Trait inheritance prediction (basic Mendelian model)
- Workspace export as zip (JSON + photos backup)
- Public workspace discovery
- Mobile native via React Native (builder has experience)
- Subscription/billing (Stripe) — pure interview talking point, not actual revenue
- Row-level security migration — interview talking point

---

## 5. Key Architectural Decisions (and open questions)

These are decisions worth documenting as the project progresses. Each one is interview gold.

### Decided

- **tRPC over REST:** End-to-end type safety, eliminates a class of bugs, reduces ceremony. Tradeoff: tRPC is harder to consume from non-TS clients, but we don't have any.
- **Clerk for user identity, not for tenancy:** Clerk handles auth; workspaces, members, roles, and invitations are modeled in our own Postgres schema. Trades ~1 week of build time in Phase 2 for a stronger interview narrative around multi-tenancy and looser vendor coupling.
- **Mirror Clerk users into the local DB.** A `User` row is upserted via Clerk webhook on `user.created`/`user.updated`/`user.deleted`. Lets every FK reference `User.id`, enables single-query joins for member lists, and gives referential integrity. Cost: one webhook handler.
- **Use Clerk's user ID as our `User.id` directly** (string PK, not cuid). No ID-mapping table, no dual-ID confusion in logs.
- **Shared schema multi-tenancy:** Simplest model that fits the use case; schema-per-tenant is unjustified complexity at this scale.
- **Postgres over SQLite:** Recursive CTEs are needed for genealogy queries.
- **Neon over Supabase:** Pure Postgres with branching that maps onto Vercel previews. We aren't using Supabase's bundled auth/storage/realtime, so its complexity isn't paying for itself.
- **Soft delete for plants and cross-pollinations; hard delete for everything else.** Plants and crosses are historical records — a deleted plant may still be referenced as a parent of another plant — so they get a `deletedAt` column and are filtered out of default queries. Workspaces, members, sessions, and similar operational data hard-delete normally. Implementing this in Phase 1 avoids a painful retrofit across every query later.
- **`PlantParent` cascade asymmetry: `Cascade` on child, `Restrict` on parent.** This is what makes soft-delete necessary and useful — `Restrict` prevents hard-deleting a parent and breaking descendants' lineage, while `deletedAt` gives the user "remove from view" semantics that preserve graph integrity.
- **`PlantStatus` and `deletedAt` are separate concerns.** Status (`ACTIVE | DORMANT | DEAD | ARCHIVED`) describes the plant's real-world state; `deletedAt` describes whether the user wants to see it. A dead plant is still visible (with a marker); a soft-deleted plant is hidden. Conflating them is a bug factory.
- **`generation` is stored on `Plant`, not derived on every query.** Computing it from the parent graph each time is expensive for deep lineages, and users sometimes know the generation but not the full lineage (imported data). A mutation recomputes it when parents change.
- **Ownership is a role on `WorkspaceMember`, not a column on `Workspace`.** Supports multiple owners cleanly; no sync between an `ownerId` field and the membership table. "Find owner" becomes a filtered query, which is fine on an indexed small set.
- **Slugs are globally unique and stable on rename.** Workspaces have both `id` (internal cuid FK target) and `slug` (URL handle). Renaming a workspace doesn't change its slug; users can change the URL via an explicit action if needed.
- **`workspace.create` runs in a transaction with the OWNER membership insert.** Otherwise a partial failure leaves an orphaned workspace nobody can access.
- **No `workspaceId` denormalized onto `PlantParent`.** Edges inherit workspace scope through the plants they connect; tRPC enforces it at write time. Defense-in-depth: every genealogy query joins back to `Plant` and filters on `workspaceId`.

### Open questions

- **Variety as string vs. reference table?** Starting as a string for speed. Migrate to a `Variety` lookup table when autocomplete and standardization become valuable (probably Phase 3).
- **How to handle "unknown parent" plants?** When a user has a plant whose lineage is partially known (one parent recorded, the other forgotten). `PlantParent.role = UNKNOWN` handles this, but UX for "I know there's a parent but I don't know which one" needs design in Phase 3.
- **Sole-owner deletion policy.** When the only OWNER of a workspace deletes their account, what happens? Default leaning: block the deletion, force explicit ownership transfer (GitHub model). Alternatives: auto-promote longest-tenured EDITOR; cascade-delete the workspace. Decide before Phase 2 ships member management.
- **Real-time collaboration?** Multiple workspace members editing simultaneously. Not needed for Phase 1–2; revisit if it becomes a pain point.
- **How to model traits?** Free-text tags vs. structured trait taxonomy. Start with tags, formalize later if useful.

---

## 6. Glossary

For the assistant: do not ask the builder what these mean.

- **F0 / F1 / F2 / Fn** — Filial generation. F0 is the original parent generation (founder). F1 is the first generation from a cross. F2 is the result of F1 × F1 (or F1 selfed). Higher numbers = more generations from the original cross.
- **Cross / cross-pollination** — Deliberately pollinating one plant with another to produce hybrid seeds.
- **Selfing / self-pollination** — A plant pollinating itself, producing seeds that are mostly genetically similar to the parent.
- **Stabilization** — The process of growing out generations until traits are predictable. A "stable" variety reliably produces offspring with the desired traits, typically by F6–F8.
- **Dehybridization** — Taking an F1 hybrid and growing successive generations to recover and stabilize specific traits.
- **Variety / cultivar** — A named, distinct kind of plant (e.g., "Carolina Reaper," "Brandywine tomato").
- **Landrace** — A locally adapted variety with genetic diversity, not stabilized in the modern hybrid sense.
- **Phenotype** — The observable traits of a plant (color, size, heat, shape).
- **Genotype** — The underlying genetics; not directly observable without testing.
- **Dominant / recessive trait** — Classic Mendelian inheritance terms for whether a trait shows up in F1 with one copy of the gene vs. requiring two copies.
- **Pod / fruit** — The thing the plant produces. For peppers, pods. For tomatoes, fruits.
- **Sow date** — When the seed was planted.
- **Germination** — The seed sprouting and producing a seedling.
- **Transplant date** — When the seedling was moved from starter cell to its growing location.
- **Hardening off** — Gradually acclimating indoor seedlings to outdoor conditions before planting out.

---

## 7. How to use this document in chats

When starting a new chat in the PlantPath project:

1. Claude has this document as project knowledge — it does not need to be re-explained.
2. State your immediate goal for the session ("Today I want to set up the Clerk integration" / "I'm stuck on the recursive CTE for ancestors").
3. Claude should match the level of detail appropriate to the current phase — early phases are about shipping, later phases about polish and architecture.
4. When making notable decisions, ask Claude to draft a paragraph for ARCHITECTURE.md so the case study writeup builds incrementally instead of all at the end.

---

*Document version: v1 — created at project kickoff. Update freely as decisions evolve.*
