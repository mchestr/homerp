"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { feedbackApi, FeedbackCreate, FeedbackResponse } from "@/lib/api/api";
import { formatDate } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  Loader2,
  Bug,
  Lightbulb,
  HelpCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "question", label: "Question", icon: HelpCircle },
  { value: "general", label: "General Feedback", icon: MessageSquare },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "resolved":
    case "closed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-500" />;
    default:
      return <Clock className="text-muted-foreground h-4 w-4" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export default function FeedbackPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [feedbackType, setFeedbackType] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: myFeedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["my-feedback"],
    queryFn: () => feedbackApi.list(),
  });

  const submitMutation = useMutation({
    mutationFn: (data: FeedbackCreate) => feedbackApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
      setSubject("");
      setMessage("");
      setFeedbackType("general");
      setSuccessDialog(true);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      setErrorMessage(t("feedback.subjectRequired"));
      return;
    }
    if (!message.trim()) {
      setErrorMessage(t("feedback.messageRequired"));
      return;
    }

    submitMutation.mutate({
      subject: subject.trim(),
      message: message.trim(),
      feedback_type: feedbackType,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("feedback.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("feedback.subtitle")}</p>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("feedback.submitFeedback")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("feedback.submitDescription")}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">{t("feedback.type")}</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger>
                <SelectValue placeholder={t("feedback.selectType")} />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">{t("feedback.subject")}</Label>
            <Input
              id="subject"
              placeholder={t("feedback.subjectPlaceholder")}
              value={subject}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSubject(e.target.value)
              }
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t("feedback.message")}</Label>
            <Textarea
              id="message"
              placeholder={t("feedback.messagePlaceholder")}
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setMessage(e.target.value)
              }
              rows={6}
              maxLength={5000}
            />
            <p className="text-muted-foreground text-xs">
              {message.length}/5000
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full"
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t("feedback.submit")}
          </Button>
        </form>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("feedback.myFeedback")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("feedback.myFeedbackDescription")}
        </p>

        <div className="mt-4">
          {feedbackLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : myFeedback && myFeedback.length > 0 ? (
            <div className="space-y-3">
              {myFeedback.map((feedback: FeedbackResponse) => {
                const TypeIconComponent =
                  FEEDBACK_TYPES.find(
                    (ft) => ft.value === feedback.feedback_type
                  )?.icon || MessageSquare;

                return (
                  <div
                    key={feedback.id}
                    className="bg-muted/30 rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 rounded-lg p-2">
                          <TypeIconComponent className="text-primary h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{feedback.subject}</p>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                            {feedback.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-xs">
                          {getStatusIcon(feedback.status)}
                          <span>{getStatusLabel(feedback.status)}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="text-muted-foreground/50 h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                {t("feedback.noFeedbackYet")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Success Dialog */}
      <AlertDialog open={successDialog} onOpenChange={setSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feedback.thankYou")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.successMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSuccessDialog(false)}>
              {t("common.close")}
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
