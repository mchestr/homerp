"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  MapPin,
  Grid3X3,
  Settings,
  Plus,
  X,
  Shield,
  Sparkles,
  CreditCard,
  MessageSquare,
  Bot,
  ArrowRightFromLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useInventory } from "@/context/inventory-context";
import { InventorySwitcher } from "@/components/layout/inventory-switcher";

interface NavSection {
  label: string;
  items: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  usesOwnData?: boolean;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canEdit, isViewingSharedInventory } = useInventory();
  const t = useTranslations();

  const navSections: NavSection[] = [
    {
      label: t("nav.overview"),
      items: [
        {
          title: t("sidebar.dashboard"),
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: t("nav.inventory"),
      items: [
        {
          title: t("sidebar.items"),
          href: "/items",
          icon: Package,
        },
        {
          title: t("sidebar.categories"),
          href: "/categories",
          icon: FolderOpen,
        },
        {
          title: t("sidebar.locations"),
          href: "/locations",
          icon: MapPin,
        },
        {
          title: t("sidebar.checkedOutItems"),
          href: "/checked-out",
          icon: ArrowRightFromLine,
        },
        {
          title: t("sidebar.storagePlanner"),
          href: "/gridfinity",
          icon: Grid3X3,
        },
      ],
    },
    {
      label: t("nav.aiTools"),
      usesOwnData: true,
      items: [
        {
          title: t("sidebar.aiAssistant"),
          href: "/ai-assistant",
          icon: Bot,
        },
        {
          title: t("sidebar.classifiedImages"),
          href: "/images/classified",
          icon: Sparkles,
        },
        {
          title: t("sidebar.declutterSuggestions"),
          href: "/declutter-suggestions",
          icon: Sparkles,
        },
      ],
    },
    {
      label: t("nav.account"),
      usesOwnData: true,
      items: [
        {
          title: t("sidebar.settings"),
          href: "/settings",
          icon: Settings,
        },
        {
          title: t("sidebar.billing"),
          href: "/settings/billing",
          icon: CreditCard,
        },
        {
          title: t("sidebar.feedback"),
          href: "/feedback",
          icon: MessageSquare,
        },
      ],
    },
  ];

  const adminSection: NavSection = {
    label: t("nav.admin"),
    items: [
      {
        title: t("sidebar.adminPanel"),
        href: "/admin",
        icon: Shield,
      },
    ],
  };

  const allSections = user?.is_admin
    ? [...navSections, adminSection]
    : navSections;

  const isItemActive = (href: string) => {
    if (href === "/settings" && pathname === "/settings/billing") return false;
    return (
      pathname === href ||
      (href !== "/dashboard" &&
        href !== "/settings" &&
        pathname.startsWith(href))
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-300 ease-in-out md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm transition-transform group-hover:scale-105">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">HomERP</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inventory Switcher */}
        <div className="px-3 py-4">
          <InventorySwitcher />
        </div>

        {/* Quick Action - only show if user can edit */}
        {canEdit && (
          <div className="border-b px-3 pb-4">
            <Link href="/items/new" onClick={onClose}>
              <Button size="sm" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                {t("sidebar.newItem")}
              </Button>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-auto px-3 pb-4">
          <nav className="space-y-6">
            {allSections.map((section) => {
              // When viewing shared inventory, sections that DON'T use own data
              // (i.e., show the shared user's inventory) should be highlighted blue
              const isSharedDataSection =
                isViewingSharedInventory && !section.usesOwnData;

              return (
                <div key={section.label}>
                  <h3
                    className={cn(
                      "mb-2 px-3 text-[11px] font-medium uppercase tracking-wider",
                      isSharedDataSection
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {section.label}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = isItemActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          data-testid={`sidebar-link-${item.href.replace(/\//g, "-").replace(/^-/, "")}`}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : isSharedDataSection
                                ? "text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4">
          <p className="text-[11px] text-muted-foreground">
            {t("app.tagline")}
          </p>
        </div>
      </div>
    </>
  );
}
