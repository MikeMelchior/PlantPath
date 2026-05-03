import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  // const hello = await api.post.hello({ text: "from tRPC" });

  // void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-4xl font-bold">PlantPath</h1>
      </main>
    </HydrateClient>
  );
}
