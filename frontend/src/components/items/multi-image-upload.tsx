"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Sparkles,
  ImagePlus,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { imagesApi, ClassificationResult } from "@/lib/api/api-client";
import { cn } from "@/lib/utils";
import { useInsufficientCreditsModal } from "@/components/billing/insufficient-credits-modal";
import { useAuth } from "@/context/auth-context";
import { useTranslations } from "next-intl";

export type UploadedImage = {
  id: string;
  url: string;
  filename: string;
  aiProcessed?: boolean;
  isPrimary?: boolean;
};

type MultiImageUploadProps = {
  onImageUploaded: (image: UploadedImage) => void;
  onClassificationComplete: (result: ClassificationResult) => void;
  uploadedImages: UploadedImage[];
  onRemoveImage: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onReorderImages?: (images: UploadedImage[]) => void;
  maxImages?: number;
};

export function MultiImageUpload({
  onImageUploaded,
  onClassificationComplete,
  uploadedImages,
  onRemoveImage,
  onSetPrimary,
  maxImages = 10,
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [allClassified, setAllClassified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { show: showInsufficientCredits, InsufficientCreditsModal } =
    useInsufficientCreditsModal();
  const { refreshCredits } = useAuth();
  const t = useTranslations("billing");
  const tImages = useTranslations("images");

  // Get the selected image or first image
  const selectedImage = uploadedImages.find(
    (img) => img.id === selectedImageId
  );
  const currentImage = selectedImage || uploadedImages[0];

  // Check if images need classification (not already processed and not yet classified in this session)
  const unclassifiedImages = uploadedImages.filter((img) => !img.aiProcessed);
  const needsClassification =
    !allClassified &&
    unclassifiedImages.length > 0 &&
    uploadedImages.length > 0;
  const creditCost = uploadedImages.length;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Process each file
      for (const file of Array.from(files)) {
        if (uploadedImages.length >= maxImages) {
          setError(tImages("maxImagesAllowed", { count: maxImages }));
          break;
        }

        if (!file.type.startsWith("image/")) {
          setError(tImages("pleaseSelectImageFile"));
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          setError(tImages("imageMustBeLessThan10MB"));
          continue;
        }

        setError(null);
        setIsUploading(true);

        try {
          const result = await imagesApi.upload(file);
          const { url } = await imagesApi.getSignedUrl(result.id);
          const imageData = await imagesApi.get(result.id);

          const newImage: UploadedImage = {
            id: result.id,
            url,
            filename: result.original_filename || file.name,
            aiProcessed: imageData.ai_processed,
            isPrimary: uploadedImages.length === 0, // First image is primary by default
          };

          onImageUploaded(newImage);

          if (imageData.ai_processed && imageData.ai_result) {
            onClassificationComplete(
              imageData.ai_result as ClassificationResult
            );
          }
        } catch (err) {
          console.error("Upload error:", err);
          setError(tImages("uploadFailed"));
        }
      }
      setIsUploading(false);
      e.target.value = "";
    },
    [
      onImageUploaded,
      onClassificationComplete,
      uploadedImages.length,
      maxImages,
      tImages,
    ]
  );

  const handleClassifyAll = useCallback(async () => {
    if (uploadedImages.length === 0) return;

    setIsClassifying(true);
    setError(null);

    try {
      // Send all image IDs together for classification
      const imageIds = uploadedImages.map((img) => img.id);
      const response = await imagesApi.classify(
        imageIds,
        customPrompt.trim() || undefined
      );
      if (response.success && response.classification) {
        onClassificationComplete(response.classification);
        setAllClassified(true);
        refreshCredits();
        setCustomPrompt("");
        setIsPromptExpanded(false);
      } else {
        setError(response.error || tImages("classificationFailed"));
      }
    } catch (err: unknown) {
      console.error("Classification error:", err);
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 402
      ) {
        showInsufficientCredits();
      } else {
        setError(tImages("classifyFailed"));
      }
    } finally {
      setIsClassifying(false);
    }
  }, [
    uploadedImages,
    onClassificationComplete,
    showInsufficientCredits,
    refreshCredits,
    customPrompt,
    tImages,
  ]);

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

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (uploadedImages.length >= maxImages) {
        setError(tImages("maxImagesAllowed", { count: maxImages }));
        break;
      }

      if (!file.type.startsWith("image/")) {
        setError(tImages("pleaseDropImageFile"));
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(tImages("imageMustBeLessThan10MB"));
        continue;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await imagesApi.upload(file);
        const { url } = await imagesApi.getSignedUrl(result.id);
        const imageData = await imagesApi.get(result.id);

        const newImage: UploadedImage = {
          id: result.id,
          url,
          filename: result.original_filename || file.name,
          aiProcessed: imageData.ai_processed,
          isPrimary: uploadedImages.length === 0,
        };

        onImageUploaded(newImage);

        if (imageData.ai_processed && imageData.ai_result) {
          onClassificationComplete(imageData.ai_result as ClassificationResult);
        }
      } catch (err) {
        console.error("Upload error:", err);
        setError(tImages("uploadFailed"));
      }
    }
    setIsUploading(false);
  };

  const canAddMore = uploadedImages.length < maxImages;

  return (
    <div className="space-y-4">
      <InsufficientCreditsModal />

      {/* Main image display */}
      {currentImage ? (
        <div className="group relative overflow-hidden rounded-xl border bg-muted">
          <img
            src={currentImage.url}
            alt={currentImage.filename}
            className="aspect-video w-full bg-black/5 object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2">
              {currentImage.isPrimary && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                  <Star className="h-3 w-3 fill-current" />
                  {tImages("primaryImage")}
                </span>
              )}
              <p className="truncate text-sm font-medium text-white">
                {currentImage.filename}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemoveImage(currentImage.id)}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70"
            title={tImages("removeImage")}
            data-testid="remove-image-button"
          >
            <X className="h-4 w-4" />
          </button>
          {allClassified || currentImage.aiProcessed ? (
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
              <CheckCircle2 className="h-4 w-4" />
              {tImages("identified")}
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleClassifyAll}
              disabled={isClassifying}
              size="sm"
              className="absolute bottom-4 right-4 gap-2 shadow-lg"
              data-testid="classify-button"
            >
              {isClassifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("analyzing")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("identifyItemCostMultiple", { count: creditCost })}
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
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
          data-testid="image-upload-dropzone"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
            multiple
          />
          <div className="text-center">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="mt-4 font-medium">{tImages("classifying")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-muted p-4">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 font-medium">
                  {isDragging
                    ? tImages("dragAndDrop")
                    : tImages("uploadImages")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tImages("supportedFormats")}
                </p>
                <Link
                  href="/images/classified"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <History className="h-4 w-4" />
                  {tImages("classifiedImages")}
                </Link>
              </div>
            )}
          </div>
        </label>
      )}

      {/* Thumbnail strip for multiple images */}
      {uploadedImages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {uploadedImages.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedImageId(image.id)}
              className={cn(
                "group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                currentImage?.id === image.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
              data-testid={`thumbnail-${image.id}`}
            >
              <img
                src={image.url}
                alt={image.filename}
                className="h-full w-full object-cover"
              />
              {image.isPrimary && (
                <div className="absolute left-0.5 top-0.5 rounded-full bg-amber-500 p-0.5">
                  <Star className="h-2.5 w-2.5 fill-white text-white" />
                </div>
              )}
              {!image.isPrimary && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(image.id);
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  title={tImages("setAsPrimary")}
                  data-testid={`set-primary-${image.id}`}
                >
                  <Star className="h-4 w-4 text-white" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveImage(image.id);
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                data-testid={`remove-thumbnail-${image.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}

          {/* Add more button */}
          {canAddMore && (
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50",
                isUploading && "pointer-events-none opacity-50"
              )}
              data-testid="add-more-images"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
                multiple
              />
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </label>
          )}
        </div>
      )}

      {/* Custom prompt section */}
      {needsClassification && (
        <div className="rounded-lg border bg-card">
          <button
            type="button"
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
            data-testid="custom-prompt-toggle"
          >
            <span>{tImages("customPrompt.title")}</span>
            {isPromptExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {isPromptExpanded && (
            <div className="border-t px-4 pb-4 pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                {tImages("customPrompt.description")}
              </p>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={tImages("customPrompt.placeholder")}
                className="min-h-[80px] resize-none text-sm"
                data-testid="custom-prompt-textarea"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
