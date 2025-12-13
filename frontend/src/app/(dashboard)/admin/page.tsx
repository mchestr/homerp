"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { adminApi, RecentActivityItem } from "@/lib/api/api-client";
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
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
    <div data-testid={testId} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold sm:text-2xl">{value}</p>
          </div>
        </div>
        {trend && trend.value > 0 && (
          <Badge variant="secondary" className="text-xs" data-testid={testId ? `${testId}-trend` : undefined}>
            +{trend.value} {trend.label}
          </Badge>
        )}
      </div>
      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
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
  return (
    <Link href={href} data-testid={testId}>
      <div className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md sm:p-6">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {badge !== undefined && (
            <Badge variant={badgeVariant} data-testid={testId ? `${testId}-badge` : undefined}>{badge}</Badge>
          )}
        </div>
        <div className="mt-4 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4 flex items-center text-sm font-medium text-primary">
          <span>Manage</span>
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
    <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
      <div className="mt-0.5 rounded-full bg-muted p-1.5">{getIcon()}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{activity.title}</p>
          {getStatusBadge()}
        </div>
        {activity.description && (
          <p className="truncate text-xs text-muted-foreground">
            {activity.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {activity.user_email && (
            <span className="truncate">{activity.user_email}</span>
          )}
          <span>·</span>
          <span className="whitespace-nowrap">
            {formatRelativeTime(activity.timestamp)}
          </span>
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <p className="mt-1 text-muted-foreground">
          {t("admin.dashboardSubtitle")}
        </p>
      </div>

      {statsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* Key Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" data-testid="admin-metrics-grid">
            <StatCard
              title={t("admin.stats.totalUsers")}
              value={stats.total_users}
              icon={Users}
              trend={
                stats.recent_signups_7d > 0
                  ? { value: stats.recent_signups_7d, label: t("admin.stats.thisWeek") }
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
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4" data-testid="quick-actions-grid">
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
                  badge={stats.pending_feedback_count > 0 ? stats.pending_feedback_count : undefined}
                  badgeVariant={stats.pending_feedback_count > 0 ? "destructive" : "secondary"}
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
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">
                {t("admin.recentActivity")}
              </h2>
              <div className="rounded-xl border bg-card" data-testid="recent-activity-feed">
                {stats.recent_activity.length > 0 ? (
                  <div className="max-h-[400px] divide-y overflow-y-auto">
                    {stats.recent_activity.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center" data-testid="no-activity-message">
                    <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("admin.noRecentActivity")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4" data-testid="additional-stats-grid">
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
