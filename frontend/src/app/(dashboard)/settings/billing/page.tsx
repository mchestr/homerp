"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import {
  billingApi,
  CreditPack,
  CreditTransaction,
} from "@/lib/api/client";
import {
  Coins,
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
          <span className="text-3xl font-bold">{formatPrice(pack.price_cents)}</span>
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
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="font-medium text-sm">{typeLabels[transaction.transaction_type] || transaction.transaction_type}</p>
        <p className="text-xs text-muted-foreground">{transaction.description}</p>
        <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
      </div>
      <div className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? "+" : ""}{transaction.amount}
        {transaction.is_refunded && (
          <span className="ml-2 text-xs text-muted-foreground">(refunded)</span>
        )}
      </div>
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

      {/* Current Balance */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground mt-1">
                Resets {formatDate(creditBalance.next_free_reset_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Credits */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Purchase Credits
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits are used for AI-powered image classification. Purchased credits never expire.
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
          <p className="mt-4 text-sm text-muted-foreground text-center py-4">
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
