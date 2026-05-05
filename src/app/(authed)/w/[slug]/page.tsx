import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";

export default async function WorkspacePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    let workspace;
    try {
        workspace = await api.workspace.getBySlug({ slug });
    } catch (err) {
        if (err instanceof TRPCError && err.code === "NOT_FOUND") {
            notFound();
        }
        throw err;
    }

    return (
        <main className="container mx-auto max-w-5xl px-6 py-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold">{workspace.name}</h1>
                <p className="text-sm text-muted-foreground">
                    Your role: {workspace.role.toLowerCase()}
                </p>
            </header>

            <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">
                    Plants will be listed here. Coming in the next PR.
                </p>
            </div>
        </main>
    );
}