"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { billingApi, CreditPack, CreditTransaction } from "@/lib/api/api";
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOperationCosts } from "@/hooks/use-operation-costs";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function CreditPackCard({
  pack,
  onPurchase,
  isPending,
}: {
  pack: CreditPack;
  onPurchase: (packId: string) => void;
  isPending: boolean;
}) {
  const pricePerCredit = (pack.price_cents / pack.credits).toFixed(1);

  return (
    <div
      className={`relative rounded-xl border p-6 ${
        pack.is_best_value
          ? "border-primary bg-primary/5 ring-primary ring-2"
          : "bg-card"
      }`}
    >
      {pack.is_best_value && (
        <div className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium">
          Best Value
        </div>
      )}
      <div className="text-center">
        <h3 className="text-lg font-semibold">{pack.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold">
            {formatPrice(pack.price_cents)}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {pack.credits} credits
        </p>
        <p className="text-muted-foreground text-xs">
          {pricePerCredit}c per credit
        </p>
      </div>
      <Button
        className="mt-4 w-full"
        onClick={() => onPurchase(pack.id)}
        disabled={isPending}
        variant={pack.is_best_value ? "default" : "outline"}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        Purchase
      </Button>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: CreditTransaction }) {
  const isPositive = transaction.amount > 0;
  const typeLabels: Record<string, string> = {
    purchase: "Purchase",
    usage: "AI Classification",
    free_monthly: "Monthly Free Credits",
    signup_bonus: "Signup Bonus",
    refund: "Refund",
  };

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">
          {typeLabels[transaction.transaction_type] ||
            transaction.transaction_type}
        </p>
        <p className="text-muted-foreground text-xs">
          {transaction.description}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatDate(transaction.created_at)}
        </p>
      </div>
      <div
        className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
      >
        {isPositive ? "+" : ""}
        {transaction.amount}
        {transaction.is_refunded && (
          <span className="text-muted-foreground ml-2 text-xs">(refunded)</span>
        )}
      </div>
    </div>
  );
}

function CreditsInfoCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("billing");
  const { getCost, isLoading: isCostsLoading } = useOperationCosts();

  const operationCosts = [
    {
      key: "imageClassification",
      cost: getCost("image_classification"),
    },
    {
      key: "locationAnalysis",
      cost: getCost("location_analysis"),
    },
    {
      key: "aiAssistant",
      cost: getCost("assistant_query"),
    },
    {
      key: "locationSuggestion",
      cost: getCost("location_suggestion"),
    },
  ];

  return (
    <div className="bg-card rounded-xl border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="text-primary h-5 w-5" />
          <h2 className="font-semibold">{t("howCreditsWork")}</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-muted-foreground h-5 w-5" />
        ) : (
          <ChevronDown className="text-muted-foreground h-5 w-5" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t px-6 pt-4 pb-6">
          <p className="text-muted-foreground text-sm">
            {t("creditsExplanation")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary h-4 w-4" />
                <h3 className="text-sm font-medium">
                  {t("signupCreditsInfo")}
                </h3>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {t("signupCreditsDescription")}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Zap className="text-primary h-4 w-4" />
                <h3 className="text-sm font-medium">{t("creditCostInfo")}</h3>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {t("creditCostInfoDescription")}
              </p>
              {isCostsLoading ? (
                <p className="text-muted-foreground mt-2 text-xs">...</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {operationCosts.map(({ key, cost }) => (
                    <li
                      key={key}
                      className="text-muted-foreground flex justify-between"
                    >
                      <span>{t(`operationCosts.${key}`)}</span>
                      <span className="font-medium">
                        {t("creditCost", { cost: cost ?? 1 })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingSettingsPage() {
  const { creditBalance, refreshCredits } = useAuth();
  const queryClient = useQueryClient();
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);

  const { data: packs, isLoading: packsLoading } = useQuery({
    queryKey: ["credit-packs"],
    queryFn: billingApi.getPacks,
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["credit-transactions"],
    queryFn: () => billingApi.getTransactions(1, 10),
  });

  const checkoutMutation = useMutation({
    mutationFn: (packId: string) => billingApi.createCheckout(packId),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.checkout_url;
    },
    onSettled: () => {
      setPurchasingPackId(null);
    },
  });

  const portalMutation = useMutation({
    mutationFn: billingApi.createPortalSession,
    onSuccess: (data) => {
      window.location.href = data.portal_url;
    },
  });

  const handlePurchase = (packId: string) => {
    setPurchasingPackId(packId);
    checkoutMutation.mutate(packId);
  };

  const handleRefreshCredits = async () => {
    await refreshCredits();
    queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Billing & Credits
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI credits and billing
          </p>
        </div>
      </div>

      {/* How Credits Work Info Card */}
      <CreditsInfoCard />

      {/* Current Balance */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Coins className="text-primary h-5 w-5" />
            Credit Balance
          </h2>
          <Button variant="ghost" size="sm" onClick={handleRefreshCredits}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4">
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <p className="text-primary text-4xl font-bold">
              {creditBalance?.total_credits ?? 0}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Credits Available
            </p>
          </div>
        </div>
      </div>

      {/* Purchase Credits */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="text-primary h-5 w-5" />
          Purchase Credits
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This is a hobbyist project, and credit purchases help cover the costs
          of AI token usage and site maintenance. Credits are used for
          AI-powered image classification and never expire.
        </p>
        {packsLoading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {packs?.map((pack) => (
              <CreditPackCard
                key={pack.id}
                pack={pack}
                onPurchase={handlePurchase}
                isPending={purchasingPackId === pack.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">Transaction History</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your recent credit transactions
        </p>
        {transactionsLoading ? (
          <div className="mt-4 flex justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : transactionsData?.items?.length ? (
          <div className="mt-4">
            {transactionsData.items.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-4 py-4 text-center text-sm">
            No transactions yet
          </p>
        )}
      </div>

      {/* Manage Billing */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">Manage Billing</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          View invoices and manage payment methods
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
        >
          {portalMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Open Billing Portal
        </Button>
      </div>
    </div>
  );
}
