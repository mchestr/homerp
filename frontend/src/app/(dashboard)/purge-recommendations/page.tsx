"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Clock,
  Coins,
  Loader2,
  Sparkles,
  Trash2,
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
  UserSystemProfile,
} from "@/lib/api/api-client";

export default function PurgeRecommendationsPage() {
  const t = useTranslations("purgeRecommendations");
  const { toast } = useToast();
  const { refreshCredits } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [profile, setProfile] = useState<UserSystemProfile | null>(null);
  const [recommendations, setRecommendations] = useState<
    PurgeRecommendationWithItem[]
  >([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, recommendationsRes] = await Promise.all([
          profileApi.getProfile(),
          profileApi.getRecommendations(),
        ]);
        setProfile(profileRes);
        setRecommendations(recommendationsRes);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load recommendations",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [toast]);

  const handleGenerate = async () => {
    if (!profile) {
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
        max_recommendations: 10,
      });
      setRecommendations((prev) => [...response.recommendations, ...prev]);
      await refreshCredits();
      toast({
        title: "Success",
        description: `Generated ${response.total_generated} recommendations`,
      });
    } catch (error: unknown) {
      const apiError = error as { status?: number };
      if (apiError.status === 402) {
        toast({
          title: "Insufficient Credits",
          description: "You need credits to generate recommendations",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate recommendations",
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
        title: t("recommendationDismissed"),
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !profile}
          data-testid="generate-recommendations-button"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isGenerating ? t("generating") : t("generateRecommendations")}
          {!isGenerating && (
            <Badge variant="secondary" className="ml-2">
              <Coins className="mr-1 h-3 w-3" />
              {t("creditCost")}
            </Badge>
          )}
        </Button>
      </div>

      {/* No Profile Warning */}
      {!profile && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium">{t("configureProfileFirst")}</p>
              <Link
                href="/settings/profile"
                className="text-sm text-primary hover:underline"
              >
                Go to System Profile Settings
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {recommendations.length === 0 && profile && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">
              {t("noRecommendations")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noRecommendationsDescription")}
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
                      {t("quantity")}: {rec.item_quantity}{" "}
                      {rec.item_quantity_unit}
                    </span>
                    {rec.item_price && (
                      <span>
                        {t("value")}: ${rec.item_price.toFixed(2)}
                      </span>
                    )}
                    {rec.item_category_name && (
                      <Badge variant="outline">{rec.item_category_name}</Badge>
                    )}
                    {rec.item_location_name && (
                      <Badge variant="outline">{rec.item_location_name}</Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-medium">{t("confidence")}</div>
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
                <div className="mb-1 text-sm font-medium">{t("reason")}</div>
                <p className="text-sm text-muted-foreground">{rec.reason}</p>
              </div>

              {rec.factors && Object.keys(rec.factors).length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-medium">{t("factors")}</div>
                  {renderFactors(rec.factors)}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
    </div>
  );
}
