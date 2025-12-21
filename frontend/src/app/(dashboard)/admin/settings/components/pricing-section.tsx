"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { adminApi, CreditPricing, CreditPricingUpdate } from "@/lib/api/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type PricingFormState = {
  credits_per_operation: string;
  display_name: string;
  description: string;
  is_active: boolean;
};

function PricingFormDialog({
  open,
  onClose,
  pricing,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  pricing: CreditPricing;
  onSave: (data: CreditPricingUpdate) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("admin.pricing");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState<PricingFormState>({
    credits_per_operation: pricing.credits_per_operation.toString(),
    display_name: pricing.display_name,
    description: pricing.description ?? "",
    is_active: pricing.is_active,
  });

  useEffect(() => {
    if (pricing) {
      setFormData({
        credits_per_operation: pricing.credits_per_operation.toString(),
        display_name: pricing.display_name,
        description: pricing.description ?? "",
        is_active: pricing.is_active,
      });
    }
  }, [pricing, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: CreditPricingUpdate = {
      credits_per_operation: parseInt(formData.credits_per_operation) || 1,
      display_name: formData.display_name,
      description: formData.description || undefined,
      is_active: formData.is_active,
    };
    onSave(updateData);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-md" data-testid="pricing-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t("editPricing")}</DialogTitle>
          <DialogDescription>{t("editPricingDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="operation_type">{t("operationType")}</Label>
              <Input
                id="operation_type"
                value={pricing.operation_type}
                disabled
                className="bg-muted"
                data-testid="pricing-operation-type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">
                {tCommon("displayName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                required
                data-testid="pricing-display-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits_per_operation">
                {t("creditsPerOperation")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="credits_per_operation"
                type="number"
                min={1}
                value={formData.credits_per_operation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    credits_per_operation: e.target.value,
                  })
                }
                required
                data-testid="pricing-credits-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("operationDescription")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                data-testid="pricing-description-input"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
                data-testid="pricing-active-checkbox"
              />
              <Label htmlFor="is_active">{tCommon("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="pricing-cancel-button"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              data-testid="pricing-save-button"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PricingSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("admin.pricing");
  const tCommon = useTranslations("common");

  const [editingPricing, setEditingPricing] = useState<CreditPricing | null>(
    null
  );

  const { data: pricingList, isLoading: pricingLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: adminApi.listPricing,
    enabled: !!user?.is_admin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreditPricingUpdate }) =>
      adminApi.updatePricing(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      setEditingPricing(null);
      toast({
        title: t("updateSuccess"),
        description: t("pricingUpdated"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("updateFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = (data: CreditPricingUpdate) => {
    if (editingPricing) {
      updateMutation.mutate({ id: editingPricing.id, data });
    }
  };

  if (pricingLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="pricing-section">
      {/* Desktop Table View */}
      <div
        className="bg-card hidden rounded-xl border md:block"
        data-testid="pricing-table"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-sm">
                <th className="px-4 py-3 font-medium">{t("operationType")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("displayName")}</th>
                <th className="px-4 py-3 font-medium">
                  {t("creditsPerOperation")}
                </th>
                <th className="px-4 py-3 font-medium">{tCommon("status")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("lastUpdated")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {tCommon("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pricingList?.map((pricing) => (
                <tr
                  key={pricing.id}
                  className="border-b last:border-0"
                  data-testid={`pricing-row-${pricing.operation_type}`}
                >
                  <td className="px-4 py-3 font-mono text-sm">
                    {pricing.operation_type}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {pricing.display_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {pricing.credits_per_operation}{" "}
                      {pricing.credits_per_operation === 1
                        ? t("credit")
                        : t("creditsPlural")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pricing.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                        <Check className="h-3 w-3" /> {tCommon("active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        <X className="h-3 w-3" /> {tCommon("inactive")}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {formatDateTime(pricing.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPricing(pricing)}
                        data-testid={`pricing-edit-${pricing.operation_type}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!pricingList || pricingList.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    {t("noPricing")}
                    <p className="mt-1 text-sm">{t("noPricingDescription")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden" data-testid="pricing-cards">
        {pricingList?.map((pricing) => (
          <div
            key={pricing.id}
            className="bg-card rounded-xl border p-4"
            data-testid={`pricing-card-${pricing.operation_type}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{pricing.display_name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {pricing.operation_type}
                </p>
              </div>
              {pricing.is_active ? (
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
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {pricing.credits_per_operation}{" "}
                {pricing.credits_per_operation === 1
                  ? t("credit")
                  : t("creditsPlural")}
              </span>
            </div>
            {pricing.description && (
              <p className="text-muted-foreground mt-2 text-sm">
                {pricing.description}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {formatDateTime(pricing.updated_at)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPricing(pricing)}
                data-testid={`pricing-edit-mobile-${pricing.operation_type}`}
              >
                <Pencil className="mr-1 h-4 w-4" />
                {tCommon("edit")}
              </Button>
            </div>
          </div>
        ))}
        {(!pricingList || pricingList.length === 0) && (
          <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
            {t("noPricing")}
            <p className="mt-1 text-sm">{t("noPricingDescription")}</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingPricing && (
        <PricingFormDialog
          open={!!editingPricing}
          onClose={() => setEditingPricing(null)}
          pricing={editingPricing}
          onSave={handleUpdate}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
