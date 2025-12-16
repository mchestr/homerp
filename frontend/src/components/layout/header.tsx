"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, User, Menu, Package, Coins, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useInventory } from "@/context/inventory-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface HeaderProps {
  onMenuClick?: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Pages that show the user's own data (not the shared inventory)
const OWN_DATA_PATHS = [
  "/settings",
  "/ai-assistant",
  "/images/classified",
  "/declutter-suggestions",
  "/feedback",
  "/admin",
];

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, creditBalance } = useAuth();
  const { selectedInventory, isViewingSharedInventory, canEdit } =
    useInventory();
  const t = useTranslations("billing");
  const tInventory = useTranslations("inventory");

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Check if current page shows own data (not affected by shared inventory)
  const isOwnDataPage = OWN_DATA_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Only show banner on pages that actually display shared inventory data
  const showSharedBanner = isViewingSharedInventory && !isOwnDataPage;

  const ownerName =
    selectedInventory?.name ||
    selectedInventory?.email ||
    tInventory("sharedInventory");

  return (
    <header className="bg-card/95 supports-backdrop-filter:bg-card/60 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <Package className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="font-semibold">HomERP</span>
        </Link>
      </div>

      {/* Shared Inventory Banner - only show on pages displaying shared data */}
      {showSharedBanner && (
        <div
          data-testid="shared-inventory-banner"
          className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm dark:border-blue-800 dark:bg-blue-950"
        >
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden text-blue-700 sm:inline dark:text-blue-300">
            {tInventory("viewingInventoryOf", { name: ownerName })}
          </span>
          <span className="text-blue-700 sm:hidden dark:text-blue-300">
            {ownerName}
          </span>
          <Badge
            data-testid="shared-inventory-role-badge"
            variant={canEdit ? "default" : "secondary"}
            className="h-5 text-xs"
          >
            {canEdit ? tInventory("editor") : tInventory("viewer")}
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Credit Balance with Tooltip */}
        {creditBalance !== null && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings/billing"
                  className={`hover:bg-muted flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    creditBalance.total_credits <= 5
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  <Coins className="h-4 w-4" />
                  <span>{creditBalance.total_credits}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-56">
                <div className="space-y-2">
                  <p className="font-semibold">{t("creditTooltipTitle")}</p>
                  <div className="space-y-1 text-xs">
                    <p>
                      {t("creditTooltipPurchased", {
                        count: creditBalance.purchased_credits,
                      })}
                    </p>
                    <p>
                      {t("creditTooltipFree", {
                        count: creditBalance.free_credits,
                      })}
                    </p>
                    {creditBalance.next_free_reset_at && (
                      <p className="text-muted-foreground">
                        {t("creditTooltipResets", {
                          date: formatDate(creditBalance.next_free_reset_at),
                        })}
                      </p>
                    )}
                  </div>
                  <p className="text-primary pt-1 text-xs">
                    {t("manageCredits")}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <ThemeToggle />

        {user && (
          <div className="hidden items-center gap-3 sm:flex">
            {user.avatar_url ? (
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
            <span className="text-sm font-medium">
              {user.name || user.email}
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
