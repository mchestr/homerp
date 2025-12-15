"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronDown, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useInventory, SelectedInventory } from "@/context/inventory-context";

export function InventorySwitcher() {
  const t = useTranslations("inventory");
  const {
    selectedInventory,
    sharedInventories,
    selectInventory,
    selectOwnInventory,
    isViewingSharedInventory,
  } = useInventory();
  const queryClient = useQueryClient();

  const invalidateInventoryQueries = () => {
    // Invalidate inventory-related queries to refetch with new context
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["locations"] });
    queryClient.invalidateQueries({ queryKey: ["images"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleSelectInventory = (inventory: SelectedInventory) => {
    selectInventory(inventory);
    invalidateInventoryQueries();
  };

  const handleSelectOwnInventory = () => {
    selectOwnInventory();
    invalidateInventoryQueries();
  };

  // Don't show switcher if there are no shared inventories
  if (sharedInventories.length === 0) {
    return null;
  }

  const displayName = selectedInventory?.isOwn
    ? t("myInventory")
    : selectedInventory?.name ||
      selectedInventory?.email ||
      t("sharedInventory");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 text-left"
          data-testid="inventory-switcher"
        >
          <div className="flex items-center gap-2 truncate">
            {isViewingSharedInventory && (
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{displayName}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>{t("switchInventory")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Own inventory */}
        <DropdownMenuItem
          onClick={handleSelectOwnInventory}
          className="flex items-center justify-between"
          data-testid="inventory-option-own"
        >
          <span>{t("myInventory")}</span>
          {selectedInventory?.isOwn && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </DropdownMenuItem>

        {/* Shared inventories */}
        {sharedInventories.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("sharedWithMe")}
            </DropdownMenuLabel>
            {sharedInventories.map((shared) => {
              const inventory: SelectedInventory = {
                id: shared.owner_id,
                name: shared.owner.name,
                email: shared.owner.email,
                avatar_url: shared.owner.avatar_url,
                isOwn: false,
                role: shared.role,
              };
              const isSelected = selectedInventory?.id === shared.owner_id;

              return (
                <DropdownMenuItem
                  key={shared.id}
                  onClick={() => handleSelectInventory(inventory)}
                  className="flex items-center justify-between"
                  data-testid={`inventory-option-${shared.owner_id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate">
                      {shared.owner.name || shared.owner.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(shared.role)}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InventoryBanner() {
  const t = useTranslations("inventory");
  const { selectedInventory, isViewingSharedInventory, canEdit } =
    useInventory();

  if (!isViewingSharedInventory) {
    return null;
  }

  const ownerName =
    selectedInventory?.name || selectedInventory?.email || t("sharedInventory");

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <span className="text-blue-700 dark:text-blue-300">
        {t("viewingInventoryOf", { name: ownerName })}
      </span>
      <Badge variant={canEdit ? "default" : "secondary"} className="ml-auto">
        {canEdit ? t("editor") : t("viewer")}
      </Badge>
    </div>
  );
}
