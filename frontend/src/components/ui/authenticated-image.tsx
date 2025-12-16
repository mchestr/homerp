"use client";

import { useEffect, useState } from "react";
import { imagesApi } from "@/lib/api/api-client";
import { cn } from "@/lib/utils";

type AuthenticatedImageProps = {
  imageId: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  /** Use thumbnail version for faster loading in list views */
  thumbnail?: boolean;
};

/**
 * Component for displaying images that require authentication.
 * Fetches a signed URL from the API before displaying the image.
 */
export function AuthenticatedImage({
  imageId,
  alt,
  className,
  fallback,
  thumbnail = false,
}: AuthenticatedImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchSignedUrl() {
      try {
        const { url } = await imagesApi.getSignedUrl(imageId, thumbnail);
        if (mounted) {
          setSrc(url);
        }
      } catch {
        if (mounted) {
          setError(true);
        }
      }
    }

    fetchSignedUrl();

    return () => {
      mounted = false;
    };
  }, [imageId, thumbnail]);

  if (error) {
    return fallback ?? null;
  }

  if (!src) {
    return <div className={cn("bg-muted animate-pulse", className)} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}
