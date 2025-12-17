"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  adminApi,
  FeedbackAdminResponse,
  FeedbackAdminUpdate,
} from "@/lib/api/api";
import {
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Trash2,
  Eye,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "question", label: "Question", icon: HelpCircle },
  { value: "general", label: "General Feedback", icon: MessageSquare },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function getTypeIcon(type: string) {
  const TypeComponent =
    FEEDBACK_TYPES.find((ft) => ft.value === type)?.icon || MessageSquare;
  return TypeComponent;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "closed":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

export default function AdminFeedbackPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [selectedFeedback, setSelectedFeedback] =
    useState<FeedbackAdminResponse | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] =
    useState<FeedbackAdminResponse | null>(null);
  const [retriggerConfirm, setRetriggerConfirm] =
    useState<FeedbackAdminResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ["admin-feedback", page, statusFilter, typeFilter],
    queryFn: () => adminApi.listFeedback(page, 20, statusFilter, typeFilter),
    enabled: !!user?.is_admin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FeedbackAdminUpdate }) =>
      adminApi.updateFeedback(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setSelectedFeedback(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setDeleteConfirm(null);
    },
  });

  const retriggerMutation = useMutation({
    mutationFn: (id: string) => adminApi.retriggerFeedbackWebhook(id),
    onSuccess: () => {
      setRetriggerConfirm(null);
      setSuccessMessage(t("feedback.retriggerWebhookSuccess"));
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setRetriggerConfirm(null);
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  const openEditDialog = (feedback: FeedbackAdminResponse) => {
    setSelectedFeedback(feedback);
    setEditStatus(feedback.status);
    setEditNotes(feedback.admin_notes || "");
  };

  const handleUpdateSubmit = () => {
    if (!selectedFeedback) return;

    updateMutation.mutate({
      id: selectedFeedback.id,
      data: {
        status: editStatus,
        admin_notes: editNotes || undefined,
      },
    });
  };

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
            {t("admin.feedback")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.manageFeedback")}
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
            <SelectValue placeholder={t("feedback.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("feedback.allStatuses")}</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter || "all"}
          onValueChange={(value) =>
            setTypeFilter(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("feedback.filterByType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("feedback.allTypes")}</SelectItem>
            {FEEDBACK_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {feedbackLoading ? (
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
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackData?.items.map((feedback) => {
                    const TypeIcon = getTypeIcon(feedback.feedback_type);
                    return (
                      <tr key={feedback.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="text-muted-foreground h-4 w-4" />
                            <span className="text-sm capitalize">
                              {feedback.feedback_type.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-xs truncate font-medium">
                            {feedback.subject}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              {feedback.user_name || "No name"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {feedback.user_email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                              feedback.status
                            )}`}
                          >
                            {STATUS_OPTIONS.find(
                              (s) => s.value === feedback.status
                            )?.label || feedback.status}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-sm">
                          {formatDate(feedback.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(feedback)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(feedback)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!feedbackData?.items ||
                    feedbackData.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-4 py-8 text-center"
                      >
                        No feedback found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {feedbackData?.items.map((feedback) => {
              const TypeIcon = getTypeIcon(feedback.feedback_type);
              return (
                <div
                  key={feedback.id}
                  className="bg-card rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="text-muted-foreground text-xs capitalize">
                          {feedback.feedback_type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium">
                        {feedback.subject}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                        feedback.status
                      )}`}
                    >
                      {STATUS_OPTIONS.find((s) => s.value === feedback.status)
                        ?.label || feedback.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <p className="text-muted-foreground">
                      {feedback.user_name || "No name"} · {feedback.user_email}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(feedback.created_at)}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(feedback)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(feedback)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {(!feedbackData?.items || feedbackData.items.length === 0) && (
              <div className="bg-card text-muted-foreground rounded-xl border p-8 text-center">
                No feedback found
              </div>
            )}
          </div>

          {/* Pagination */}
          {feedbackData && feedbackData.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Page {feedbackData.page} of {feedbackData.total_pages} (
                {feedbackData.total} items)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(feedbackData.total_pages, p + 1))
                  }
                  disabled={page === feedbackData.total_pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View/Edit Dialog */}
      <Dialog
        open={!!selectedFeedback}
        onOpenChange={(open) => !open && setSelectedFeedback(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFeedback?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedFeedback?.user_name || "Unknown"} (
              {selectedFeedback?.user_email}) on{" "}
              {selectedFeedback && formatDate(selectedFeedback.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message</Label>
              <div className="bg-muted/50 max-h-48 overflow-auto rounded-lg p-4 text-sm">
                {selectedFeedback?.message}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("feedback.updateStatus")}</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("feedback.adminNotes")}</Label>
              <Textarea
                id="notes"
                placeholder="Add internal notes about this feedback..."
                value={editNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditNotes(e.target.value)
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedFeedback) {
                  setRetriggerConfirm(selectedFeedback);
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("feedback.retriggerWebhook")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedFeedback(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleUpdateSubmit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
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
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.deleteConfirm")}
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

      {/* Retrigger Webhook Confirmation */}
      <AlertDialog
        open={!!retriggerConfirm}
        onOpenChange={() => setRetriggerConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("feedback.retriggerWebhook")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.retriggerWebhookConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                retriggerConfirm &&
                retriggerMutation.mutate(retriggerConfirm.id)
              }
            >
              {retriggerMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("feedback.retriggerWebhook")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <AlertDialog
        open={!!successMessage}
        onOpenChange={() => setSuccessMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.success")}</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSuccessMessage(null)}>
              {t("common.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
