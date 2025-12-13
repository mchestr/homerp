"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  billingApi,
  CreditPack,
  CreditTransaction,
} from "@/lib/api/api-client";
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
  Calendar,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

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
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "bg-card"
      }`}
    >
      {pack.is_best_value && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
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
        <p className="mt-1 text-sm text-muted-foreground">
          {pack.credits} credits
        </p>
        <p className="text-xs text-muted-foreground">
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
    refund: "Refund",
  };

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">
          {typeLabels[transaction.transaction_type] ||
            transaction.transaction_type}
        </p>
        <p className="text-xs text-muted-foreground">
          {transaction.description}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(transaction.created_at)}
        </p>
      </div>
      <div
        className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
      >
        {isPositive ? "+" : ""}
        {transaction.amount}
        {transaction.is_refunded && (
          <span className="ml-2 text-xs text-muted-foreground">(refunded)</span>
        )}
      </div>
    </div>
  );
}

function CreditsInfoCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("billing");

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t("howCreditsWork")}</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t px-6 pb-6 pt-4">
          <p className="text-sm text-muted-foreground">
            {t("creditsExplanation")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">{t("freeCreditsInfo")}</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("freeCreditsDescription")}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">
                  {t("purchasedCreditsInfo")}
                </h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("purchasedCreditsDescription")}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">{t("creditCostInfo")}</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("creditCostDescription")}
              </p>
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
          <p className="mt-1 text-muted-foreground">
            Manage your AI credits and billing
          </p>
        </div>
      </div>

      {/* How Credits Work Info Card */}
      <CreditsInfoCard />

      {/* Current Balance */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Coins className="h-5 w-5 text-primary" />
            Credit Balance
          </h2>
          <Button variant="ghost" size="sm" onClick={handleRefreshCredits}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {creditBalance?.total_credits ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Total Available</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-semibold">
              {creditBalance?.purchased_credits ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Purchased</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-semibold">
              {creditBalance?.free_credits ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Free (Monthly)</p>
            {creditBalance?.next_free_reset_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                Resets {formatDate(creditBalance.next_free_reset_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Credits */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          Purchase Credits
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a hobbyist project, and credit purchases help cover the costs
          of AI token usage and site maintenance. Credits are used for
          AI-powered image classification and never expire.
        </p>
        {packsLoading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Transaction History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your recent credit transactions
        </p>
        {transactionsLoading ? (
          <div className="mt-4 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactionsData?.items?.length ? (
          <div className="mt-4">
            {transactionsData.items.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        ) : (
          <p className="mt-4 py-4 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        )}
      </div>

      {/* Manage Billing */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Manage Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
