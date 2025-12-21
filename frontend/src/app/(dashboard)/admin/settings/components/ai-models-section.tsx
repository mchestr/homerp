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
import {
  adminApi,
  AIModelSettings,
  AIModelSettingsUpdate,
} from "@/lib/api/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SettingsFormState = {
  model_name: string;
  temperature: string;
  max_tokens: string;
  display_name: string;
  description: string;
  is_active: boolean;
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
  settings: AIModelSettings;
  onSave: (data: AIModelSettingsUpdate) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("admin.aiModels");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState<SettingsFormState>({
    model_name: settings.model_name,
    temperature: settings.temperature.toString(),
    max_tokens: settings.max_tokens.toString(),
    display_name: settings.display_name,
    description: settings.description ?? "",
    is_active: settings.is_active,
  });

  useEffect(() => {
    if (open && settings) {
      setFormData({
        model_name: settings.model_name,
        temperature: settings.temperature.toString(),
        max_tokens: settings.max_tokens.toString(),
        display_name: settings.display_name,
        description: settings.description ?? "",
        is_active: settings.is_active,
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: AIModelSettingsUpdate = {
      model_name: formData.model_name,
      temperature: parseFloat(formData.temperature),
      max_tokens: parseInt(formData.max_tokens),
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
      <DialogContent className="sm:max-w-md" data-testid="settings-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t("editSettings")}</DialogTitle>
          <DialogDescription>{t("editSettingsDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="operation_type">{t("operationType")}</Label>
              <Input
                id="operation_type"
                value={settings.operation_type}
                disabled
                className="bg-muted"
                data-testid="settings-operation-type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">
                {t("displayName")} <span className="text-destructive">*</span>
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
              <Label htmlFor="model_name">
                {t("modelName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model_name"
                value={formData.model_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, model_name: e.target.value })
                }
                placeholder="gpt-4o"
                required
                data-testid="settings-model-name-input"
              />
              <p className="text-muted-foreground text-xs">
                {t("modelNameHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">
                {t("temperature")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={formData.temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, temperature: e.target.value })
                }
                required
                data-testid="settings-temperature-input"
              />
              <p className="text-muted-foreground text-xs">
                {t("temperatureHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_tokens">
                {t("maxTokens")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="max_tokens"
                type="number"
                min={1}
                max={100000}
                value={formData.max_tokens}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, max_tokens: e.target.value })
                }
                required
                data-testid="settings-max-tokens-input"
              />
              <p className="text-muted-foreground text-xs">
                {t("maxTokensHelp")}
              </p>
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
                data-testid="settings-active-checkbox"
              />
              <Label htmlFor="is_active">{t("active")}</Label>
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
              {t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AIModelsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("admin.aiModels");
  const tCommon = useTranslations("common");

  const [editingSettings, setEditingSettings] =
    useState<AIModelSettings | null>(null);

  const { data: settingsList, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-ai-model-settings"],
    queryFn: adminApi.listAIModelSettings,
    enabled: !!user?.is_admin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AIModelSettingsUpdate }) =>
      adminApi.updateAIModelSettings(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-model-settings"] });
      setEditingSettings(null);
      toast({
        title: t("updateSuccess"),
        description: t("settingsUpdated"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("updateFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = (data: AIModelSettingsUpdate) => {
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
    <div data-testid="ai-models-section">
      {/* Desktop Table View */}
      <div
        className="bg-card hidden rounded-xl border md:block"
        data-testid="ai-models-table"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-sm">
                <th className="px-4 py-3 font-medium">{t("operationType")}</th>
                <th className="px-4 py-3 font-medium">{t("displayName")}</th>
                <th className="px-4 py-3 font-medium">{t("modelName")}</th>
                <th className="px-4 py-3 font-medium">{t("temperature")}</th>
                <th className="px-4 py-3 font-medium">{t("maxTokens")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
                <th className="px-4 py-3 font-medium">{t("lastUpdated")}</th>
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
                  data-testid={`settings-row-${settings.operation_type}`}
                >
                  <td className="px-4 py-3 font-mono text-sm">
                    {settings.operation_type}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {settings.display_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 font-mono text-sm font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {settings.model_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{settings.temperature}</td>
                  <td className="px-4 py-3 text-sm">
                    {settings.max_tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {settings.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                        <Check className="h-3 w-3" /> {t("active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        <X className="h-3 w-3" /> {t("inactive")}
                      </span>
                    )}
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
                        data-testid={`settings-edit-${settings.operation_type}`}
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
                    colSpan={8}
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
      <div className="space-y-3 md:hidden" data-testid="ai-models-cards">
        {settingsList?.map((settings) => (
          <div
            key={settings.id}
            className="bg-card rounded-xl border p-4"
            data-testid={`settings-card-${settings.operation_type}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{settings.display_name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {settings.operation_type}
                </p>
              </div>
              {settings.is_active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                  <Check className="h-3 w-3" /> {t("active")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  <X className="h-3 w-3" /> {t("inactive")}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("modelName")}:
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {settings.model_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("temperature")}:
                </span>
                <span className="text-sm">{settings.temperature}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("maxTokens")}:
                </span>
                <span className="text-sm">
                  {settings.max_tokens.toLocaleString()}
                </span>
              </div>
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
                data-testid={`settings-edit-mobile-${settings.operation_type}`}
              >
                <Pencil className="mr-1 h-4 w-4" />
                {tCommon("edit")}
              </Button>
            </div>
          </div>
        ))}
        {(!settingsList || settingsList.length === 0) && (
          <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
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
