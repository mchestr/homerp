"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { adminApi } from "@/lib/api/client";
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
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage credit packs, users, and view system statistics
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link href="/admin/packs">
          <Button variant="outline" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Manage Packs
          </Button>
        </Link>
        <Link href="/admin/users">
          <Button variant="outline" className="gap-2">
            <UserCog className="h-4 w-4" />
            Manage Users
          </Button>
        </Link>
        <Link href="/admin/feedback">
          <Button variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Manage Feedback
          </Button>
        </Link>
      </div>

      {/* Statistics */}
      {statsLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Users"
            value={stats.total_users}
            icon={Users}
          />
          <StatCard
            title="Total Items"
            value={stats.total_items}
            icon={Package}
          />
          <StatCard
            title="Total Revenue"
            value={formatPrice(stats.total_revenue_cents)}
            icon={DollarSign}
          />
          <StatCard
            title="Active Credit Packs"
            value={stats.active_credit_packs}
            icon={CreditCard}
          />
          <StatCard
            title="Credits Purchased"
            value={stats.total_credits_purchased}
            icon={Coins}
          />
          <StatCard
            title="Credits Used"
            value={stats.total_credits_used}
            icon={TrendingUp}
          />
        </div>
      ) : null}
    </div>
  );
}
