import Link from "next/link";
import { Package, Camera, FolderOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="bg-background flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <Package className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">HomERP</span>
          </div>
          <Link
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Organize your home
            <span className="text-primary block">inventory effortlessly</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg">
            Snap a photo to identify items automatically. Track quantities, set
            low-stock alerts, and always know where everything is stored.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 w-full items-center justify-center rounded-xl px-8 text-base font-medium shadow-lg transition-all hover:shadow-xl sm:w-auto"
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="bg-background hover:bg-muted inline-flex h-12 w-full items-center justify-center rounded-xl border px-8 text-base font-medium transition-colors sm:w-auto"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      <section id="features" className="bg-muted/30 border-t py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
            Everything you need
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-card rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-400/10">
                <Camera className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Photo Recognition</h3>
              <p className="text-muted-foreground">
                Upload a photo to automatically identify items, extract
                specifications, and get category suggestions.
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10">
                <FolderOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Smart Organization</h3>
              <p className="text-muted-foreground">
                Create custom categories and locations. Filter and search your
                inventory with ease.
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10">
                <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Stock Tracking</h3>
              <p className="text-muted-foreground">
                Set minimum quantities and get alerts when items run low. Never
                run out of essentials again.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="text-muted-foreground mx-auto max-w-6xl px-4 text-center text-sm">
          <p>Built for hobbyists who love to stay organized.</p>
        </div>
      </footer>
    </main>
  );
}
