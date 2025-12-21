"use client";

import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebhooksSection, APIKeysSection } from "./components";

type IntegrationsTab = "webhooks" | "api-keys";

const VALID_TABS: IntegrationsTab[] = ["webhooks", "api-keys"];

function IntegrationsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("admin.integrations");

  // Get tab from URL or default to "webhooks"
  const tabParam = searchParams.get("tab");
  const activeTab: IntegrationsTab = VALID_TABS.includes(
    tabParam as IntegrationsTab
  )
    ? (tabParam as IntegrationsTab)
    : "webhooks";

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/admin/integrations?${params.toString()}`);
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
      data-testid="admin-integrations-page"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button
            variant="ghost"
            size="icon"
            data-testid="integrations-back-button"
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
            data-testid="integrations-tabs"
          >
            <TabsTrigger
              value="webhooks"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-webhooks"
            >
              {t("tabs.webhooks")}
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm sm:flex-none"
              data-testid="tab-api-keys"
            >
              {t("tabs.apiKeys")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="webhooks" className="mt-4">
          <WebhooksSection />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-4">
          <APIKeysSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminIntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      }
    >
      <IntegrationsPageContent />
    </Suspense>
  );
}
