"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Package,
  FolderOpen,
  MapPin,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { itemsApi, categoriesApi, locationsApi } from "@/lib/api/client";

export default function DashboardPage() {
  const { data: itemsData } = useQuery({
    queryKey: ["items", { page: 1, limit: 1 }],
    queryFn: () => itemsApi.list({ page: 1, limit: 1 }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsApi.list(),
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["items", "low-stock"],
    queryFn: () => itemsApi.lowStock(),
  });

  const stats = [
    {
      title: "Total Items",
      value: itemsData?.total ?? 0,
      icon: Package,
      href: "/items",
      gradient: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Categories",
      value: categories?.length ?? 0,
      icon: FolderOpen,
      href: "/categories",
      gradient: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Locations",
      value: locations?.length ?? 0,
      icon: MapPin,
      href: "/locations",
      gradient: "from-violet-500 to-violet-600",
      iconBg: "bg-violet-500/10 dark:bg-violet-400/10",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Low Stock",
      value: lowStockItems?.length ?? 0,
      icon: AlertTriangle,
      href: "/items?low_stock=true",
      gradient: "from-amber-500 to-amber-600",
      iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your home inventory
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <span className="transition-colors group-hover:text-primary">
                View details
              </span>
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {lowStockItems && lowStockItems.length > 0 && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2 dark:bg-amber-400/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-semibold">Low Stock Items</h2>
                  <p className="text-sm text-muted-foreground">
                    Items below minimum quantity
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {lowStockItems.length}
              </span>
            </div>
            <div className="divide-y">
              {lowStockItems.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.location?.name ?? "No location"}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="whitespace-nowrap rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {item.quantity} {item.quantity_unit}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
            {lowStockItems.length > 5 && (
              <div className="border-t p-4">
                <Link
                  href="/items?low_stock=true"
                  className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  View all {lowStockItems.length} low stock items
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Quick Actions</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your inventory
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            <Link
              href="/items/new"
              className="flex items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="rounded-lg bg-blue-500/10 p-2 dark:bg-blue-400/10">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Add Item</p>
                <p className="text-sm text-muted-foreground">
                  Create a new item
                </p>
              </div>
            </Link>
            <Link
              href="/categories"
              className="flex items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="rounded-lg bg-emerald-500/10 p-2 dark:bg-emerald-400/10">
                <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium">Categories</p>
                <p className="text-sm text-muted-foreground">Organize items</p>
              </div>
            </Link>
            <Link
              href="/locations"
              className="flex items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="rounded-lg bg-violet-500/10 p-2 dark:bg-violet-400/10">
                <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-medium">Locations</p>
                <p className="text-sm text-muted-foreground">Storage areas</p>
              </div>
            </Link>
            <Link
              href="/items"
              className="flex items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Browse Items</p>
                <p className="text-sm text-muted-foreground">View all items</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
