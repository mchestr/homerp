"use client";

import { useCallback, useState } from "react";
import { X, Loader2, Sparkles, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imagesApi, ClassificationResult } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useInsufficientCreditsModal } from "@/components/billing/insufficient-credits-modal";
import { useAuth } from "@/context/auth-context";

type UploadedImage = {
  id: string;
  url: string;
  filename: string;
};

type ImageUploadProps = {
  onImageUploaded: (image: UploadedImage) => void;
  onClassificationComplete: (result: ClassificationResult) => void;
  uploadedImages: UploadedImage[];
  onRemoveImage: (id: string) => void;
};

export function ImageUpload({
  onImageUploaded,
  onClassificationComplete,
  uploadedImages,
  onRemoveImage,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyingImageId, setClassifyingImageId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { show: showInsufficientCredits, InsufficientCreditsModal } = useInsufficientCreditsModal();
  const { refreshCredits } = useAuth();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be less than 10MB");
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await imagesApi.upload(file);
        onImageUploaded({
          id: result.id,
          url: imagesApi.getFileUrl(result.id),
          filename: result.original_filename || file.name,
        });
      } catch (err) {
        console.error("Upload error:", err);
        setError("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [onImageUploaded]
  );

  const handleClassify = useCallback(
    async (imageId: string) => {
      setIsClassifying(true);
      setClassifyingImageId(imageId);
      setError(null);

      try {
        const response = await imagesApi.classify(imageId);
        if (response.success && response.classification) {
          onClassificationComplete(response.classification);
          // Refresh credits after successful classification
          refreshCredits();
        } else {
          setError(response.error || "Classification failed");
        }
      } catch (err: unknown) {
        console.error("Classification error:", err);
        // Check for 402 Payment Required (insufficient credits)
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 402) {
          showInsufficientCredits();
        } else {
          setError("Failed to classify image. Please try again.");
        }
      } finally {
        setIsClassifying(false);
        setClassifyingImageId(null);
      }
    },
    [onClassificationComplete, showInsufficientCredits, refreshCredits]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please drop an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const result = await imagesApi.upload(file);
      onImageUploaded({
        id: result.id,
        url: imagesApi.getFileUrl(result.id),
        filename: result.original_filename || file.name,
      });
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <InsufficientCreditsModal />
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <div className="text-center">
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="mt-4 font-medium">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-muted p-4">
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 font-medium">
                {isDragging ? "Drop image here" : "Click or drag to upload"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                PNG, JPG up to 10MB
              </p>
            </div>
          )}
        </div>
      </label>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {uploadedImages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {uploadedImages.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl border bg-muted"
            >
              <img
                src={image.url}
                alt={image.filename}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="truncate text-sm font-medium text-white">
                  {image.filename}
                </p>
              </div>
              <button
                onClick={() => onRemoveImage(image.id)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
              <Button
                onClick={() => handleClassify(image.id)}
                disabled={isClassifying}
                size="sm"
                className="absolute bottom-4 right-4 gap-2 shadow-lg"
              >
                {isClassifying && classifyingImageId === image.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Identify Item
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
