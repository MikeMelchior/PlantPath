import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { HydrateClient } from "~/trpc/server";

const features = [
  {
    icon: "\u{1F331}", // seedling
    title: "Plant tracking",
    description:
      "Catalog every plant with its variety, generation (F0–Fn), traits, status, and notes. Soft-delete keeps historical records intact without cluttering your active view.",
  },
  {
    icon: "\u{1F9EC}", // dna
    title: "Genealogy & lineage",
    description:
      "Record crosses and selfings as first-class events, then explore the family tree. Generations auto-calculate as you build out ancestors and descendants.",
  },
  {
    icon: "\u{1F465}", // people
    title: "Workspaces & collaboration",
    description:
      "Share a workspace with owner, editor, and viewer roles. Permissions are enforced server-side, so collaborators see exactly what they should.",
  },
  {
    icon: "\u{1F9EA}", // test tube
    title: "Trials & seasons",
    description:
      "Group plants by season and run structured trials with hypotheses, conditions, and outcomes. Measure germination and success rates over time.",
  },
  {
    icon: "\u{1F4C5}", // calendar
    title: "Events timeline",
    description:
      "Log sow, germinate, transplant, harvest, and death events with dates and metrics, building a complete journal for every plant you grow.",
  },
] as const;

export default function Home() {
  return (
    <HydrateClient>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
          <nav
            aria-label="Primary"
            className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4"
          >
            <Link
              href="/"
              className="flex items-center gap-2 font-heading text-lg font-semibold"
            >
              <span aria-hidden="true" className="text-xl">
                {"\u{1F331}"}
              </span>
              PlantPath
            </Link>
            <div className="flex items-center gap-2">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button variant="ghost" size="lg">
                    Sign in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button
                    size="lg"
                    className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                  >
                    Sign up
                  </Button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                >
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              </Show>
            </div>
          </nav>
        </header>

        <main className="flex-1">
          {/* Hero */}
          <section
            aria-labelledby="hero-heading"
            className="relative overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/30"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
            />
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <span aria-hidden="true">{"\u{1F33F}"}</span>
                Built for breeders and seed savers
              </span>
              <h1
                id="hero-heading"
                className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-6xl"
              >
                Track every plant, cross, and season in one place.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-pretty sm:text-xl">
                PlantPath replaces the spreadsheets and notebooks small-scale
                plant breeders use to manage lineages, trials, and seasonal
                performance &mdash; so you can focus on growing better varieties.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Show when="signed-out">
                  <SignUpButton mode="modal">
                    <Button
                      size="lg"
                      className="h-11 bg-emerald-600 px-8 text-base text-white hover:bg-emerald-600/90"
                    >
                      Get started free
                    </Button>
                  </SignUpButton>
                  <SignInButton mode="modal">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 px-8 text-base"
                    >
                      Sign in
                    </Button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 bg-emerald-600 px-8 text-base text-white hover:bg-emerald-600/90"
                  >
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                </Show>
              </div>
            </div>
          </section>

          {/* Features */}
          <section
            aria-labelledby="features-heading"
            className="mx-auto w-full max-w-6xl px-6 py-20"
          >
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="features-heading"
                className="font-heading text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Everything your grow needs
              </h2>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                From a single founder seed to a stabilized variety, PlantPath
                keeps the full picture organized.
              </p>
            </div>
            <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li key={feature.title}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <span
                        aria-hidden="true"
                        className="mb-3 flex size-11 items-center justify-center rounded-lg bg-emerald-500/10 text-2xl"
                      >
                        {feature.icon}
                      </span>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription className="mt-1 leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <section
            aria-labelledby="cta-heading"
            className="mx-auto w-full max-w-6xl px-6 pb-24"
          >
            <div className="relative overflow-hidden rounded-3xl bg-emerald-600 px-6 py-16 text-center text-white sm:px-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
              />
              <div className="relative">
                <h2
                  id="cta-heading"
                  className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl"
                >
                  Start cataloging your collection today
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-emerald-50 text-pretty">
                  Free to get started. Bring your plants, build your lineages,
                  and watch your varieties take shape.
                </p>
                <div className="mt-8 flex justify-center">
                  <Show when="signed-out">
                    <SignUpButton mode="modal">
                      <Button
                        size="lg"
                        className="h-11 bg-white px-8 text-base text-emerald-700 hover:bg-white/90"
                      >
                        Create your workspace
                      </Button>
                    </SignUpButton>
                  </Show>
                  <Show when="signed-in">
                    <Button
                      asChild
                      size="lg"
                      className="h-11 bg-white px-8 text-base text-emerald-700 hover:bg-white/90"
                    >
                      <Link href="/dashboard">Go to dashboard</Link>
                    </Button>
                  </Show>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span aria-hidden="true">{"\u{1F331}"}</span>
              PlantPath
            </div>
            <p>
              &copy; {new Date().getFullYear()} PlantPath. A SaaS for plant
              breeders and seed savers.
            </p>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}
