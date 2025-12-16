"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, X, MapPin } from "lucide-react";
import { imagesApi, Image } from "@/lib/api/api-client";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type LocationPhotoProps = {
  locationId: string;
  locationName: string;
  editable?: boolean;
};

export function LocationPhoto({
  locationId,
  locationName,
  editable = false,
}: LocationPhotoProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("locations");
  const tCommon = useTranslations("common");

  // Fetch location images
  const { data: images = [], isLoading } = useQuery({
    queryKey: ["location-images", locationId],
    queryFn: () => imagesApi.getByLocation(locationId),
  });

  // Get the primary image or the first one
  const primaryImage = images.find((img: Image) => img.is_primary) || images[0];

  // Mutation to attach image to location
  const attachMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await imagesApi.attachToLocation(imageId, locationId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["location-images", locationId],
      });
      toast({
        title: t("photoUploaded"),
        description: t("photoUploadedDescription"),
      });
    },
    onError: () => {
      toast({
        title: tCommon("error"),
        description: t("photoUploadFailed"),
        variant: "destructive",
      });
    },
  });

  // Mutation to remove image from location
  const removeMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await imagesApi.detachFromLocation(imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["location-images", locationId],
      });
      toast({
        title: t("photoRemoved"),
        description: t("photoRemovedDescription"),
      });
    },
    onError: () => {
      toast({
        title: tCommon("error"),
        description: t("photoRemoveFailed"),
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: tCommon("error"),
          description: t("invalidImageType"),
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: tCommon("error"),
          description: t("imageTooLarge"),
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      try {
        const result = await imagesApi.upload(file);
        await attachMutation.mutateAsync(result.id);
      } catch {
        toast({
          title: tCommon("error"),
          description: t("photoUploadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [attachMutation, toast, t, tCommon]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
      e.target.value = "";
    },
    [handleFileUpload]
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
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemove = useCallback(() => {
    if (primaryImage) {
      removeMutation.mutate(primaryImage.id);
    }
  }, [primaryImage, removeMutation]);

  if (isLoading) {
    return (
      <div className="bg-muted flex h-48 items-center justify-center rounded-xl">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  // If there's a photo, display it
  if (primaryImage) {
    return (
      <div
        className="group relative overflow-hidden rounded-xl"
        data-testid="location-photo"
      >
        <AuthenticatedImage
          imageId={primaryImage.id}
          alt={locationName}
          className="h-48 w-full object-cover"
        />
        {editable && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            data-testid="remove-location-photo"
          >
            {removeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // If no photo and not editable, show placeholder
  if (!editable) {
    return (
      <div className="bg-muted/50 flex h-48 items-center justify-center rounded-xl border">
        <div className="text-center">
          <MapPin className="text-muted-foreground/50 mx-auto h-10 w-10" />
          <p className="text-muted-foreground mt-2 text-sm">{t("noPhoto")}</p>
        </div>
      </div>
    );
  }

  // If no photo and editable, show upload area
  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50",
        (isUploading || attachMutation.isPending) &&
          "pointer-events-none opacity-50"
      )}
      data-testid="location-photo-upload"
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading || attachMutation.isPending}
      />
      <div className="text-center">
        {isUploading || attachMutation.isPending ? (
          <div className="flex flex-col items-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-2 text-sm">
              {t("uploadingPhoto")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ImagePlus className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground mt-2 text-sm">
              {isDragging ? t("dropPhotoHere") : t("addPhoto")}
            </p>
          </div>
        )}
      </div>
    </label>
  );
}
