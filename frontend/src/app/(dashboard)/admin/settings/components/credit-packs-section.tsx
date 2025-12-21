"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import {
  adminApi,
  CreditPackAdmin,
  CreditPackCreate,
  CreditPackUpdate,
} from "@/lib/api/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type PackFormData = {
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: number;
};

// Internal form state that allows empty strings for number inputs
type PackFormState = {
  name: string;
  credits: string;
  price_cents: string;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: string;
};

function PackFormDialog({
  open,
  onClose,
  pack,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  pack?: CreditPackAdmin;
  onSave: (data: PackFormData) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("admin.creditPacks");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState<PackFormState>({
    name: pack?.name ?? "",
    credits: pack?.credits.toString() ?? "25",
    price_cents: pack?.price_cents.toString() ?? "300",
    stripe_price_id: pack?.stripe_price_id ?? "",
    is_active: pack?.is_active ?? true,
    sort_order: pack?.sort_order.toString() ?? "0",
  });

  useEffect(() => {
    if (pack) {
      setFormData({
        name: pack.name,
        credits: pack.credits.toString(),
        price_cents: pack.price_cents.toString(),
        stripe_price_id: pack.stripe_price_id,
        is_active: pack.is_active,
        sort_order: pack.sort_order.toString(),
      });
    } else {
      setFormData({
        name: "",
        credits: "25",
        price_cents: "300",
        stripe_price_id: "",
        is_active: true,
        sort_order: "0",
      });
    }
  }, [pack, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert string values to numbers, using defaults if empty
    const numericData: PackFormData = {
      name: formData.name,
      credits: parseInt(formData.credits) || 0,
      price_cents: parseInt(formData.price_cents) || 0,
      stripe_price_id: formData.stripe_price_id,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
    };
    onSave(numericData);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pack ? t("editCreditPack") : t("createCreditPack")}
          </DialogTitle>
          <DialogDescription>
            {pack ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("namePlaceholder")}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">{t("credits")}</Label>
                <Input
                  id="credits"
                  type="number"
                  min={1}
                  value={formData.credits}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      credits: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t("priceCents")}</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={formData.price_cents}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      price_cents: e.target.value,
                    })
                  }
                  required
                />
                <p className="text-muted-foreground text-xs">
                  {formatPrice(parseInt(formData.price_cents) || 0)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe_price_id">{t("stripePriceId")}</Label>
              <Input
                id="stripe_price_id"
                value={formData.stripe_price_id}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, stripe_price_id: e.target.value })
                }
                placeholder="price_..."
                required
              />
              <p className="text-muted-foreground text-xs">
                {t("stripePriceIdHelp")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">{t("sortOrder")}</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      sort_order: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active">{tCommon("active")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pack ? tCommon("save") : tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreditPacksSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const t = useTranslations("admin.creditPacks");
  const tCommon = useTranslations("common");

  const [editingPack, setEditingPack] = useState<CreditPackAdmin | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletePackId, setDeletePackId] = useState<string | null>(null);

  const { data: packs, isLoading: packsLoading } = useQuery({
    queryKey: ["admin-packs"],
    queryFn: adminApi.listPacks,
    enabled: !!user?.is_admin,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreditPackCreate) => adminApi.createPack(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setIsCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreditPackUpdate }) =>
      adminApi.updatePack(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setEditingPack(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setDeletePackId(null);
    },
  });

  const handleCreate = (data: PackFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: PackFormData) => {
    if (editingPack) {
      updateMutation.mutate({ id: editingPack.id, data });
    }
  };

  const handleDelete = () => {
    if (deletePackId) {
      deleteMutation.mutate(deletePackId);
    }
  };

  if (packsLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="credit-packs-section">
      {/* Header with Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("addPack")}
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="bg-card hidden rounded-xl border md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-sm">
                <th className="px-4 py-3 font-medium">{t("name")}</th>
                <th className="px-4 py-3 font-medium">{t("credits")}</th>
                <th className="px-4 py-3 font-medium">{t("price")}</th>
                <th className="px-4 py-3 font-medium">{t("stripePriceId")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("status")}</th>
                <th className="px-4 py-3 font-medium">{t("order")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {tCommon("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {packs?.map((pack) => (
                <tr key={pack.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{pack.name}</td>
                  <td className="px-4 py-3">{pack.credits}</td>
                  <td className="px-4 py-3">{formatPrice(pack.price_cents)}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {pack.stripe_price_id}
                  </td>
                  <td className="px-4 py-3">
                    {pack.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                        <Check className="h-3 w-3" /> {tCommon("active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        <X className="h-3 w-3" /> {tCommon("inactive")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{pack.sort_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPack(pack)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePackId(pack.id)}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!packs || packs.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    {t("noPacks")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {packs?.map((pack) => (
          <div key={pack.id} className="bg-card rounded-xl border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{pack.name}</p>
                <p className="text-muted-foreground text-sm">
                  {pack.credits} {t("credits")} ·{" "}
                  {formatPrice(pack.price_cents)}
                </p>
              </div>
              {pack.is_active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                  <Check className="h-3 w-3" /> {tCommon("active")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  <X className="h-3 w-3" /> {tCommon("inactive")}
                </span>
              )}
            </div>
            <div className="mt-2">
              <p className="text-muted-foreground truncate font-mono text-xs">
                {pack.stripe_price_id}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditingPack(pack)}
              >
                <Pencil className="mr-1 h-4 w-4" />
                {tCommon("edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletePackId(pack.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {(!packs || packs.length === 0) && (
          <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
            {t("noPacks")}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <PackFormDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <PackFormDialog
        open={!!editingPack}
        onClose={() => setEditingPack(null)}
        pack={editingPack ?? undefined}
        onSave={handleUpdate}
        isSaving={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletePackId}
        onOpenChange={() => setDeletePackId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteCreditPack")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
