"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { billingApi } from "@/lib/api/api";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function PricingSection() {
  const t = useTranslations("pricing");

  const {
    data: packs,
    isLoading: packsLoading,
    isError: packsError,
  } = useQuery({
    queryKey: ["credit-packs"],
    queryFn: billingApi.getPacks,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const {
    data: costs,
    isLoading: costsLoading,
    isError: costsError,
  } = useQuery({
    queryKey: ["operation-costs"],
    queryFn: billingApi.getCosts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const signupCredits = costs?.signup_credits ?? 5;
  const isLoading = packsLoading || costsLoading;
  const isError = packsError || costsError;

  const freeFeatures = [
    t("features.unlimitedItems"),
    t("features.unlimitedLocations"),
    t("features.qrCodes"),
    t("features.lowStockAlerts"),
    t("features.collaboration"),
    t("features.freeCredits", { count: signupCredits }),
  ];

  // Show error state if API requests fail
  if (isError) {
    return (
      <section id="pricing" className="bg-muted/30 border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-muted-foreground py-8 text-center">
            <p>{t("loadError")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="bg-muted/30 border-t py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            {t("description")}
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Free Tier */}
            <div className="bg-card rounded-3xl border p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">{t("freeTier.title")}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("freeTier.subtitle")}
                </p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">
                  {t("freeTier.price")}
                </span>
                <span className="text-muted-foreground">
                  {t("freeTier.period")}
                </span>
              </div>
              <ul className="mb-8 space-y-3">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check
                      className="h-5 w-5 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-xl font-medium transition-colors"
              >
                {t("freeTier.button")}
              </Link>
            </div>

            {/* Credit Packs */}
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-blue-600 to-teal-600 p-8 text-white">
              <div
                className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                  {t("creditPacks.bestValue")}
                </div>
                <div className="mb-6">
                  <h3 className="text-xl font-semibold">
                    {t("creditPacks.title")}
                  </h3>
                  <p className="mt-1 text-sm text-white/80">
                    {t("creditPacks.subtitle")}
                  </p>
                </div>
                <div className="mb-6 space-y-2">
                  {isLoading ? (
                    // Loading skeleton
                    <>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl bg-white/10 p-3"
                        >
                          <div className="h-5 w-24 animate-pulse rounded bg-white/20" />
                          <div className="h-5 w-12 animate-pulse rounded bg-white/20" />
                        </div>
                      ))}
                    </>
                  ) : (
                    packs?.map((pack) => (
                      <div
                        key={pack.id}
                        className={`flex items-center justify-between rounded-xl p-3 ${
                          pack.is_best_value ? "bg-white/20" : "bg-white/10"
                        }`}
                      >
                        <span>
                          {t("creditPacks.credits", { count: pack.credits })}
                        </span>
                        <span className="font-semibold">
                          {formatPrice(pack.price_cents)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <ul className="mb-8 space-y-2 text-sm text-white/90">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{t("creditPacks.benefits.neverExpire")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{t("creditPacks.benefits.photoClassification")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{t("creditPacks.benefits.aiConversations")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{t("creditPacks.benefits.locationSuggestions")}</span>
                  </li>
                </ul>
                <Link
                  href="/login"
                  className="inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-xl bg-white font-medium text-teal-600 transition-colors hover:bg-white/90"
                >
                  {t("creditPacks.button")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
