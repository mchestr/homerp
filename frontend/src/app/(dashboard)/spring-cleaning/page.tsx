"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Clock,
  Coins,
  Flower2,
  Loader2,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import {
  profileApi,
  PurgeRecommendationWithItem,
  SpringCleaningCostResponse,
} from "@/lib/api/api-client";

export default function SpringCleaningPage() {
  const t = useTranslations("springCleaning");
  const tPurge = useTranslations("purgeRecommendations");
  const { toast } = useToast();
  const { refreshCredits } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [costInfo, setCostInfo] = useState<SpringCleaningCostResponse | null>(
    null
  );
  const [recommendations, setRecommendations] = useState<
    PurgeRecommendationWithItem[]
  >([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [costRes, existingRecs] = await Promise.all([
          profileApi.getSpringCleaningCost(),
          profileApi.getRecommendations(),
        ]);
        setCostInfo(costRes);
        setRecommendations(existingRecs);
        if (existingRecs.length > 0) {
          setHasRun(true);
        }
      } catch {
        toast({
          title: "Error",
          description: t("loadError"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [toast, t]);

  const handleRunAudit = async () => {
    if (!costInfo?.has_profile) {
      toast({
        title: "Error",
        description: t("configureProfileFirst"),
        variant: "destructive",
      });
      return;
    }

    setIsRunningAudit(true);
    try {
      const response = await profileApi.runSpringCleaningAudit({
        max_recommendations: 50,
      });
      setRecommendations(response.recommendations);
      setHasRun(true);

      // Refresh credits and cost info to get updated balance
      await refreshCredits();
      const updatedCost = await profileApi.getSpringCleaningCost();
      setCostInfo(updatedCost);

      toast({
        title: t("auditComplete"),
        description: t("auditCompleteDescription", {
          count: response.total_generated,
          credits: response.credits_used,
        }),
      });
    } catch (error: unknown) {
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 402) {
        toast({
          title: t("insufficientCredits"),
          description: t("insufficientCreditsDescription"),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: t("auditError"),
          variant: "destructive",
        });
      }
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleAccept = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await profileApi.updateRecommendation(id, {
        status: "accepted",
        user_feedback: feedbacks[id] || undefined,
      });
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
      toast({
        title: tPurge("recommendationAccepted"),
        description: "",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update recommendation",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDismiss = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      await profileApi.updateRecommendation(id, {
        status: "dismissed",
        user_feedback: feedbacks[id] || undefined,
      });
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
      toast({
        title: tPurge("recommendationDismissed"),
        description: "",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to dismiss recommendation",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const renderFactors = (factors: Record<string, boolean>) => {
    const factorLabels: Record<string, string> = {
      unused_duration: tPurge("factorUnusedDuration"),
      high_quantity: tPurge("factorHighQuantity"),
      low_value: tPurge("factorLowValue"),
      not_matching_interests: tPurge("factorNotMatchingInterests"),
    };

    const activeFactors = Object.entries(factors)
      .filter(([, value]) => value)
      .map(([key]) => factorLabels[key] || key);

    if (activeFactors.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1">
        {activeFactors.map((factor) => (
          <Badge key={factor} variant="secondary" className="text-xs">
            {factor}
          </Badge>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-500/10 p-3">
            <Flower2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Cost Info Card */}
      {costInfo && !hasRun && (
        <Card data-testid="cost-info-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("auditCostTitle")}
            </CardTitle>
            <CardDescription>{t("auditCostDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">{costInfo.total_items}</div>
                <div className="text-sm text-muted-foreground">
                  {t("totalItems")}
                </div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">
                    {costInfo.credits_required}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("creditsRequired")}
                </div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">
                  {costInfo.user_credit_balance}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("yourCredits")}
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {t("costExplanation", {
                itemsPerCredit: costInfo.items_per_credit,
              })}
            </div>

            {!costInfo.has_profile && (
              <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium">{t("configureProfileFirst")}</p>
                    <Link
                      href="/settings/profile"
                      className="text-sm text-primary hover:underline"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Settings className="h-3 w-3" />
                        {t("goToProfile")}
                      </span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {!costInfo.has_sufficient_credits && costInfo.has_profile && (
              <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                  <div className="flex-1">
                    <p className="font-medium">{t("insufficientCredits")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("needMoreCredits", {
                        needed: costInfo.credits_required,
                        have: costInfo.user_credit_balance,
                      })}
                    </p>
                    <Link
                      href="/settings/billing"
                      className="text-sm text-primary hover:underline"
                    >
                      {t("buyCredits")}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {costInfo.has_profile &&
              costInfo.has_sufficient_credits &&
              costInfo.total_items > 0 && (
                <Button
                  onClick={handleRunAudit}
                  disabled={isRunningAudit}
                  className="w-full"
                  size="lg"
                  data-testid="run-audit-button"
                >
                  {isRunningAudit ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Flower2 className="mr-2 h-4 w-4" />
                  )}
                  {isRunningAudit ? t("runningAudit") : t("startAudit")}
                  {!isRunningAudit && (
                    <Badge variant="secondary" className="ml-2">
                      <Coins className="mr-1 h-3 w-3" />
                      {costInfo.credits_required}{" "}
                      {costInfo.credits_required === 1
                        ? t("credit")
                        : t("credits")}
                    </Badge>
                  )}
                </Button>
              )}

            {costInfo.total_items === 0 && (
              <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">{t("noItems")}</p>
                    <Link
                      href="/items/new"
                      className="text-sm text-primary hover:underline"
                    >
                      {t("addFirstItem")}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {hasRun && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t("resultsTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("resultsDescription", { count: recommendations.length })}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRunAudit}
              disabled={
                isRunningAudit ||
                !costInfo?.has_sufficient_credits ||
                !costInfo?.has_profile
              }
              data-testid="run-again-button"
            >
              {isRunningAudit ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {t("runAgain")}
            </Button>
          </div>

          {/* Empty State */}
          {recommendations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Check className="h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-semibold">{t("allClean")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("allCleanDescription")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recommendations List */}
          <div className="grid gap-4">
            {recommendations.map((rec) => (
              <Card key={rec.id} data-testid={`recommendation-${rec.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{rec.item_name}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span>
                          {tPurge("quantity")}: {rec.item_quantity}{" "}
                          {rec.item_quantity_unit}
                        </span>
                        {rec.item_price && (
                          <span>
                            {tPurge("value")}: ${rec.item_price.toFixed(2)}
                          </span>
                        )}
                        {rec.item_category_name && (
                          <Badge variant="outline">
                            {rec.item_category_name}
                          </Badge>
                        )}
                        {rec.item_location_name && (
                          <Badge variant="outline">
                            {rec.item_location_name}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {tPurge("confidence")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={rec.confidence * 100}
                            className="h-2 w-16"
                          />
                          <span className="text-sm text-muted-foreground">
                            {Math.round(rec.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 text-sm font-medium">
                      {tPurge("reason")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.reason}
                    </p>
                  </div>

                  {rec.factors && Object.keys(rec.factors).length > 0 && (
                    <div>
                      <div className="mb-1 text-sm font-medium">
                        {tPurge("factors")}
                      </div>
                      {renderFactors(rec.factors)}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {rec.last_used_at
                        ? `${tPurge("lastUsed")}: ${formatRelativeTime(rec.last_used_at)}`
                        : tPurge("neverUsed")}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 border-t pt-2">
                    <Textarea
                      placeholder={tPurge("feedbackPlaceholder")}
                      value={feedbacks[rec.id] || ""}
                      onChange={(e) =>
                        setFeedbacks((prev) => ({
                          ...prev,
                          [rec.id]: e.target.value,
                        }))
                      }
                      className="min-h-[60px]"
                      data-testid={`feedback-${rec.id}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAccept(rec.id)}
                        disabled={processingIds.has(rec.id)}
                        data-testid={`accept-${rec.id}`}
                      >
                        {processingIds.has(rec.id) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        {tPurge("accept")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDismiss(rec.id)}
                        disabled={processingIds.has(rec.id)}
                        data-testid={`dismiss-${rec.id}`}
                      >
                        {processingIds.has(rec.id) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <X className="mr-2 h-4 w-4" />
                        )}
                        {tPurge("dismiss")}
                      </Button>
                      <Link href={`/items/${rec.item_id}`}>
                        <Button variant="ghost" size="sm">
                          {tPurge("viewItem")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
