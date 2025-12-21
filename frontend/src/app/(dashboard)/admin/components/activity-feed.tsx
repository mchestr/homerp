"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Loader2,
  UserPlus,
  MessageSquare,
  ShoppingCart,
  Clock,
  AlertCircle,
} from "lucide-react";
import { adminApi, RecentActivityItem } from "@/lib/api/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ActivityFilter = "all" | "signup" | "feedback" | "purchase";

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

interface ActivityFeedProps {
  className?: string;
}

export function ActivityFeed({ className }: ActivityFeedProps) {
  const t = useTranslations("admin.activity");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", filter, page],
    queryFn: () =>
      adminApi.getActivityFeed(
        page,
        limit,
        filter === "all" ? undefined : filter
      ),
  });

  const filters: { value: ActivityFilter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "signup", label: t("filterSignups") },
    { value: "feedback", label: t("filterFeedback") },
    { value: "purchase", label: t("filterPurchases") },
  ];

  return (
    <div
      className={cn("bg-card overflow-hidden rounded-xl border", className)}
      data-testid="recent-activity-feed"
    >
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 border-b p-2 sm:gap-1.5 sm:p-3">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            data-testid={`activity-filter-${f.value}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div data-testid="activity-feed-list">
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="max-h-[350px] divide-y overflow-y-auto">
              {data.items.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t px-2 py-2 sm:px-3">
                <span className="text-muted-foreground text-xs">
                  {page}/{data.total_pages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="min-h-[40px] px-2 text-xs sm:px-3 sm:text-sm"
                  >
                    {t("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(data.total_pages, p + 1))
                    }
                    disabled={page === data.total_pages}
                    className="min-h-[40px] px-2 text-xs sm:px-3 sm:text-sm"
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center p-6 text-center sm:p-8"
            data-testid="no-activity-message"
          >
            <AlertCircle className="text-muted-foreground mb-2 h-6 w-6 sm:h-8 sm:w-8" />
            <p className="text-muted-foreground text-sm">{t("noActivity")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
