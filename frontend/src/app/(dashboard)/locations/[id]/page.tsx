"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  Edit,
  QrCode,
  Plus,
  ArrowLeft,
  MapPin,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemsPanel } from "@/components/items/items-panel";
import { useQRCodeModal } from "@/components/locations/qr-code-modal";
import { useLabelPrintModal } from "@/components/labels";
import { LocationPhoto } from "@/components/locations/location-photo";
import { locationsApi } from "@/lib/api/api";
import type { LabelData } from "@/lib/labels";

const LOCATION_TYPE_ICONS: Record<string, string> = {
  room: "🏠",
  shelf: "📚",
  bin: "🗑️",
  drawer: "🗄️",
  box: "📦",
  cabinet: "🚪",
};

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("locations");
  const tCommon = useTranslations("common");
  const locationId = params.id as string;
  const { openQRModal, QRCodeModal } = useQRCodeModal();
  const { openLabelModal, LabelPrintModal } = useLabelPrintModal();
  const tLabels = useTranslations("labels");

  const {
    data: locationData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["locations", locationId, "with-ancestors"],
    queryFn: () => locationsApi.getWithAncestors(locationId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !locationData) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MapPin className="text-muted-foreground h-12 w-12" />
        <h2 className="mt-4 text-lg font-semibold">{t("notFound")}</h2>
        <p className="text-muted-foreground mt-1">{t("notFoundDescription")}</p>
        <Button className="mt-4" onClick={() => router.push("/locations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToLocations")}
        </Button>
      </div>
    );
  }

  const location = locationData;
  const typeIcon = location.location_type
    ? LOCATION_TYPE_ICONS[location.location_type] || "📍"
    : "📍";

  const handlePrintLabel = () => {
    const labelData: LabelData = {
      type: "location",
      id: location.id,
      name: location.name,
      description: location.description ?? undefined,
      qrUrl: `${window.location.origin}/locations/${location.id}`,
    };
    openLabelModal(labelData);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="text-muted-foreground flex items-center gap-1 text-sm">
        <Link href="/locations" className="hover:text-foreground">
          {t("title")}
        </Link>
        {(location.ancestors ?? []).map((ancestor) => (
          <div key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/locations/${ancestor.id}`}
              className="hover:text-foreground"
            >
              {ancestor.name}
            </Link>
          </div>
        ))}
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{location.name}</span>
      </nav>

      {/* Location Photo */}
      <div className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">{t("locationPhoto")}</h2>
        <LocationPhoto
          locationId={location.id}
          locationName={location.name}
          editable
        />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-3xl dark:bg-violet-400/10">
            {typeIcon}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {location.name}
            </h1>
            {location.description && (
              <p className="text-muted-foreground mt-1">
                {location.description}
              </p>
            )}
            {location.location_type && (
              <span className="bg-muted mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize">
                {location.location_type}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrintLabel}
            data-testid="print-label-button"
          >
            <Printer className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{tLabels("printLabel")}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => openQRModal(location)}
            data-testid="generate-qr-button"
          >
            <QrCode className="mr-2 h-4 w-4" />
            {t("qrCode")}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/locations?edit=${location.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              {tCommon("edit")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/items/new?location_id=${location.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addItem")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Items in Location */}
      <div className="bg-card rounded-xl border p-4">
        <ItemsPanel
          locationId={location.id}
          title={t("itemsInLocation")}
          emptyMessage={t("noItemsInLocation")}
        />
      </div>

      <QRCodeModal />
      <LabelPrintModal />
    </div>
  );
}
