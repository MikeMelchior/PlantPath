export default function DashboardLoading() {
    return (
        <main className="container mx-auto max-w-5xl px-6 py-8">
            <div className="mb-8">
                <div className="h-9 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border p-6">
                        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-2 h-4 w-16 animate-pulse rounded bg-muted" />
                    </div>
                ))}
            </div>
        </main>
    );
}