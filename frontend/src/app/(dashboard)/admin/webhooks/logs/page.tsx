"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { webhooksApi, WebhookExecution } from "@/lib/api/api-client";
import { formatDateTimeWithSeconds } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock },
  { value: "success", label: "Success", icon: CheckCircle },
  { value: "failed", label: "Failed", icon: XCircle },
  { value: "retrying", label: "Retrying", icon: RefreshCw },
];

function getStatusIcon(status: string) {
  const StatusIcon =
    STATUS_OPTIONS.find((s) => s.value === status)?.icon || Clock;
  return StatusIcon;
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "default";
    case "failed":
      return "destructive";
    case "retrying":
      return "secondary";
    default:
      return "outline";
  }
}

export default function WebhookLogsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [selectedExecution, setSelectedExecution] =
    useState<WebhookExecution | null>(null);

  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: ["webhook-executions", page, statusFilter],
    queryFn: () =>
      webhooksApi.listExecutions(page, 20, undefined, undefined, statusFilter),
    enabled: !!user?.is_admin,
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

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
        <Link href="/admin/webhooks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("webhooks.executionLogs")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("webhooks.description")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) =>
            setStatusFilter(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {executionsLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : executionsData && executionsData.items.length > 0 ? (
        <>
          <div className="rounded-xl border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.eventType")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.requestUrl")}
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.attempt")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("webhooks.executedAt")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {executionsData.items.map((execution) => {
                  const StatusIcon = getStatusIcon(execution.status);
                  return (
                    <tr key={execution.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">
                          {execution.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="max-w-xs truncate text-sm text-muted-foreground">
                          {execution.request_url}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={getStatusBadgeVariant(execution.status)}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {t(`webhooks.status.${execution.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {execution.attempt_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTimeWithSeconds(execution.executed_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedExecution(execution)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            {t("common.viewDetails")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {executionsData.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {executionsData.page} of {executionsData.total_pages} (
                {executionsData.total} items)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("common.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(executionsData.total_pages, p + 1))
                  }
                  disabled={page === executionsData.total_pages}
                >
                  {t("common.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium">
            {t("webhooks.noExecutions")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("webhooks.noExecutionsDescription")}
          </p>
        </div>
      )}

      {/* Execution Details Dialog */}
      <Dialog
        open={!!selectedExecution}
        onOpenChange={(open) => !open && setSelectedExecution(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("webhooks.executionDetails")}</DialogTitle>
            <DialogDescription>
              {selectedExecution?.event_type} -{" "}
              {selectedExecution &&
                formatDateTimeWithSeconds(selectedExecution.executed_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <div className="space-y-4 py-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                <Badge
                  variant={getStatusBadgeVariant(selectedExecution.status)}
                >
                  {t(`webhooks.status.${selectedExecution.status}`)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({t("webhooks.attempt")} {selectedExecution.attempt_number})
                </span>
              </div>

              {/* Error Message */}
              {selectedExecution.error_message && (
                <div className="space-y-1">
                  <Label>{t("webhooks.errorMessage")}</Label>
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {selectedExecution.error_message}
                  </p>
                </div>
              )}

              {/* Request URL */}
              <div className="space-y-1">
                <Label>{t("webhooks.requestUrl")}</Label>
                <p className="rounded-lg bg-muted p-3 font-mono text-sm">
                  {selectedExecution.request_url}
                </p>
              </div>

              {/* Request Headers */}
              <div className="space-y-1">
                <Label>{t("webhooks.requestHeaders")}</Label>
                <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(selectedExecution.request_headers, null, 2)}
                </pre>
              </div>

              {/* Request Body */}
              <div className="space-y-1">
                <Label>{t("webhooks.requestBody")}</Label>
                <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {selectedExecution.request_body}
                </pre>
              </div>

              {/* Response Status */}
              {selectedExecution.response_status && (
                <div className="space-y-1">
                  <Label>{t("webhooks.responseStatus")}</Label>
                  <p className="font-mono text-sm">
                    {selectedExecution.response_status}
                  </p>
                </div>
              )}

              {/* Response Body */}
              {selectedExecution.response_body && (
                <div className="space-y-1">
                  <Label>{t("webhooks.responseBody")}</Label>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {selectedExecution.response_body}
                  </pre>
                </div>
              )}

              {/* Event Payload */}
              <div className="space-y-1">
                <Label>{t("webhooks.eventPayload")}</Label>
                <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(selectedExecution.event_payload, null, 2)}
                </pre>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{t("webhooks.executedAt")}</Label>
                  <p className="text-sm">
                    {formatDateTimeWithSeconds(selectedExecution.executed_at)}
                  </p>
                </div>
                {selectedExecution.completed_at && (
                  <div className="space-y-1">
                    <Label>{t("webhooks.completedAt")}</Label>
                    <p className="text-sm">
                      {formatDateTimeWithSeconds(
                        selectedExecution.completed_at
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
