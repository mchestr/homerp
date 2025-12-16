"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Package,
  FolderOpen,
  MapPin,
  AlertTriangle,
  ArrowRight,
  Plus,
  Boxes,
  TrendingUp,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { itemsApi, categoriesApi, locationsApi } from "@/lib/api/api-client";
import { formatDateShort, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const tCheckInOut = useTranslations("checkInOut");

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => itemsApi.dashboardStats(30),
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["items", "low-stock"],
    queryFn: () => itemsApi.lowStock(),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsApi.list(),
  });

  const { data: mostUsedItems } = useQuery({
    queryKey: ["items", "most-used"],
    queryFn: () => itemsApi.getMostUsed(5),
  });

  const { data: recentlyUsedItems } = useQuery({
    queryKey: ["items", "recently-used"],
    queryFn: () => itemsApi.getRecentlyUsed(5),
  });

  const stats = [
    {
      title: t("totalItems"),
      value: dashboardStats?.total_items ?? 0,
      icon: Package,
      href: "/items",
    },
    {
      title: t("totalQuantity"),
      value: dashboardStats?.total_quantity ?? 0,
      icon: Boxes,
      href: "/items",
    },
    {
      title: t("categories"),
      value: categories?.length ?? 0,
      icon: FolderOpen,
      href: "/categories",
    },
    {
      title: t("locations"),
      value: locations?.length ?? 0,
      icon: MapPin,
      href: "/locations",
    },
  ];

  // Calculate cumulative items for the area chart
  const cumulativeData =
    dashboardStats?.items_over_time.reduce(
      (acc, item, index) => {
        const prevTotal = index > 0 ? acc[index - 1].total : 0;
        acc.push({
          date: item.date,
          added: item.count,
          total: prevTotal + item.count,
        });
        return acc;
      },
      [] as { date: string; added: number; total: number }[]
    ) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Link href="/items/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addItem")}
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="group bg-card hover:bg-muted/50 relative rounded-xl border p-5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {stat.title}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className="bg-muted text-muted-foreground rounded-lg p-2.5">
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-muted-foreground group-hover:text-foreground mt-4 flex items-center text-sm transition-colors">
              <span>{tCommon("viewDetails")}</span>
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>

      {/* Items Over Time Chart - Full Width */}
      <div className="bg-card rounded-xl border">
        <div className="border-b px-5 py-4">
          <h2 className="font-medium">{t("itemsOverTime")}</h2>
          <p className="text-muted-foreground text-sm">{t("last30Days")}</p>
        </div>
        <div className="p-5">
          {statsLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
          ) : cumulativeData.length > 0 &&
            cumulativeData.some((d) => d.added > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={cumulativeData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorItems" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateShort(value)}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--muted-foreground))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={({ active, payload, label }) => {
                    if (
                      active &&
                      payload &&
                      payload.length &&
                      typeof label === "string"
                    ) {
                      return (
                        <div className="bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-xs">
                          <span className="font-medium">
                            {formatDateShort(label as string)}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {payload[0].payload.added} added
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="added"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorItems)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center text-center">
              <Package className="text-muted-foreground/50 h-10 w-10" />
              <p className="text-muted-foreground mt-2 text-sm">
                {t("noItemsAdded")}
              </p>
              <Link href="/items/new" className="mt-3">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("addFirstItem")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Category and Location Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Items by Category Chart */}
        <div className="bg-card rounded-xl border">
          <div className="border-b px-5 py-4">
            <h2 className="font-medium">{t("itemsByCategory")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("topCategories")}
            </p>
          </div>
          <div className="p-5">
            {statsLoading ? (
              <div className="flex h-[250px] items-center justify-center">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
              </div>
            ) : dashboardStats?.items_by_category &&
              dashboardStats.items_by_category.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={dashboardStats.items_by_category}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    width={100}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-xs">
                            <span className="font-medium">
                              {payload[0].payload.name}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {payload[0].value} items
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    fill="hsl(var(--primary))"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] flex-col items-center justify-center text-center">
                <FolderOpen className="text-muted-foreground/50 h-10 w-10" />
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("noCategoriesWithItems")}
                </p>
                <Link href="/categories" className="mt-3">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("createCategory")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Items by Location Chart */}
        <div className="bg-card rounded-xl border">
          <div className="border-b px-5 py-4">
            <h2 className="font-medium">{t("itemsByLocation")}</h2>
            <p className="text-muted-foreground text-sm">{t("topLocations")}</p>
          </div>
          <div className="p-5">
            {statsLoading ? (
              <div className="flex h-[250px] items-center justify-center">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
              </div>
            ) : dashboardStats?.items_by_location &&
              dashboardStats.items_by_location.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={dashboardStats.items_by_location}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    width={100}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-xs">
                            <span className="font-medium">
                              {payload[0].payload.name}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {payload[0].value} items
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    fill="hsl(142 76% 36%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] flex-col items-center justify-center text-center">
                <MapPin className="text-muted-foreground/50 h-10 w-10" />
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("noLocationsWithItems")}
                </p>
                <Link href="/locations" className="mt-3">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("createLocation")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Most Used and Recently Used */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Used Items */}
        <div className="bg-card rounded-xl border">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-medium">{tCheckInOut("mostUsed")}</h2>
              <p className="text-muted-foreground text-sm">
                {tCheckInOut("totalCheckOuts")}
              </p>
            </div>
          </div>
          {mostUsedItems && mostUsedItems.length > 0 ? (
            <div className="divide-y">
              {mostUsedItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="group hover:bg-muted/50 flex items-center justify-between px-5 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="rounded-md bg-blue-500/10 px-2 py-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {item.total_check_outs}x
                    </span>
                    <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex h-[150px] flex-col items-center justify-center text-center">
              <TrendingUp className="text-muted-foreground/50 h-10 w-10" />
              <p className="text-muted-foreground mt-2 text-sm">
                {tCheckInOut("noUsageYet")}
              </p>
            </div>
          )}
        </div>

        {/* Recently Used Items */}
        <div className="bg-card rounded-xl border">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-medium">{tCheckInOut("recentlyUsed")}</h2>
              <p className="text-muted-foreground text-sm">
                {tCheckInOut("lastUsed")}
              </p>
            </div>
          </div>
          {recentlyUsedItems && recentlyUsedItems.length > 0 ? (
            <div className="divide-y">
              {recentlyUsedItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="group hover:bg-muted/50 flex items-center justify-between px-5 py-3 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`rounded-lg p-1.5 ${
                        item.action_type === "check_out"
                          ? "bg-red-500/10"
                          : "bg-green-500/10"
                      }`}
                    >
                      {item.action_type === "check_out" ? (
                        <LogOut className="h-3 w-3 text-red-600 dark:text-red-400" />
                      ) : (
                        <LogIn className="h-3 w-3 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <p className="truncate font-medium">{item.name}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {formatDate(item.last_used)}
                    </span>
                    <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex h-[150px] flex-col items-center justify-center text-center">
              <Clock className="text-muted-foreground/50 h-10 w-10" />
              <p className="text-muted-foreground mt-2 text-sm">
                {tCheckInOut("noUsageYet")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Section */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="bg-card rounded-xl border">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-medium">{t("lowStockItems")}</h2>
                <p className="text-muted-foreground text-sm">
                  {t("belowMinimum")}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              {lowStockItems.length}
            </span>
          </div>
          <div className="divide-y">
            {lowStockItems.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="group hover:bg-muted/50 flex items-center justify-between px-5 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {item.location?.name ?? t("noLocation")}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="rounded-md bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                    {item.quantity} {item.quantity_unit}
                  </span>
                  <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
          {lowStockItems.length > 5 && (
            <div className="border-t px-5 py-3">
              <Link
                href="/items?low_stock=true"
                className="text-primary hover:text-primary/80 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
              >
                {t("viewAllItems", { count: lowStockItems.length })}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
