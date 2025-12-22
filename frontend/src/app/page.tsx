"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("landing");

  return (
    <main className="bg-background min-h-dvh">
      {/* Navigation */}
      <header className="bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-xl">
              <Package
                className="text-primary-foreground h-5 w-5"
                aria-hidden="true"
              />
            </div>
            <span className="text-xl font-bold tracking-tight">HomERP</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {t("nav.features")}
            </Link>
            <Link
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {t("nav.howItWorks")}
            </Link>
            <Link
              href="#pricing"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {t("nav.pricing")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors sm:block"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            >
              {t("nav.getStarted")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background gradient effects */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="animate-float animate-pulse-slow absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-500/20 via-teal-500/20 to-cyan-500/20 blur-3xl" />
          <div className="animate-float animation-delay-300 animate-pulse-slow absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {t("hero.title")}
              <span className="mt-2 block bg-gradient-to-r from-blue-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-teal-400 dark:to-cyan-400">
                {t("hero.titleHighlight")}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg sm:text-xl">
              {t("hero.description")}
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="animate-gradient group relative inline-flex h-14 min-h-[44px] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-teal-600 to-cyan-600 px-8 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl sm:w-auto"
              >
                <span className="relative z-10 flex items-center">
                  {t("hero.startFree")}
                  <ArrowRight
                    className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Link>
              <Link
                href="#features"
                className="bg-background hover:bg-muted inline-flex h-14 min-h-[44px] w-full items-center justify-center rounded-2xl border px-8 text-base font-medium transition-colors sm:w-auto"
              >
                {t("hero.seeHowItWorks")}
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2" aria-hidden="true">
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
                  {t("hero.joinHobbyists")}
                </span>
              </div>
            </div>
          </div>

          {/* App Preview Mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="bg-card overflow-hidden rounded-2xl border shadow-2xl">
              <div className="bg-muted/50 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full bg-red-500"
                    aria-hidden="true"
                  />
                  <div
                    className="h-3 w-3 rounded-full bg-yellow-500"
                    aria-hidden="true"
                  />
                  <div
                    className="h-3 w-3 rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground ml-4 text-sm">
                    {t("mockup.dashboard")}
                  </span>
                </div>
              </div>
              <div className="bg-muted/30 p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                  {/* Stat cards */}
                  {[
                    {
                      labelKey: "mockup.totalItems" as const,
                      value: "1,247",
                      icon: Package,
                      color: "text-blue-500",
                    },
                    {
                      labelKey: "mockup.categories" as const,
                      value: "48",
                      icon: FolderTree,
                      color: "text-emerald-500",
                    },
                    {
                      labelKey: "mockup.locations" as const,
                      value: "23",
                      icon: MapPin,
                      color: "text-teal-500",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.labelKey}
                      className="bg-card rounded-xl border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-muted rounded-lg p-2">
                          <stat.icon
                            className={`h-5 w-5 ${stat.color}`}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            {t(stat.labelKey)}
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
                    <span className="font-medium">
                      {t("mockup.recentItems")}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {t("mockup.viewAll")}
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
                            <Box
                              className="text-muted-foreground h-5 w-5"
                              aria-hidden="true"
                            />
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
            <div
              className="animate-float animation-delay-200 absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="animate-float animation-delay-500 absolute -top-4 -left-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 blur-2xl"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {t("features.sectionTitle")}
              <span className="text-primary">
                {" "}
                {t("features.sectionTitleHighlight")}
              </span>
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              {t("features.sectionDescription")}
            </p>
          </div>

          {/* Bento Grid */}
          <div className="mt-16 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {/* AI Classification - Large card */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg sm:col-span-2 sm:p-8">
              <div
                className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-gradient-to-br from-blue-500/20 to-teal-500/20 blur-3xl transition-opacity group-hover:opacity-70"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-blue-500/10 to-teal-500/10 p-3 dark:from-blue-400/10 dark:to-teal-400/10">
                  <Camera
                    className="h-7 w-7 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mb-2 text-xl font-semibold sm:text-2xl">
                  {t("features.aiClassification.title")}
                </h3>
                <p className="text-muted-foreground max-w-lg">
                  {t("features.aiClassification.description")}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    t("features.aiClassification.tags.autoCategorize"),
                    t("features.aiClassification.tags.extractSpecs"),
                    t("features.aiClassification.tags.suggestStorage"),
                    t("features.aiClassification.tags.multiImage"),
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
                <FolderTree
                  className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.organization.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.organization.description")}
              </p>
            </div>

            {/* Low Stock Alerts */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-amber-500/10 p-3 dark:bg-amber-400/10">
                <Bell
                  className="h-6 w-6 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.alerts.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.alerts.description")}
              </p>
            </div>

            {/* AI Assistant */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-teal-500/10 p-3 dark:bg-teal-400/10">
                <MessageSquare
                  className="h-6 w-6 text-teal-600 dark:text-teal-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.assistant.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.assistant.description")}
              </p>
            </div>

            {/* QR Codes */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-cyan-500/10 p-3 dark:bg-cyan-400/10">
                <QrCode
                  className="h-6 w-6 text-cyan-600 dark:text-cyan-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.qrCodes.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.qrCodes.description")}
              </p>
            </div>

            {/* Collaboration - Wide card */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg sm:col-span-2 lg:col-span-1">
              <div className="mb-4 inline-flex rounded-2xl bg-indigo-500/10 p-3 dark:bg-indigo-400/10">
                <Users
                  className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.collaboration.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.collaboration.description")}
              </p>
            </div>

            {/* Gridfinity */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-3 dark:bg-orange-400/10">
                <LayoutGrid
                  className="h-6 w-6 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.gridfinity.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.gridfinity.description")}
              </p>
            </div>

            {/* Analytics */}
            <div className="group bg-card relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-2xl bg-rose-500/10 p-3 dark:bg-rose-400/10">
                <TrendingUp
                  className="h-6 w-6 text-rose-600 dark:text-rose-400"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("features.analytics.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("features.analytics.description")}
              </p>
            </div>
          </div>

          {/* Additional features list */}
          <div className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {[
              {
                icon: Smartphone,
                textKey: "features.additional.mobileFirst" as const,
              },
              { icon: Tags, textKey: "features.additional.tagging" as const },
              {
                icon: ScanLine,
                textKey: "features.additional.batchUpload" as const,
              },
              { icon: Shield, textKey: "features.additional.secure" as const },
            ].map((feature) => (
              <div
                key={feature.textKey}
                className="bg-card/50 flex items-center gap-3 rounded-xl border p-4"
              >
                <feature.icon
                  className="text-muted-foreground h-5 w-5"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">
                  {t(feature.textKey)}
                </span>
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
              {t("howItWorks.sectionTitle")}
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              {t("howItWorks.sectionDescription")}
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Camera,
                titleKey: "howItWorks.steps.snap.title" as const,
                descriptionKey: "howItWorks.steps.snap.description" as const,
                color: "from-blue-500 to-cyan-500",
              },
              {
                step: "02",
                icon: Sparkles,
                titleKey: "howItWorks.steps.classify.title" as const,
                descriptionKey:
                  "howItWorks.steps.classify.description" as const,
                color: "from-teal-500 to-cyan-500",
              },
              {
                step: "03",
                icon: Package,
                titleKey: "howItWorks.steps.organize.title" as const,
                descriptionKey:
                  "howItWorks.steps.organize.description" as const,
                color: "from-emerald-500 to-teal-500",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {index < 2 && (
                  <div
                    className="absolute top-12 left-full hidden w-full md:block"
                    aria-hidden="true"
                  >
                    <ChevronRight className="text-muted-foreground/30 mx-auto h-8 w-8" />
                  </div>
                )}
                <div className="bg-card rounded-3xl border p-6 sm:p-8">
                  <div
                    className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color}`}
                  >
                    <item.icon
                      className="h-6 w-6 text-white"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-muted-foreground mb-2 text-sm font-medium">
                    {t("howItWorks.step")} {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    {t(item.titleKey)}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(item.descriptionKey)}
                  </p>
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
                <Zap className="h-4 w-4 text-teal-500" aria-hidden="true" />
                <span className="font-medium">{t("aiShowcase.poweredBy")}</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("aiShowcase.title")}
              </h2>
              <p className="text-muted-foreground mt-4 text-lg">
                {t("aiShowcase.description")}
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  t("aiShowcase.features.identify"),
                  t("aiShowcase.features.specs"),
                  t("aiShowcase.features.storage"),
                  t("aiShowcase.features.duplicates"),
                  t("aiShowcase.features.declutter"),
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10"
                      aria-hidden="true"
                    >
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
                    <MessageSquare
                      className="h-5 w-5 text-white"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="font-medium">
                    {t("aiShowcase.assistantTitle")}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="bg-muted rounded-2xl rounded-tl-none p-4">
                    <p className="text-sm">{t("aiShowcase.sampleQuestion")}</p>
                  </div>
                  <div className="bg-primary/5 rounded-2xl rounded-tr-none p-4">
                    <p className="text-sm">{t("aiShowcase.sampleAnswer")}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>
                        • <strong>{t("aiShowcase.sampleItems.mega")}</strong> —{" "}
                        {t("aiShowcase.sampleItems.megaLocation")}
                      </li>
                      <li>
                        • <strong>{t("aiShowcase.sampleItems.uno")}</strong> —{" "}
                        {t("aiShowcase.sampleItems.unoLocation")}
                      </li>
                      <li>
                        • <strong>{t("aiShowcase.sampleItems.nano")}</strong> —{" "}
                        {t("aiShowcase.sampleItems.nanoLocation")}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div
                className="animate-float animate-pulse-slow absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 blur-2xl"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      {/* Final CTA */}
      <section className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-teal-600 to-cyan-600 px-8 py-16 text-center sm:px-16 sm:py-24">
            <div
              className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtOGMwLTIuMjA5LTEuNzkxLTQtNC00cy00IDEuNzkxLTQgNCAxLjc5MSA0IDQgNCA0LTEuNzkxIDQtNHptOCA4YzAtMi4yMDktMS43OTEtNC00LTRzLTQgMS43OTEtNCA0IDEuNzkxIDQgNCA0IDQtMS43OTEgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                {t("cta.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
                {t("cta.description")}
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-14 min-h-[44px] w-full items-center justify-center rounded-2xl bg-white px-8 text-base font-semibold text-teal-600 shadow-lg transition-all hover:bg-white/90 hover:shadow-xl sm:w-auto"
                >
                  {t("cta.button")}
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative overflow-hidden border-t">
        {/* Gradient accent line */}
        <div
          className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-teal-500/50 to-transparent"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand section */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-600">
                  <Package className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-bold">HomERP</span>
              </div>
              <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
                {t("footer.tagline")}
              </p>
            </div>

            {/* Product links */}
            <div>
              <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase">
                {t("footer.product")}
              </h3>
              <ul className="space-y-3">
                {[
                  {
                    labelKey: "footer.featuresLink" as const,
                    href: "#features",
                  },
                  {
                    labelKey: "footer.howItWorksLink" as const,
                    href: "#how-it-works",
                  },
                  { labelKey: "footer.pricingLink" as const, href: "#pricing" },
                ].map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Features links */}
            <div>
              <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase">
                {t("footer.featuresSection")}
              </h3>
              <ul className="space-y-3">
                {[
                  t("footer.aiClassification"),
                  t("footer.qrCodes"),
                  t("footer.lowStockAlerts"),
                  t("footer.collaborationLink"),
                ].map((feature) => (
                  <li key={feature}>
                    <span className="text-muted-foreground text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Get Started */}
            <div>
              <h3 className="mb-4 text-sm font-semibold tracking-wider uppercase">
                {t("footer.getStarted")}
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {t("footer.startOrganizing")}
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("footer.signUpFree")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
            <p className="text-muted-foreground text-center text-sm">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {t("footer.signInLink")}
              </Link>
              <div className="text-muted-foreground/50 hidden items-center gap-2 text-xs sm:flex">
                <span
                  className="flex h-2 w-2 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                {t("footer.systemStatus")}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
