"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BillingSuccessPage() {
  const { refreshCredits } = useAuth();

  useEffect(() => {
    // Refresh credits to show updated balance
    refreshCredits();
  }, [refreshCredits]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
        <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Payment Successful!</h1>
      <p className="text-muted-foreground mt-2">
        Your credits have been added to your account.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/settings/billing">
          <Button variant="outline">View Balance</Button>
        </Link>
        <Link href="/items/new">
          <Button>
            Add Item
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
