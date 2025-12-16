"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { adminApi, RecentActivityItem } from "@/lib/api/api-client";
import { formatRelativeTime } from "@/lib/utils";
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
  UserPlus,
  ArrowRight,
  Clock,
  AlertCircle,
  ShoppingCart,
  Key,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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
      <div className="group bg-card hover:border-primary/50 flex h-full flex-col rounded-xl border p-3 transition-all hover:shadow-md sm:p-4 md:p-6">
        <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-0">
          <div className="flex w-full items-start justify-between sm:mb-4">
            <div className="bg-primary/10 rounded-lg p-2 sm:p-2.5">
              <Icon className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            {badge !== undefined && (
              <Badge
                variant={badgeVariant}
                data-testid={testId ? `${testId}-badge` : undefined}
                className="text-xs"
              >
                {badge}
              </Badge>
            )}
          </div>
          <div className="min-w-0 flex-1 sm:w-full">
            <div className="flex items-center justify-between">
              <h3 className="truncate text-sm font-semibold sm:text-base">
                {title}
              </h3>
              <ArrowRight className="text-primary ml-2 h-4 w-4 shrink-0 sm:hidden" />
            </div>
            <p className="text-muted-foreground mt-1 hidden text-sm sm:block">
              {description}
            </p>
          </div>
        </div>
        <div className="text-primary mt-4 hidden items-center text-sm font-medium sm:flex">
          <span>{t("manage")}</span>
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ activity }: { activity: RecentActivityItem }) {
  const getIcon = () => {
    switch (activity.type) {
      case "signup":
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case "feedback":
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case "purchase":
        return <ShoppingCart className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = () => {
    if (activity.type === "feedback" && activity.metadata?.status) {
      const status = activity.metadata.status as string;
      const variants: Record<
        string,
        "default" | "secondary" | "destructive" | "outline"
      > = {
        pending: "outline",
        in_progress: "secondary",
        resolved: "default",
        closed: "secondary",
      };
      return (
        <Badge variant={variants[status] || "secondary"} className="text-xs">
          {status.replace("_", " ")}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="hover:bg-muted/50 flex items-start gap-2 rounded-lg p-2 transition-colors sm:gap-3 sm:p-3">
      <div className="bg-muted mt-0.5 shrink-0 rounded-full p-1 sm:p-1.5">
        {getIcon()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium sm:text-sm">
            {activity.title}
          </p>
          {getStatusBadge()}
        </div>
        {activity.description && (
          <p className="text-muted-foreground truncate text-xs">
            {activity.description}
          </p>
        )}
        <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-2">
          <span className="whitespace-nowrap">
            {formatRelativeTime(activity.timestamp)}
          </span>
          {activity.user_email && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="truncate text-xs opacity-75 sm:opacity-100">
                {activity.user_email}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("admin.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin.dashboardSubtitle")}
        </p>
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
              testId="stat-total-revenue"
            />
            <StatCard
              title={t("admin.stats.creditsUsed")}
              value={`${stats.total_credits_used} / ${stats.total_credits_purchased}`}
              icon={Coins}
              description={t("admin.stats.usedOfPurchased")}
              testId="stat-credits-used"
            />
            <StatCard
              title={t("admin.stats.totalItems")}
              value={stats.total_items}
              icon={Package}
              testId="stat-total-items"
            />
          </div>

          {/* Quick Actions and Activity Feed */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold">
                {t("admin.quickActions")}
              </h2>
              <div
                className="grid gap-3 sm:grid-cols-2 sm:gap-4"
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
              </div>
            </div>

            {/* Recent Activity */}
            <div className="order-first lg:order-none">
              <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
                {t("admin.recentActivity")}
              </h2>
              <div
                className="bg-card rounded-xl border"
                data-testid="recent-activity-feed"
              >
                {stats.recent_activity.length > 0 ? (
                  <div className="max-h-[280px] divide-y overflow-y-auto sm:max-h-[400px]">
                    {stats.recent_activity.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center p-6 text-center sm:p-8"
                    data-testid="no-activity-message"
                  >
                    <AlertCircle className="text-muted-foreground mb-2 h-6 w-6 sm:h-8 sm:w-8" />
                    <p className="text-muted-foreground text-sm">
                      {t("admin.noRecentActivity")}
                    </p>
                  </div>
                )}
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
