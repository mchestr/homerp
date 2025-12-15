"use client";

import { useState, useCallback } from "react";
import { Package, Star, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Image } from "@/lib/api/api-client";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";

type ImageGalleryProps = {
  images: Image[];
  onSetPrimary?: (imageId: string) => Promise<void>;
  onRemoveImage?: (imageId: string) => Promise<void>;
  editable?: boolean;
};

export function ImageGallery({
  images,
  onSetPrimary,
  onRemoveImage,
  editable = false,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("images");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const currentImage = images[selectedIndex];

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleSetPrimary = useCallback(
    async (imageId: string) => {
      if (!onSetPrimary) return;
      setIsLoading(true);
      try {
        await onSetPrimary(imageId);
      } catch (error) {
        console.error("Failed to set primary image:", error);
        toast({
          title: tCommon("error"),
          description: t("setPrimaryFailed"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onSetPrimary, toast, tCommon, t]
  );

  const handleRemove = useCallback(
    async (imageId: string) => {
      if (!onRemoveImage) return;
      setIsLoading(true);
      try {
        await onRemoveImage(imageId);
        // Adjust selected index if needed
        if (selectedIndex >= images.length - 1 && selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        }
      } catch (error) {
        console.error("Failed to remove image:", error);
        toast({
          title: tCommon("error"),
          description: t("removeFailed"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onRemoveImage, selectedIndex, images.length, toast, tCommon, t]
  );

  if (images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/50">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("uploadImages")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image display */}
      <div className="group relative overflow-hidden rounded-xl border bg-muted">
        {currentImage && (
          <>
            <AuthenticatedImage
              imageId={currentImage.id}
              alt={currentImage.original_filename || "Item image"}
              className="aspect-video w-full object-contain"
              data-testid="main-gallery-image"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            {/* Primary badge */}
            {currentImage.is_primary && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                <Star className="h-3 w-3 fill-current" />
                {t("primaryImage")}
              </div>
            )}

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={handlePrevious}
                  data-testid="gallery-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={handleNext}
                  data-testid="gallery-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Editable controls */}
            {editable && (
              <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                {!currentImage.is_primary && onSetPrimary && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleSetPrimary(currentImage.id)}
                    disabled={isLoading}
                    data-testid="set-primary-button"
                  >
                    <Star className="h-3 w-3" />
                    {t("setAsPrimary")}
                  </Button>
                )}
                {onRemoveImage && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemove(currentImage.id)}
                    disabled={isLoading}
                    data-testid="remove-gallery-image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
                {selectedIndex + 1} / {images.length}
              </div>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                selectedIndex === index
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
              data-testid={`gallery-thumbnail-${index}`}
            >
              <AuthenticatedImage
                imageId={image.id}
                alt={image.original_filename || `Image ${index + 1}`}
                className="h-full w-full object-cover"
                thumbnail
              />
              {image.is_primary && (
                <div className="absolute left-0.5 top-0.5 rounded-full bg-amber-500 p-0.5">
                  <Star className="h-2.5 w-2.5 fill-white text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
