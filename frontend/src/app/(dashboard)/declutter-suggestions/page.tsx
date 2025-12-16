"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Clock,
  Coins,
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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import {
  profileApi,
  PurgeRecommendationWithItem,
  DeclutterCostResponse,
} from "@/lib/api/api-client";

export default function DeclutterSuggestionsPage() {
  const t = useTranslations("declutterSuggestions");
  const { toast } = useToast();
  const { refreshCredits } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [costInfo, setCostInfo] = useState<DeclutterCostResponse | null>(null);
  const [itemsToAnalyze, setItemsToAnalyze] = useState(50);
  const [recommendations, setRecommendations] = useState<
    PurgeRecommendationWithItem[]
  >([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadCostInfo = useCallback(
    async (items: number) => {
      try {
        const response = await profileApi.getDeclutterCost(items);
        setCostInfo(response);
      } catch {
        toast({
          title: "Error",
          description: t("loadError"),
          variant: "destructive",
        });
      }
    },
    [toast, t]
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [costRes, recommendationsRes] = await Promise.all([
          profileApi.getDeclutterCost(itemsToAnalyze),
          profileApi.getRecommendations(),
        ]);
        setCostInfo(costRes);
        setRecommendations(recommendationsRes);
        // Cap itemsToAnalyze to total items if needed
        const maxItems = Math.max(10, Math.min(200, costRes.total_items));
        if (itemsToAnalyze > maxItems) {
          setItemsToAnalyze(maxItems);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, t]);

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0];
    setItemsToAnalyze(newValue);

    // Debounce the API call to avoid excessive requests while dragging
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadCostInfo(newValue);
    }, 300);
  };

  const handleGenerate = async () => {
    if (!costInfo?.has_profile) {
      toast({
        title: "Error",
        description: t("configureProfileFirst"),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await profileApi.generateRecommendations({
        max_recommendations: 50,
        items_to_analyze: itemsToAnalyze,
      });
      setRecommendations((prev) => [...response.recommendations, ...prev]);

      // Refresh credits and cost info
      await refreshCredits();
      await loadCostInfo(itemsToAnalyze);

      toast({
        title: t("generateComplete"),
        description: t("generateCompleteDescription", {
          count: response.total_generated,
          credits: response.credits_used,
        }),
      });
    } catch (error: unknown) {
      const apiError = error as { status?: number };
      if (apiError.status === 402) {
        toast({
          title: t("insufficientCredits"),
          description: t("insufficientCreditsDescription"),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: t("generateError"),
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
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
        title: t("recommendationAccepted"),
      });
    } catch {
      toast({
        title: "Error",
        description: t("updateError"),
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
        title: t("recommendationDismissed"),
      });
    } catch {
      toast({
        title: "Error",
        description: t("updateError"),
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
      unused_duration: t("factorUnusedDuration"),
      high_quantity: t("factorHighQuantity"),
      low_value: t("factorLowValue"),
      not_matching_interests: t("factorNotMatchingInterests"),
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
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-3">
            <Sparkles className="text-primary h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Cost Info Card */}
      {costInfo && (
        <Card data-testid="cost-info-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary h-5 w-5" />
              {t("generateTitle")}
            </CardTitle>
            <CardDescription>{t("generateDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Slider Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t("itemsToAnalyze")}
                </label>
                <span className="text-muted-foreground text-sm">
                  {itemsToAnalyze} {t("items")}
                </span>
              </div>
              <Slider
                value={[itemsToAnalyze]}
                onValueChange={handleSliderChange}
                min={10}
                max={Math.max(10, Math.min(200, costInfo.total_items))}
                step={10}
                className="w-full"
                data-testid="items-slider"
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>10</span>
                <span>{Math.max(10, Math.min(200, costInfo.total_items))}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">{costInfo.total_items}</div>
                <div className="text-muted-foreground text-sm">
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
                <div className="text-muted-foreground text-sm">
                  {t("creditsRequired")}
                </div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold">
                  {costInfo.user_credit_balance}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("yourCredits")}
                </div>
              </div>
            </div>

            <div className="text-muted-foreground text-sm">
              {t("costExplanation", {
                itemsPerCredit: costInfo.items_per_credit,
              })}
            </div>

            {/* Warnings */}
            {!costInfo.has_profile && (
              <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium">{t("configureProfileFirst")}</p>
                    <Link
                      href="/settings/profile"
                      className="text-primary text-sm hover:underline"
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
                    <p className="text-muted-foreground text-sm">
                      {t("needMoreCredits", {
                        needed: costInfo.credits_required,
                        have: costInfo.user_credit_balance,
                      })}
                    </p>
                    <Link
                      href="/settings/billing"
                      className="text-primary text-sm hover:underline"
                    >
                      {t("buyCredits")}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {costInfo.total_items === 0 && (
              <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">{t("noItems")}</p>
                    <Link
                      href="/items/new"
                      className="text-primary text-sm hover:underline"
                    >
                      {t("addFirstItem")}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            {costInfo.has_profile &&
              costInfo.has_sufficient_credits &&
              costInfo.total_items > 0 && (
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full"
                  size="lg"
                  data-testid="generate-button"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating
                    ? t("generating")
                    : t("generateRecommendations")}
                  {!isGenerating && (
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
          </CardContent>
        </Card>
      )}

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t("resultsTitle")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("resultsDescription", { count: recommendations.length })}
              </p>
            </div>
          </div>

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
                          {t("quantity")}: {rec.item_quantity}{" "}
                          {rec.item_quantity_unit}
                        </span>
                        {rec.item_price && (
                          <span>
                            {t("value")}: ${rec.item_price.toFixed(2)}
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
                          {t("confidence")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={rec.confidence * 100}
                            className="h-2 w-16"
                          />
                          <span className="text-muted-foreground text-sm">
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
                      {t("reason")}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {rec.reason}
                    </p>
                  </div>

                  {rec.factors && Object.keys(rec.factors).length > 0 && (
                    <div>
                      <div className="mb-1 text-sm font-medium">
                        {t("factors")}
                      </div>
                      {renderFactors(rec.factors)}
                    </div>
                  )}

                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>
                      {rec.last_used_at
                        ? `${t("lastUsed")}: ${formatRelativeTime(rec.last_used_at)}`
                        : t("neverUsed")}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 border-t pt-2">
                    <Textarea
                      placeholder={t("feedbackPlaceholder")}
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
                        {t("accept")}
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
                        {t("dismiss")}
                      </Button>
                      <Link href={`/items/${rec.item_id}`}>
                        <Button variant="ghost" size="sm">
                          {t("viewItem")}
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

      {/* Empty State */}
      {recommendations.length === 0 && costInfo?.has_profile && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="text-muted-foreground/50 h-12 w-12" />
            <h3 className="mt-4 text-lg font-semibold">
              {t("noRecommendations")}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("noRecommendationsDescription")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
