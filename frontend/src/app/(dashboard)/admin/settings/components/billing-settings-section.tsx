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
import { adminApi, BillingSetting, BillingSettingUpdate } from "@/lib/api/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SettingsFormState = {
  value_int: string;
  display_name: string;
  description: string;
};

function SettingsFormDialog({
  open,
  onClose,
  settings,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  settings: BillingSetting;
  onSave: (data: BillingSettingUpdate) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("admin.billingSettings");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState<SettingsFormState>({
    value_int: settings.value_int?.toString() ?? "",
    display_name: settings.display_name,
    description: settings.description ?? "",
  });

  useEffect(() => {
    if (open && settings) {
      setFormData({
        value_int: settings.value_int?.toString() ?? "",
        display_name: settings.display_name,
        description: settings.description ?? "",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValue = formData.value_int
      ? parseInt(formData.value_int, 10)
      : undefined;
    const updateData: BillingSettingUpdate = {
      value_int:
        parsedValue !== undefined && !isNaN(parsedValue)
          ? parsedValue
          : undefined,
      display_name: formData.display_name,
      description: formData.description || undefined,
    };
    onSave(updateData);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-md" data-testid="settings-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t("editSettings")}</DialogTitle>
          <DialogDescription>{t("editSettingsDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="setting_key">{t("settingKey")}</Label>
              <Input
                id="setting_key"
                value={settings.setting_key}
                disabled
                className="bg-muted"
                data-testid="settings-key"
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
                data-testid="settings-display-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value_int">
                {t("value")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="value_int"
                type="number"
                min={0}
                value={formData.value_int}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, value_int: e.target.value })
                }
                required
                data-testid="settings-value-input"
              />
              <p className="text-muted-foreground text-xs">{t("valueHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                data-testid="settings-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="settings-cancel-button"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              data-testid="settings-save-button"
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

export function BillingSettingsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("admin.billingSettings");
  const tCommon = useTranslations("common");

  const [editingSettings, setEditingSettings] = useState<BillingSetting | null>(
    null
  );

  const { data: settingsList, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-billing-settings"],
    queryFn: adminApi.listBillingSettings,
    enabled: !!user?.is_admin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BillingSettingUpdate }) =>
      adminApi.updateBillingSetting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-settings"] });
      setEditingSettings(null);
      toast({
        title: t("updateSuccess"),
        description: t("settingsUpdated"),
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

  const handleUpdate = (data: BillingSettingUpdate) => {
    if (editingSettings) {
      updateMutation.mutate({ id: editingSettings.id, data });
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="billing-settings-section">
      {/* Desktop Table View */}
      <div
        className="bg-card hidden rounded-xl border md:block"
        data-testid="billing-settings-table"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-sm">
                <th className="px-4 py-3 font-medium">{t("settingKey")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("displayName")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("value")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("description")}</th>
                <th className="px-4 py-3 font-medium">{tCommon("lastUpdated")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {tCommon("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {settingsList?.map((settings) => (
                <tr
                  key={settings.id}
                  className="border-b last:border-0"
                  data-testid={`settings-row-${settings.setting_key}`}
                >
                  <td className="px-4 py-3 font-mono text-sm">
                    {settings.setting_key}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {settings.display_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 font-mono text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {settings.value_int ?? "-"}
                    </span>
                  </td>
                  <td className="text-muted-foreground max-w-xs truncate px-4 py-3 text-sm">
                    {settings.description || "-"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {formatDateTime(settings.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingSettings(settings)}
                        data-testid={`settings-edit-${settings.setting_key}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!settingsList || settingsList.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    {t("noSettings")}
                    <p className="mt-1 text-sm">{t("noSettingsDescription")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden" data-testid="billing-settings-cards">
        {settingsList?.map((settings) => (
          <div
            key={settings.id}
            className="bg-card rounded-xl border p-4"
            data-testid={`settings-card-${settings.setting_key}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{settings.display_name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {settings.setting_key}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 font-mono text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {settings.value_int ?? "-"}
              </span>
            </div>
            {settings.description && (
              <p className="text-muted-foreground mt-2 text-sm">
                {settings.description}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {formatDateTime(settings.updated_at)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSettings(settings)}
                data-testid={`settings-edit-mobile-${settings.setting_key}`}
              >
                <Pencil className="mr-1 h-4 w-4" />
                {tCommon("edit")}
              </Button>
            </div>
          </div>
        ))}
        {(!settingsList || settingsList.length === 0) && (
          <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
            <Settings className="mx-auto mb-3 h-12 w-12 opacity-50" />
            {t("noSettings")}
            <p className="mt-1 text-sm">{t("noSettingsDescription")}</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingSettings && (
        <SettingsFormDialog
          open={!!editingSettings}
          onClose={() => setEditingSettings(null)}
          settings={editingSettings}
          onSave={handleUpdate}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
