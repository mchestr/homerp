"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  webhooksApi,
  WebhookConfig,
  WebhookConfigCreate,
  WebhookConfigUpdate,
} from "@/lib/api/api-client";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Edit,
  Play,
  History,
  X,
  Check,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const HTTP_METHODS = ["POST", "PUT", "PATCH"];

function getStatusBadgeVariant(
  isActive: boolean
): "default" | "secondary" | "destructive" | "outline" {
  return isActive ? "default" : "secondary";
}

export default function AdminWebhooksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(
    null
  );
  const [deleteConfirm, setDeleteConfirm] = useState<WebhookConfig | null>(
    null
  );
  const [testingWebhook, setTestingWebhook] = useState<WebhookConfig | null>(
    null
  );
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status_code: number | null;
    response_body: string | null;
    error: string | null;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [formEventType, setFormEventType] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formMethod, setFormMethod] = useState("POST");
  const [formHeaders, setFormHeaders] = useState<
    { key: string; value: string }[]
  >([]);
  const [formBodyTemplate, setFormBodyTemplate] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRetryCount, setFormRetryCount] = useState(3);
  const [formTimeout, setFormTimeout] = useState(30);

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: webhooksApi.listConfigs,
    enabled: !!user?.is_admin,
  });

  const { data: eventTypes } = useQuery({
    queryKey: ["webhook-event-types"],
    queryFn: webhooksApi.listEventTypes,
    enabled: !!user?.is_admin,
  });

  const createMutation = useMutation({
    mutationFn: (data: WebhookConfigCreate) => webhooksApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WebhookConfigUpdate }) =>
      webhooksApi.updateConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsDialogOpen(false);
      setEditingWebhook(null);
      resetForm();
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setDeleteConfirm(null);
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.testConfig(id),
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        status_code: null,
        response_body: null,
        error: error.message,
      });
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const resetForm = () => {
    setFormEventType("");
    setFormUrl("");
    setFormMethod("POST");
    setFormHeaders([]);
    setFormBodyTemplate("");
    setFormIsActive(true);
    setFormRetryCount(3);
    setFormTimeout(30);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingWebhook(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormEventType(webhook.event_type);
    setFormUrl(webhook.url);
    setFormMethod(webhook.http_method);
    setFormHeaders(
      Object.entries(webhook.headers).map(([key, value]) => ({ key, value }))
    );
    setFormBodyTemplate(webhook.body_template || "");
    setFormIsActive(webhook.is_active);
    setFormRetryCount(webhook.retry_count);
    setFormTimeout(webhook.timeout_seconds);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const headersObj = formHeaders.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    if (editingWebhook) {
      updateMutation.mutate({
        id: editingWebhook.id,
        data: {
          url: formUrl,
          http_method: formMethod,
          headers: headersObj,
          body_template: formBodyTemplate || undefined,
          is_active: formIsActive,
          retry_count: formRetryCount,
          timeout_seconds: formTimeout,
        },
      });
    } else {
      createMutation.mutate({
        event_type: formEventType,
        url: formUrl,
        http_method: formMethod,
        headers: headersObj,
        body_template: formBodyTemplate || undefined,
        is_active: formIsActive,
        retry_count: formRetryCount,
        timeout_seconds: formTimeout,
      });
    }
  };

  const addHeader = () => {
    setFormHeaders([...formHeaders, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setFormHeaders(formHeaders.filter((_, i) => i !== index));
  };

  const updateHeader = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const newHeaders = [...formHeaders];
    newHeaders[index][field] = value;
    setFormHeaders(newHeaders);
  };

  const selectedEventType = eventTypes?.find(
    (et) => et.value === formEventType
  );

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("webhooks.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("webhooks.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/webhooks/logs">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              {t("webhooks.executionLogs")}
            </Button>
          </Link>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("webhooks.createWebhook")}
          </Button>
        </div>
      </div>

      {webhooksLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks && webhooks.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-xl border bg-card md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.eventType")}
                  </th>
                  <th className="px-4 py-3 font-medium">{t("webhooks.url")}</th>
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.httpMethod")}
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr
                    key={webhook.id}
                    className="border-b last:border-0"
                    data-testid={`webhook-row-${webhook.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">
                        {webhook.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="max-w-xs truncate text-sm text-muted-foreground">
                        {webhook.url}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{webhook.http_method}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(webhook.is_active)}>
                        {webhook.is_active
                          ? t("webhooks.isActive")
                          : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTestingWebhook(webhook);
                            setTestResult(null);
                            testMutation.mutate(webhook.id);
                          }}
                          disabled={testMutation.isPending}
                          data-testid={`test-webhook-${webhook.id}`}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          {t("webhooks.test")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(webhook)}
                          data-testid={`edit-webhook-${webhook.id}`}
                        >
                          <Edit className="mr-1 h-4 w-4" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(webhook)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`delete-webhook-${webhook.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="rounded-xl border bg-card p-4"
                data-testid={`webhook-card-${webhook.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium">
                      {webhook.event_type}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {webhook.url}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(webhook.is_active)}>
                    {webhook.is_active ? t("webhooks.isActive") : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    {webhook.http_method}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setTestingWebhook(webhook);
                      setTestResult(null);
                      testMutation.mutate(webhook.id);
                    }}
                    disabled={testMutation.isPending}
                  >
                    <Play className="mr-1 h-4 w-4" />
                    {t("webhooks.test")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(webhook)}
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(webhook)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium">
            {t("webhooks.noWebhooks")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("webhooks.noWebhooksDescription")}
          </p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("webhooks.createWebhook")}
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            setEditingWebhook(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook
                ? t("webhooks.editWebhook")
                : t("webhooks.createWebhook")}
            </DialogTitle>
            <DialogDescription>{t("webhooks.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Event Type */}
            <div className="space-y-2">
              <Label htmlFor="event_type">{t("webhooks.eventType")}</Label>
              <Select
                value={formEventType}
                onValueChange={setFormEventType}
                disabled={!!editingWebhook}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("webhooks.selectEventType")} />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes?.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Available Variables */}
            {selectedEventType && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {t("webhooks.availableVariables")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedEventType.variables.map((variable) => (
                    <Badge
                      key={variable}
                      variant="secondary"
                      className="cursor-pointer font-mono text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${variable}}}`);
                      }}
                    >
                      {`{{${variable}}}`}
                      <Copy className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">{t("webhooks.url")}</Label>
              <Input
                id="url"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder={t("webhooks.urlPlaceholder")}
              />
            </div>

            {/* HTTP Method */}
            <div className="space-y-2">
              <Label htmlFor="method">{t("webhooks.httpMethod")}</Label>
              <Select value={formMethod} onValueChange={setFormMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("webhooks.headers")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHeader}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t("webhooks.addHeader")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("webhooks.headersHelp")}
              </p>
              {formHeaders.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={t("webhooks.headerKey")}
                    value={header.key}
                    onChange={(e) => updateHeader(index, "key", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder={t("webhooks.headerValue")}
                    value={header.value}
                    onChange={(e) =>
                      updateHeader(index, "value", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Body Template */}
            <div className="space-y-2">
              <Label htmlFor="body_template">
                {t("webhooks.bodyTemplate")}
              </Label>
              <Textarea
                id="body_template"
                value={formBodyTemplate}
                onChange={(e) => setFormBodyTemplate(e.target.value)}
                placeholder='{"text": "New feedback: {{feedback.subject}}"}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("webhooks.bodyTemplateHelp")}
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">{t("webhooks.isActive")}</Label>
              </div>
              <Switch
                id="is_active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            {/* Retry Count */}
            <div className="space-y-2">
              <Label htmlFor="retry_count">{t("webhooks.retryCount")}</Label>
              <Input
                id="retry_count"
                type="number"
                min={0}
                max={10}
                value={formRetryCount}
                onChange={(e) =>
                  setFormRetryCount(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("webhooks.retryCountHelp")}
              </p>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeout">{t("webhooks.timeout")}</Label>
              <Input
                id="timeout"
                type="number"
                min={5}
                max={120}
                value={formTimeout}
                onChange={(e) => setFormTimeout(parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                {t("webhooks.timeoutHelp")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditingWebhook(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formEventType ||
                !formUrl
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingWebhook ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog
        open={!!testingWebhook}
        onOpenChange={(open) => {
          if (!open) {
            setTestingWebhook(null);
            setTestResult(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("webhooks.testWebhook")}</DialogTitle>
            <DialogDescription>{testingWebhook?.event_type}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {testMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <>
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-500">
                        {t("webhooks.testSuccess")}
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 text-destructive" />
                      <span className="font-medium text-destructive">
                        {t("webhooks.testFailed")}
                      </span>
                    </>
                  )}
                </div>
                {testResult.status_code && (
                  <div>
                    <Label>{t("webhooks.responseStatus")}</Label>
                    <p className="font-mono text-sm">
                      {testResult.status_code}
                    </p>
                  </div>
                )}
                {testResult.error && (
                  <div>
                    <Label>{t("webhooks.errorMessage")}</Label>
                    <p className="text-sm text-destructive">
                      {testResult.error}
                    </p>
                  </div>
                )}
                {testResult.response_body && (
                  <div>
                    <Label>{t("webhooks.responseBody")}</Label>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-2 text-xs">
                      {testResult.response_body}
                    </pre>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setTestingWebhook(null);
                setTestResult(null);
              }}
            >
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("webhooks.deleteWebhook")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("webhooks.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog
        open={!!errorMessage}
        onOpenChange={() => setErrorMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("errors.somethingWentWrong")}
            </AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)}>
              {t("common.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
