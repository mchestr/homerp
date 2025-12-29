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
  User,
  Users,
  ChevronDown,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { canEdit, isViewingSharedInventory, selectedInventory } =
    useInventory();
  const t = useTranslations();

  const ownerName =
    selectedInventory?.name ||
    selectedInventory?.email ||
    t("inventory.sharedInventory");

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
    usesOwnData: true,
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

  // When viewing shared inventory, hide sections that use own data
  // (AI Tools, Account, Admin) to avoid confusion
  const visibleSections = isViewingSharedInventory
    ? allSections.filter((section) => !section.usesOwnData)
    : allSections;

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
          className="bg-background/80 fixed inset-0 z-40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          "bg-card fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 ease-in-out md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg shadow-xs transition-transform group-hover:scale-105">
              <Package className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">HomERP</span>
          </Link>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inventory Switcher */}
        <div className="px-3 py-4">
          <InventorySwitcher />
        </div>

        {/* Shared Inventory Indicator */}
        {isViewingSharedInventory && (
          <div className="border-b px-3 pb-4">
            <div
              data-testid="shared-inventory-banner"
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950"
            >
              <Users className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="min-w-0 flex-1 truncate text-blue-700 dark:text-blue-300">
                {ownerName}
              </span>
              <Badge
                data-testid="shared-inventory-role-badge"
                variant={canEdit ? "default" : "secondary"}
                className="h-5 shrink-0 text-xs"
              >
                {canEdit ? t("inventory.editor") : t("inventory.viewer")}
              </Badge>
            </div>
          </div>
        )}

        {/* Quick Action - only show if user can edit */}
        {canEdit && (
          <div className="border-b px-3 pb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="w-full gap-2"
                  data-testid="new-item-dropdown"
                >
                  <Plus className="h-4 w-4" />
                  {t("sidebar.newItem")}
                  <ChevronDown className="ml-auto h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuItem asChild>
                  <Link
                    href="/items/new"
                    onClick={onClose}
                    className="flex items-center gap-2"
                    data-testid="new-single-item-link"
                  >
                    <Package className="h-4 w-4" />
                    {t("sidebar.newItem")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/items/batch-upload"
                    onClick={onClose}
                    className="flex items-center gap-2"
                    data-testid="batch-upload-link"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {t("sidebar.batchUpload")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <nav className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <h3 className="text-muted-foreground mb-2 px-3 text-[11px] font-medium tracking-wider uppercase">
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
            ))}
          </nav>
        </div>

        {/* User Profile */}
        <div className="border-t px-4 py-3" data-testid="sidebar-user-profile">
          <div className="flex items-center gap-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || "User"}
                className="ring-border h-8 w-8 rounded-full ring-2"
              />
            ) : (
              <div className="bg-muted ring-border flex h-8 w-8 items-center justify-center rounded-full ring-2">
                <User className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.name || user?.email}
              </p>
              {user?.name && (
                <p className="text-muted-foreground truncate text-xs">
                  {user?.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4">
          <p className="text-muted-foreground text-[11px]">
            {t("app.tagline")}
          </p>
        </div>
      </div>
    </>
  );
}
