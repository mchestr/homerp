import Link from "next/link";
import {
  Package,
  Camera,
  FolderTree,
  Bell,
  MessageSquare,
  QrCode,
  Users,
  Sparkles,
  ArrowRight,
  Check,
  Zap,
  Shield,
  Smartphone,
  LayoutGrid,
  TrendingUp,
  ChevronRight,
  Box,
  ScanLine,
  Tags,
  MapPin,
} from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";

export default function Home() {
  return (
    <main className="bg-background min-h-dvh">
      {/* Navigation */}
      <header className="bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-xl">
              <Package className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">HomERP</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background gradient effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-float animate-pulse-slow absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-500/20 via-teal-500/20 to-cyan-500/20 blur-3xl" />
          <div className="animate-float animation-delay-300 animate-pulse-slow absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Your home inventory,
              <span className="mt-2 block bg-gradient-to-r from-blue-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-teal-400 dark:to-cyan-400">
                organized by AI
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg sm:text-xl">
              Snap a photo, let AI classify it instantly. Track quantities, set
              alerts, and never lose track of your stuff again. Built for
              hobbyists who love to stay organized.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="animate-gradient group relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-teal-600 to-cyan-600 px-8 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl sm:w-auto"
              >
                <span className="relative z-10 flex items-center">
                  Start Free Today
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
              <Link
                href="#features"
                className="bg-background hover:bg-muted inline-flex h-14 w-full items-center justify-center rounded-2xl border px-8 text-base font-medium transition-colors sm:w-auto"
              >
                See How It Works
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-muted border-background flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium"
                    >
                      {["JD", "SK", "MR", "AL"][i]}
                    </div>
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">
                  Join hobbyists organizing smarter
                </span>
              </div>
            </div>
          </div>

          {/* App Preview Mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="bg-card overflow-hidden rounded-2xl border shadow-2xl">
              <div className="bg-muted/50 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground ml-4 text-sm">
                    HomERP Dashboard
                  </span>
                </div>
              </div>
              <div className="bg-muted/30 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Stat cards */}
                  {[
                    {
                      label: "Total Items",
                      value: "1,247",
                      icon: Package,
                      color: "text-blue-500",
                    },
                    {
                      label: "Categories",
                      value: "48",
                      icon: FolderTree,
                      color: "text-emerald-500",
                    },
                    {
                      label: "Locations",
                      value: "23",
                      icon: MapPin,
                      color: "text-teal-500",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-card rounded-xl border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-muted rounded-lg p-2">
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Item list preview */}
                <div className="bg-card mt-4 rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium">Recent Items</span>
                    <span className="text-muted-foreground text-sm">
                      View all
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        name: "Arduino Mega 2560",
                        category: "Electronics",
                        qty: 3,
                      },
                      { name: "Basil Seeds", category: "Gardening", qty: 100 },
                      {
                        name: "3D Printer Filament",
                        category: "Crafts",
                        qty: 5,
                      },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-background flex h-10 w-10 items-center justify-center rounded-lg">
                            <Box className="text-muted-foreground h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-muted-foreground text-sm">
                              {item.category}
                            </p>
                          </div>
                        </div>
                        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
                          {item.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating accent elements */}
            <div className="animate-float animation-delay-200 absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 blur-2xl" />
            <div className="animate-float animation-delay-500 absolute -top-4 -left-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 blur-2xl" />
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Everything you need to
              <span className="text-primary"> stay organized</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              A complete inventory system designed for hobbyists with AI at its
              core
            </p>
          </div>

          {/* Bento Grid */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* AI Classification - Large card */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg sm:col-span-2 sm:p-8">
              <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-gradient-to-br from-blue-500/20 to-teal-500/20 blur-3xl transition-opacity group-hover:opacity-70" />
              <div className="relative">
                <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-blue-500/10 to-teal-500/10 p-3 dark:from-blue-400/10 dark:to-teal-400/10">
                  <Camera className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="mb-2 text-xl font-semibold sm:text-2xl">
                  AI-Powered Photo Classification
                </h3>
                <p className="text-muted-foreground max-w-lg">
                  Snap a photo and let GPT-4 Vision identify your items
                  automatically. Get instant category suggestions,
                  specifications, and even price estimates.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    "Auto-categorize",
                    "Extract specs",
                    "Suggest storage",
                    "Multi-image support",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-600 dark:bg-blue-400/10 dark:text-blue-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Smart Organization */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-emerald-500/10 p-3 dark:bg-emerald-400/10">
                <FolderTree className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Hierarchical Organization
              </h3>
              <p className="text-muted-foreground text-sm">
                Create unlimited nested categories and locations. From rooms to
                shelves to bins, know exactly where everything is.
              </p>
            </div>

            {/* Low Stock Alerts */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-amber-500/10 p-3 dark:bg-amber-400/10">
                <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Low Stock Alerts</h3>
              <p className="text-muted-foreground text-sm">
                Set minimum quantities and get email notifications when items
                run low. Never run out of essentials again.
              </p>
            </div>

            {/* AI Assistant */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-teal-500/10 p-3 dark:bg-teal-400/10">
                <MessageSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">AI Chat Assistant</h3>
              <p className="text-muted-foreground text-sm">
                Ask questions about your inventory naturally. &quot;What herbs
                do I have?&quot; or &quot;Where did I put my Arduino?&quot;
              </p>
            </div>

            {/* QR Codes */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-cyan-500/10 p-3 dark:bg-cyan-400/10">
                <QrCode className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">QR Codes & Labels</h3>
              <p className="text-muted-foreground text-sm">
                Generate and print QR codes for items and locations. Scan to
                instantly pull up details on your phone.
              </p>
            </div>

            {/* Collaboration - Wide card */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg sm:col-span-2 lg:col-span-1">
              <div className="mb-4 inline-flex rounded-2xl bg-indigo-500/10 p-3 dark:bg-indigo-400/10">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Share & Collaborate
              </h3>
              <p className="text-muted-foreground text-sm">
                Invite family members or collaborators. Set viewer or editor
                permissions for shared inventories.
              </p>
            </div>

            {/* Gridfinity */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-3 dark:bg-orange-400/10">
                <LayoutGrid className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Gridfinity Support</h3>
              <p className="text-muted-foreground text-sm">
                Visual bin layout designer with drag-and-drop. Perfect for
                organizing small parts and maker supplies.
              </p>
            </div>

            {/* Analytics */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-rose-500/10 p-3 dark:bg-rose-400/10">
                <TrendingUp className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Usage Analytics</h3>
              <p className="text-muted-foreground text-sm">
                Track check-ins/check-outs, see usage patterns, and get insights
                into your inventory over time.
              </p>
            </div>
          </div>

          {/* Additional features list */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Smartphone, text: "Mobile-first design" },
              { icon: Tags, text: "Flexible tagging system" },
              { icon: ScanLine, text: "Batch upload & import" },
              { icon: Shield, text: "Secure & private" },
            ].map((feature) => (
              <div
                key={feature.text}
                className="bg-card/50 flex items-center gap-3 rounded-xl border p-4"
              >
                <feature.icon className="text-muted-foreground h-5 w-5" />
                <span className="text-sm font-medium">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="bg-muted/30 border-t py-20 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Get organized in minutes
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Three simple steps to transform how you manage your stuff
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Camera,
                title: "Snap a Photo",
                description:
                  "Take a picture of any item. Our AI identifies it instantly and extracts all the important details.",
                color: "from-blue-500 to-cyan-500",
              },
              {
                step: "02",
                icon: Sparkles,
                title: "AI Classifies It",
                description:
                  "GPT-4 Vision suggests categories, locations, and specifications. One click to confirm and save.",
                color: "from-teal-500 to-cyan-500",
              },
              {
                step: "03",
                icon: Package,
                title: "Stay Organized",
                description:
                  "Search, filter, and track everything. Get alerts when stock runs low. Never lose track again.",
                color: "from-emerald-500 to-teal-500",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {index < 2 && (
                  <div className="absolute top-12 left-full hidden w-full md:block">
                    <ChevronRight className="text-muted-foreground/30 mx-auto h-8 w-8" />
                  </div>
                )}
                <div className="bg-card rounded-3xl border p-6 sm:p-8">
                  <div
                    className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color}`}
                  >
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-muted-foreground mb-2 text-sm font-medium">
                    Step {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Showcase */}
      <section className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/10 to-teal-500/10 px-4 py-2 text-sm">
                <Zap className="h-4 w-4 text-teal-500" />
                <span className="font-medium">Powered by GPT-4 Vision</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                AI that actually understands your stuff
              </h2>
              <p className="text-muted-foreground mt-4 text-lg">
                Not just image recognition—our AI understands context, extracts
                specifications, and learns your organization patterns.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Identifies products from any angle",
                  "Extracts specifications automatically",
                  "Suggests optimal storage locations",
                  "Finds similar items to prevent duplicates",
                  "Declutter recommendations based on your hobby",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-card rounded-3xl border p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="animate-gradient flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-500">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium">AI Assistant</span>
                </div>
                <div className="space-y-4">
                  <div className="bg-muted rounded-2xl rounded-tl-none p-4">
                    <p className="text-sm">
                      What Arduino boards do I have, and where are they stored?
                    </p>
                  </div>
                  <div className="bg-primary/5 rounded-2xl rounded-tr-none p-4">
                    <p className="text-sm">
                      You have 3 Arduino boards in your inventory:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>
                        • <strong>Arduino Mega 2560</strong> — Garage / Shelf A
                        / Bin 3
                      </li>
                      <li>
                        • <strong>Arduino Uno R3</strong> — Office / Drawer 2
                      </li>
                      <li>
                        • <strong>Arduino Nano</strong> — Workshop / Parts
                        Cabinet
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="animate-float animate-pulse-slow absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      {/* Final CTA */}
      <section className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-teal-600 to-cyan-600 px-8 py-16 text-center sm:px-16 sm:py-24">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtOGMwLTIuMjA5LTEuNzkxLTQtNC00cy00IDEuNzkxLTQgNCAxLjc5MSA0IDQgNCA0LTEuNzkxIDQtNHptOCA4YzAtMi4yMDktMS43OTEtNC00LTRzLTQgMS43OTEtNCA0IDEuNzkxIDQgNCA0IDQtMS43OTEgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                Ready to get organized?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
                Join hobbyists who are organizing smarter with AI. Start free
                today—no credit card required.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-white px-8 text-base font-semibold text-teal-600 shadow-lg transition-all hover:bg-white/90 hover:shadow-xl sm:w-auto"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Package className="text-primary-foreground h-4 w-4" />
              </div>
              <span className="font-semibold">HomERP</span>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Built for hobbyists who love to stay organized.
            </p>
            <div className="flex gap-6">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
