"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { adminApi, TimeRange } from "@/lib/api/api";
import {
  Users,
  Package,
  DollarSign,
  Coins,
  TrendingUp,
  Loader2,
  CreditCard,
  UserCog,
  MessageSquare,
  Webhook,
  ArrowRight,
  Key,
  Activity,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  TimeRangeSelector,
  RevenueChart,
  SignupsChart,
  CreditActivityChart,
  PackBreakdownChart,
  ActivityFeed,
} from "./components";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  href,
  testId,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: { value: number; label: string };
  href?: string;
  testId?: string;
}) {
  const content = (
    <div
      data-testid={testId}
      className="bg-card hover:bg-accent/50 rounded-xl border p-4 transition-colors sm:p-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <Icon className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="text-xl font-bold sm:text-2xl">{value}</p>
          </div>
        </div>
        {trend && trend.value > 0 && (
          <Badge
            variant="secondary"
            className="text-xs"
            data-testid={testId ? `${testId}-trend` : undefined}
          >
            +{trend.value} {trend.label}
          </Badge>
        )}
      </div>
      {description && (
        <p className="text-muted-foreground mt-2 text-xs">{description}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  badgeVariant = "secondary",
  testId,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number | string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  testId?: string;
}) {
  const t = useTranslations("admin");
  return (
    <Link href={href} data-testid={testId}>
      <div className="bg-card hover:border-primary/50 group flex h-full flex-col rounded-xl border p-4 transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="bg-primary/10 rounded-lg p-2">
            <Icon className="text-primary h-5 w-5" />
          </div>
          {badge !== undefined && (
            <Badge
              variant={badgeVariant}
              data-testid={testId ? `${testId}-badge` : undefined}
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        </div>
        <div className="text-primary mt-3 flex items-center text-xs font-medium">
          <span>{t("manage")}</span>
          <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  // Basic stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    enabled: !!user?.is_admin,
  });

  // Time-series queries
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["admin-revenue", timeRange],
    queryFn: () => adminApi.getRevenueOverTime(timeRange),
    enabled: !!user?.is_admin,
  });

  const { data: signupsData, isLoading: signupsLoading } = useQuery({
    queryKey: ["admin-signups", timeRange],
    queryFn: () => adminApi.getSignupsOverTime(timeRange),
    enabled: !!user?.is_admin,
  });

  const { data: creditData, isLoading: creditLoading } = useQuery({
    queryKey: ["admin-credits", timeRange],
    queryFn: () => adminApi.getCreditActivity(timeRange),
    enabled: !!user?.is_admin,
  });

  const { data: packData, isLoading: packLoading } = useQuery({
    queryKey: ["admin-packs", timeRange],
    queryFn: () => adminApi.getPackBreakdown(timeRange),
    enabled: !!user?.is_admin,
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4 sm:space-y-6 md:space-y-8">
      {/* Header with Time Range Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
            {t("admin.title")}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm md:mt-1">
            {t("admin.dashboardSubtitle")}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {statsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Key Metrics Grid */}
          <div
            className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
            data-testid="admin-metrics-grid"
          >
            <StatCard
              title={t("admin.stats.totalUsers")}
              value={stats.total_users}
              icon={Users}
              trend={
                stats.recent_signups_7d > 0
                  ? {
                      value: stats.recent_signups_7d,
                      label: t("admin.stats.thisWeek"),
                    }
                  : undefined
              }
              href="/admin/users"
              testId="stat-total-users"
            />
            <StatCard
              title={t("admin.stats.totalRevenue")}
              value={formatPrice(stats.total_revenue_cents)}
              icon={DollarSign}
              description={
                revenueData
                  ? `${formatPrice(revenueData.period_revenue_cents)} ${t("admin.stats.inPeriod")}`
                  : undefined
              }
              testId="stat-total-revenue"
            />
            <StatCard
              title={t("admin.stats.creditsUsed")}
              value={`${stats.total_credits_used.toLocaleString()} / ${stats.total_credits_purchased.toLocaleString()}`}
              icon={Coins}
              description={t("admin.stats.usedOfPurchased")}
              testId="stat-credits-used"
            />
            <StatCard
              title={t("admin.stats.totalItems")}
              value={stats.total_items.toLocaleString()}
              icon={Package}
              testId="stat-total-items"
            />
          </div>

          {/* Charts Row 1: Revenue */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Revenue Over Time */}
            <div className="bg-card overflow-hidden rounded-xl border lg:col-span-2">
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-sm font-medium sm:text-base">
                  {t("admin.charts.revenueOverTime")}
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {revenueData?.period_label || timeRange}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <RevenueChart data={revenueData} isLoading={revenueLoading} />
              </div>
            </div>

            {/* Revenue by Pack */}
            <div className="bg-card overflow-hidden rounded-xl border">
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-sm font-medium sm:text-base">
                  {t("admin.charts.revenueByPack")}
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {packData?.period_label || timeRange}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <PackBreakdownChart data={packData} isLoading={packLoading} />
              </div>
            </div>
          </div>

          {/* Charts Row 2: Users & Credits */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* User Signups */}
            <div className="bg-card overflow-hidden rounded-xl border">
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-sm font-medium sm:text-base">
                  {t("admin.charts.userSignups")}
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {signupsData
                    ? `${signupsData.period_signups} ${t("admin.stats.newUsers")} · ${signupsData.period_label}`
                    : timeRange}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <SignupsChart data={signupsData} isLoading={signupsLoading} />
              </div>
            </div>

            {/* Credit Activity */}
            <div className="bg-card overflow-hidden rounded-xl border">
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-sm font-medium sm:text-base">
                  {t("admin.charts.creditActivity")}
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {creditData
                    ? `${t("admin.charts.purchases")}: ${creditData.period_purchased} · ${t("admin.charts.usage")}: ${creditData.period_used}`
                    : timeRange}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <CreditActivityChart
                  data={creditData}
                  isLoading={creditLoading}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions and Activity Feed */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
                {t("admin.quickActions")}
              </h2>
              <div
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="quick-actions-grid"
              >
                <QuickActionCard
                  title={t("admin.users")}
                  description={t("admin.manageUsersDescription")}
                  icon={UserCog}
                  href="/admin/users"
                  badge={stats.total_users}
                  testId="quick-action-users"
                />
                <QuickActionCard
                  title={t("admin.feedback")}
                  description={t("admin.manageFeedbackDescription")}
                  icon={MessageSquare}
                  href="/admin/feedback"
                  badge={
                    stats.pending_feedback_count > 0
                      ? stats.pending_feedback_count
                      : undefined
                  }
                  badgeVariant={
                    stats.pending_feedback_count > 0
                      ? "destructive"
                      : "secondary"
                  }
                  testId="quick-action-feedback"
                />
                <QuickActionCard
                  title={t("admin.creditPacks")}
                  description={t("admin.managePacksDescription")}
                  icon={CreditCard}
                  href="/admin/packs"
                  badge={`${stats.active_credit_packs} ${t("admin.stats.active")}`}
                  testId="quick-action-packs"
                />
                <QuickActionCard
                  title={t("admin.webhooks")}
                  description={t("admin.manageWebhooksDescription")}
                  icon={Webhook}
                  href="/admin/webhooks"
                  testId="quick-action-webhooks"
                />
                <QuickActionCard
                  title={t("admin.apiKeys.title")}
                  description={t("admin.apiKeys.description")}
                  icon={Key}
                  href="/admin/api-keys"
                  testId="quick-action-api-keys"
                />
                <QuickActionCard
                  title={t("admin.aiUsage.title")}
                  description={t("admin.aiUsage.description")}
                  icon={Activity}
                  href="/admin/ai-usage"
                  testId="quick-action-ai-usage"
                />
                <QuickActionCard
                  title={t("admin.pricing.title")}
                  description={t("admin.pricing.description")}
                  icon={Coins}
                  href="/admin/pricing"
                  testId="quick-action-pricing"
                />
                <QuickActionCard
                  title={t("admin.aiModels.title")}
                  description={t("admin.aiModels.description")}
                  icon={Settings}
                  href="/admin/ai-models"
                  testId="quick-action-ai-models"
                />
              </div>
            </div>

            {/* Activity Feed */}
            <div className="order-first lg:order-none">
              <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
                {t("admin.recentActivity")}
              </h2>
              <div className="overflow-hidden">
                <ActivityFeed />
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div
            className="grid gap-3 sm:grid-cols-3 sm:gap-4"
            data-testid="additional-stats-grid"
          >
            <StatCard
              title={t("admin.stats.activePacks")}
              value={stats.active_credit_packs}
              icon={CreditCard}
              href="/admin/packs"
              testId="stat-active-packs"
            />
            <StatCard
              title={t("admin.stats.creditsPurchased")}
              value={stats.total_credits_purchased.toLocaleString()}
              icon={TrendingUp}
              testId="stat-credits-purchased"
            />
            <StatCard
              title={t("admin.stats.pendingFeedback")}
              value={stats.pending_feedback_count}
              icon={MessageSquare}
              href="/admin/feedback"
              testId="stat-pending-feedback"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
