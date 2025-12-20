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
  apiKeysApi,
  ApiKeyCreate,
  ApiKeyCreatedResponse,
  ApiKeyResponse,
  ApiKeyUpdate,
} from "@/lib/api/api";
import { formatDateTime } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  Key,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const AVAILABLE_SCOPES = ["feedback:read", "feedback:write", "admin:*"];

type ApiKeyFormData = {
  name: string;
  scopes: string[];
  expires_at: string;
};

function ApiKeyFormDialog({
  open,
  onClose,
  apiKey,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  apiKey?: ApiKeyResponse;
  onSave: (data: ApiKeyCreate | ApiKeyUpdate) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("admin.apiKeys");
  const tCommon = useTranslations("common");
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: apiKey?.name ?? "",
    scopes: apiKey?.scopes ?? [],
    expires_at: apiKey?.expires_at
      ? new Date(apiKey.expires_at).toISOString().slice(0, 16)
      : "",
  });

  useEffect(() => {
    if (apiKey) {
      setFormData({
        name: apiKey.name,
        scopes: apiKey.scopes,
        expires_at: apiKey.expires_at
          ? new Date(apiKey.expires_at).toISOString().slice(0, 16)
          : "",
      });
    } else {
      setFormData({
        name: "",
        scopes: [],
        expires_at: "",
      });
    }
  }, [apiKey, open]);

  const toggleScope = (scope: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: ApiKeyCreate | ApiKeyUpdate = {
      name: formData.name,
      scopes: formData.scopes,
      expires_at: formData.expires_at || null,
    };
    onSave(data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {apiKey ? t("editApiKey") : t("createApiKey")}
          </DialogTitle>
          <DialogDescription>
            {apiKey ? t("description") : t("description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="min-w-0">
          <div className="min-w-0 space-y-4 py-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                data-testid="api-key-name-input"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("scopes")}</Label>
              <p className="text-muted-foreground text-xs">{t("scopesHelp")}</p>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <div key={scope} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`scope-${scope}`}
                      data-testid={`scope-checkbox-${scope}`}
                      checked={formData.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`scope-${scope}`} className="font-normal">
                      <code className="bg-muted rounded px-1 py-0.5 text-sm">
                        {scope}
                      </code>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t(
                          `availableScopes.${scope.replace(":", "_").replace("*", "star")}` as "availableScopes.feedback_read"
                        )}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="expires_at">{t("expiresAt")}</Label>
              <Input
                id="expires_at"
                type="datetime-local"
                data-testid="api-key-expires-input"
                value={formData.expires_at}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, expires_at: e.target.value })
                }
              />
              <p className="text-muted-foreground text-xs">
                {t("expiresAtHelp")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              data-testid="save-api-key-button"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {apiKey ? tCommon("save") : t("createApiKey")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KeyCreatedDialog({
  open,
  onClose,
  createdKey,
}: {
  open: boolean;
  onClose: () => void;
  createdKey: ApiKeyCreatedResponse | null;
}) {
  const t = useTranslations("admin.apiKeys");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (createdKey?.key) {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-green-500" />
            {t("keyCreated")}
          </DialogTitle>
          <DialogDescription className="text-amber-600 dark:text-amber-400">
            {t("keyCreatedWarning")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-4">
          <div className="min-w-0 space-y-2">
            <Label>{t("key")}</Label>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 rounded p-2 text-xs break-all sm:p-3 sm:text-sm">
                {createdKey?.key}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                data-testid="copy-api-key-button"
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">{t("name")}:</span>
              <p className="font-medium">{createdKey?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("scopes")}:</span>
              <p className="font-medium">
                {createdKey?.scopes.join(", ") || "None"}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} data-testid="close-key-dialog-button">
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminApiKeysPage() {
  const t = useTranslations("admin.apiKeys");
  const tCommon = useTranslations("common");
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editingKey, setEditingKey] = useState<ApiKeyResponse | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(
    null
  );
  const [page, setPage] = useState(1);

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ["admin-api-keys", page],
    queryFn: () => apiKeysApi.list(page, 20),
    enabled: !!user?.is_admin,
  });

  const createMutation = useMutation({
    mutationFn: (data: ApiKeyCreate) => apiKeysApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      setIsCreateOpen(false);
      setCreatedKey(response);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApiKeyUpdate }) =>
      apiKeysApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      setEditingKey(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      setDeleteKeyId(null);
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleCreate = (data: ApiKeyCreate | ApiKeyUpdate) => {
    createMutation.mutate(data as ApiKeyCreate);
  };

  const handleUpdate = (data: ApiKeyCreate | ApiKeyUpdate) => {
    if (editingKey) {
      updateMutation.mutate({ id: editingKey.id, data: data as ApiKeyUpdate });
    }
  };

  const handleDelete = () => {
    if (deleteKeyId) {
      deleteMutation.mutate(deleteKeyId);
    }
  };

  const apiKeys = apiKeysData?.items ?? [];
  const totalPages = apiKeysData?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button
            variant="ghost"
            size="icon"
            data-testid="back-to-admin-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2"
          data-testid="create-api-key-button"
        >
          <Plus className="h-4 w-4" />
          {t("createApiKey")}
        </Button>
      </div>

      {apiKeysLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="bg-card hidden rounded-xl border md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-sm">
                    <th className="px-4 py-3 font-medium">{t("name")}</th>
                    <th className="px-4 py-3 font-medium">{t("keyPrefix")}</th>
                    <th className="px-4 py-3 font-medium">{t("scopes")}</th>
                    <th className="px-4 py-3 font-medium">{t("isActive")}</th>
                    <th className="px-4 py-3 font-medium">{t("lastUsed")}</th>
                    <th className="px-4 py-3 font-medium">{t("expiresAt")}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {tCommon("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr
                      key={key.id}
                      className="border-b last:border-0"
                      data-testid={`api-key-row-${key.id}`}
                    >
                      <td className="px-4 py-3 font-medium">{key.name}</td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-sm">
                        {key.key_prefix}...
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="bg-muted rounded-full px-2 py-0.5 text-xs"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {key.is_active ? (
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
                        {key.last_used_at
                          ? formatDateTime(key.last_used_at)
                          : t("never")}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-sm">
                        {key.expires_at
                          ? formatDateTime(key.expires_at)
                          : t("noExpiration")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingKey(key)}
                            data-testid={`edit-api-key-${key.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteKeyId(key.id)}
                            data-testid={`delete-api-key-${key.id}`}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-muted-foreground px-4 py-8 text-center"
                      >
                        {t("noApiKeys")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="bg-card rounded-xl border p-4"
                data-testid={`api-key-card-${key.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      {key.key_prefix}...
                    </p>
                  </div>
                  {key.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                      <Check className="h-3 w-3" /> {t("active")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      <X className="h-3 w-3" /> {t("inactive")}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="bg-muted rounded-full px-2 py-0.5 text-xs"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  {t("lastUsed")}:{" "}
                  {key.last_used_at
                    ? formatDateTime(key.last_used_at)
                    : t("never")}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingKey(key)}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    {tCommon("edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteKeyId(key.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {apiKeys.length === 0 && (
              <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
                {t("noApiKeys")}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {tCommon("previous")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {tCommon("page")} {page} {tCommon("of")} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {tCommon("next")}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <ApiKeyFormDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <ApiKeyFormDialog
        open={!!editingKey}
        onClose={() => setEditingKey(null)}
        apiKey={editingKey ?? undefined}
        onSave={handleUpdate}
        isSaving={updateMutation.isPending}
      />

      {/* Key Created Dialog */}
      <KeyCreatedDialog
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        createdKey={createdKey}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteKeyId}
        onOpenChange={() => setDeleteKeyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteApiKey")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-api-key"
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
