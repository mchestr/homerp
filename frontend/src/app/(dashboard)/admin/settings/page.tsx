"use client";

import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BillingSettingsSection,
  CreditPacksSection,
  PricingSection,
  AIModelsSection,
} from "./components";

type SettingsTab = "billing" | "packs" | "pricing" | "ai-models";

const VALID_TABS: SettingsTab[] = ["billing", "packs", "pricing", "ai-models"];

function SettingsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("admin.settings");

  // Get tab from URL or default to "billing"
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = VALID_TABS.includes(tabParam as SettingsTab)
    ? (tabParam as SettingsTab)
    : "billing";

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/admin/settings?${params.toString()}`);
  };

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="space-y-4 pb-4 sm:space-y-6"
      data-testid="admin-settings-page"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button
            variant="ghost"
            size="icon"
            data-testid="settings-back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm md:mt-1">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <div className="sm:overflow-x-auto">
          <TabsList
            className="inline-flex h-auto w-full gap-1 bg-transparent p-0 sm:w-auto"
            data-testid="settings-tabs"
          >
            <TabsTrigger
              value="billing"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-billing"
            >
              {t("tabs.billing")}
            </TabsTrigger>
            <TabsTrigger
              value="packs"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-packs"
            >
              {t("tabs.creditPacks")}
            </TabsTrigger>
            <TabsTrigger
              value="pricing"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-pricing"
            >
              {t("tabs.pricing")}
            </TabsTrigger>
            <TabsTrigger
              value="ai-models"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-ai-models"
            >
              {t("tabs.aiModels")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="billing" className="mt-4">
          <BillingSettingsSection />
        </TabsContent>

        <TabsContent value="packs" className="mt-4">
          <CreditPacksSection />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <PricingSection />
        </TabsContent>

        <TabsContent value="ai-models" className="mt-4">
          <AIModelsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
