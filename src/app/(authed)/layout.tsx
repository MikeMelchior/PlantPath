import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function AuthedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between border-b px-6 py-4">
                <Link href="/dashboard" className="text-xl font-bold">
                    PlantPath
                </Link>
                <UserButton />
            </header>
            {children}
        </div>
    );
}