"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Payment Cancelled</h1>
      <p className="mt-2 text-muted-foreground">
        Your payment was cancelled. No charges were made.
      </p>
      <div className="mt-8">
        <Link href="/settings/billing">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing
          </Button>
        </Link>
      </div>
    </div>
  );
}
