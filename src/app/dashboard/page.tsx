import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">PlantPath</h1>
        <UserButton />
      </header>

      <main className="flex flex-col items-center justify-center gap-4 py-16">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p>Logged in as user {userId}</p>
      </main>
    </div>
  );
}