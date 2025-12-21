"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function PricingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/settings?tab=pricing");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
    </div>
  );
}
