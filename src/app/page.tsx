import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { api, HydrateClient } from "~/trpc/server";


export default async function Home() {
  // const hello = await api.post.hello({ text: "from tRPC" });

  // void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">PlantPath</h1>

      <Show when="signed-out">
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <button className="rounded bg-gray-900 px-4 py-2 text-white">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded border border-gray-900 px-4 py-2">Sign up</button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="rounded bg-gray-900 px-4 py-2 text-white">
            Go to dashboard
          </Link>
          <UserButton />
        </div>
      </Show>
    </main>
    </HydrateClient>
  );
}
