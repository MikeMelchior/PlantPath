# PlantPath

Track plant lineages, cross-pollinations, and trial outcomes — replacing the spreadsheets and notebooks small-scale plant breeders and seed savers use today.

🌐 **Live demo:** [plantpath.vercel.app](https://plantpath.vercel.app)

> **Status:** Currently in Phase 1 (foundation). Auth, deployment, and the core data model are live; workspace and plant management are next. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design and the foundational spec for the phase-by-phase plan.

<!-- TODO: replace with screenshot of the dashboard once workspace UI lands -->
<!-- ![PlantPath dashboard](./docs/screenshot.png) -->

## What it does

Plant breeders working at small scale — hobbyists stabilizing pepper crosses, seed savers preserving heirloom tomatoes, university students running variety trials — track their work in spreadsheets that weren't designed for it. Lineage gets lost between tabs. Generation numbers drift. Photos live somewhere else. PlantPath is purpose-built for this workflow: every plant has a record, every cross-pollination produces traceable F1 children, and the genealogy graph is queryable end-to-end.

## Stack

- **Framework:** [Next.js 15](https://nextjs.org) (App Router) + TypeScript
- **API:** [tRPC](https://trpc.io) for end-to-end type-safe procedures
- **Database:** PostgreSQL on [Neon](https://neon.com), accessed via [Prisma](https://prisma.io)
- **Auth:** [Clerk](https://clerk.com) (user identity only — tenancy is rolled by hand; see [ARCHITECTURE.md](./ARCHITECTURE.md))
- **UI:** [shadcn/ui](https://ui.shadcn.com) on [Tailwind CSS](https://tailwindcss.com)
- **Hosting:** [Vercel](https://vercel.com) with preview deployments per PR

## Architecture

The substantive design decisions — multi-tenancy without Clerk Organizations, the genealogy graph as a join table, soft-delete driven by cascade integrity, the user-mirror webhook — are documented in [**ARCHITECTURE.md**](./ARCHITECTURE.md). Start there if you're skimming the project to understand how it's built.

## Local development

```bash
# 1. Clone and install
git clone https://github.com/<your-username>/plantpath.git
cd plantpath
npm install

# 2. Configure environment
cp .env.example .env
# Then fill in:
#   DATABASE_URL                 — Postgres connection (e.g. Neon pooled URL)
#   DIRECT_URL                   — Direct Postgres URL (for migrations)
#   CLERK_SECRET_KEY             — From the Clerk dashboard
#   CLERK_WEBHOOK_SECRET         — From the Clerk webhook config
#   NEXT_PUBLIC_CLERK_*          — Publishable key and redirect URLs

# 3. Run migrations
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

The app will be at [localhost:3000](http://localhost:3000). Sign up creates a real Clerk user, but the local webhook can't fire from Clerk to your machine without a tunnel — to test the User mirror end-to-end, deploy to a preview and let Clerk hit your Vercel URL.

## Project status

PlantPath is being built as a portfolio project. The roadmap is structured into phases, each ending in a deployable, presentable state:

| Phase | Focus | Status |
|---|---|---|
| 1 | Foundation: auth, workspace, plant CRUD, deployment | In progress |
| 2 | Multi-tenancy: invitations, roles, photo uploads | Not started |
| 3 | Genealogy: cross-pollination, family trees, recursive CTE queries | Not started |
| 4 | Trials, seasons, and events | Not started |
| 5 | Polish, demo workspace, public launch | Not started |