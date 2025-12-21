"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Redirect page for the old /items/[id]/edit route.
 * Inline editing is now handled directly on the item details page.
 */
export default function EditRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  useEffect(() => {
    router.replace(`/items/${itemId}`);
  }, [itemId, router]);

  return null;
}
