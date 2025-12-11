"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { imagesApi, Image, ClassificationResult } from "@/lib/api/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function ClassifiedImagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["images", "classified", page],
    queryFn: () => imagesApi.listClassified(page, 12),
  });

  const updatePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }
    router.push(`/images/classified?${params.toString()}`);
  };

  const aiResult = selectedImage?.ai_result as ClassificationResult | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/items/new">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Classified Images
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data?.total ?? 0} images have been classified by AI
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading images...</p>
          </div>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="rounded-full bg-muted p-4">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No classified images</h3>
          <p className="mt-1 text-center text-muted-foreground">
            Upload and classify images to see them here
          </p>
          <Link href="/items/new" className="mt-6">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((image) => {
              const result = image.ai_result as ClassificationResult | null;
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className="group overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/50 hover:shadow-lg"
                >
                  <div className="relative aspect-square bg-muted">
                    <AuthenticatedImage
                      imageId={image.id}
                      alt={result?.identified_name || "Classified image"}
                      thumbnail
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                      }
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white">
                      <Check className="h-3 w-3" />
                      Identified
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
                      {result?.identified_name || "Unknown"}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {result?.category_path || "No category"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {result?.confidence
                          ? formatConfidence(result.confidence)
                          : "N/A"}{" "}
                        confidence
                      </span>
                      <span>{formatDate(image.created_at)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updatePage(page - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {data.total_pages}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.total_pages}
                onClick={() => updatePage(page + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Image Detail Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{aiResult?.identified_name || "Image Details"}</DialogTitle>
            <DialogDescription>
              Classification result from AI analysis
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                <AuthenticatedImage
                  imageId={selectedImage.id}
                  alt={aiResult?.identified_name || "Classified image"}
                  className="h-full w-full object-contain"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  }
                />
              </div>

              {aiResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Confidence
                      </p>
                      <p className="mt-1">
                        {formatConfidence(aiResult.confidence)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Category
                      </p>
                      <p className="mt-1">{aiResult.category_path}</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-muted-foreground">
                      Description
                    </p>
                    <p className="mt-1 text-sm">{aiResult.description}</p>
                  </div>

                  {aiResult.quantity_estimate && (
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Quantity Estimate
                      </p>
                      <p className="mt-1 text-sm">{aiResult.quantity_estimate}</p>
                    </div>
                  )}

                  {aiResult.specifications &&
                    Object.keys(aiResult.specifications).length > 0 && (
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Specifications
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(aiResult.specifications).map(
                            ([key, value]) => (
                              <div key={key} className="rounded bg-muted px-2 py-1">
                                <span className="font-medium">{key}:</span>{" "}
                                {String(value)}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {aiResult.alternative_suggestions &&
                    aiResult.alternative_suggestions.length > 0 && (
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Alternative Suggestions
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {aiResult.alternative_suggestions.map((alt, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted px-2 py-1 text-xs"
                            >
                              {alt.name} ({formatConfidence(alt.confidence)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <div className="flex justify-between border-t pt-4 text-xs text-muted-foreground">
                <span>
                  Filename: {selectedImage.original_filename || "Unknown"}
                </span>
                <span>Classified: {formatDate(selectedImage.created_at)}</span>
              </div>

              {!selectedImage.item_id && (
                <div className="flex justify-end">
                  <Link
                    href={`/items/new?image_id=${selectedImage.id}`}
                    onClick={() => setSelectedImage(null)}
                  >
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Item from This
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
