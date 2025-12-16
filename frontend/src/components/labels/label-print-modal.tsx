"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Download, Printer, X, Tag, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type LabelData,
  type LabelPrintOptions,
  type LabelSize,
  LABEL_SIZES,
  DEFAULT_LABEL_OPTIONS,
  generateLabelPreview,
  downloadLabelsPDF,
  printLabels,
} from "@/lib/labels";

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LabelData[];
}

export function LabelPrintModal({
  isOpen,
  onClose,
  items,
}: LabelPrintModalProps) {
  const t = useTranslations("labels");
  const [selectedSize, setSelectedSize] = useState<LabelSize>(LABEL_SIZES[0]);
  const [options, setOptions] = useState<LabelPrintOptions>(
    DEFAULT_LABEL_OPTIONS
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Update options when label size changes
  useEffect(() => {
    setOptions((prev) => ({ ...prev, labelSize: selectedSize }));
  }, [selectedSize]);

  // Generate preview when options or items change
  useEffect(() => {
    if (isOpen && items.length > 0) {
      let cancelled = false;
      setIsGenerating(true);
      setPreviewError(null);

      generateLabelPreview(items, options)
        .then((url) => {
          if (!cancelled) {
            setPreviewUrl(url);
            setIsGenerating(false);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error("Preview generation failed:", error);
            setPreviewError(t("previewError"));
            setIsGenerating(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, items, options, t]);

  // Handle escape key and focus management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    const filename =
      items.length === 1
        ? `${items[0].name.replace(/\s+/g, "-").toLowerCase()}-label.pdf`
        : `labels-${items.length}.pdf`;
    await downloadLabelsPDF(items, options, filename);
  };

  const handlePrint = async () => {
    setPrintError(null);
    const success = await printLabels(items, options);
    if (!success) {
      setPrintError(t("popupBlocked"));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toggleOption = (key: keyof LabelPrintOptions) => {
    if (key !== "labelSize") {
      setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Group label sizes by brand
  const groupedSizes = LABEL_SIZES.reduce(
    (acc, size) => {
      if (!acc[size.brand]) {
        acc[size.brand] = [];
      }
      acc[size.brand].push(size);
      return acc;
    },
    {} as Record<string, LabelSize[]>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
      data-testid="label-print-modal"
    >
      <div
        ref={modalRef}
        className="animate-in fade-in-0 zoom-in-95 bg-background flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Tag className="text-primary h-5 w-5" />
            <h2 id="label-modal-title" className="text-lg font-semibold">
              {items.length === 1 ? t("printLabel") : t("printLabels")}
            </h2>
            {items.length > 1 && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {t("selectedCount", { count: items.length })}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
            data-testid="label-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Preview */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">
              {t("preview")}
            </label>
            <div className="flex min-h-[150px] items-center justify-center rounded-lg border bg-white p-4">
              {isGenerating ? (
                <div className="text-muted-foreground text-sm">
                  {t("generating")}
                </div>
              ) : previewError ? (
                <div className="text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">{previewError}</span>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="h-[150px] w-full border-0"
                  title={t("preview")}
                  data-testid="label-preview"
                />
              ) : (
                <div className="text-muted-foreground text-sm">
                  {t("noPreview")}
                </div>
              )}
            </div>
          </div>

          {/* Label Size */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">
              {t("labelSize")}
            </label>
            <div className="space-y-3">
              {Object.entries(groupedSizes).map(([brand, sizes]) => (
                <div key={brand}>
                  <div className="text-muted-foreground mb-1.5 text-xs font-medium">
                    {brand}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          selectedSize.id === size.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                        data-testid={`label-size-${size.id}`}
                      >
                        <div className="font-medium">{size.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {size.width}×{size.height}mm
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Label Options */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("contents")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleOption("showQrCode")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  options.showQrCode
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                data-testid="toggle-qr-code"
              >
                {t("qrCode")}
              </button>
              <button
                type="button"
                onClick={() => toggleOption("showLocation")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  options.showLocation
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                data-testid="toggle-location"
              >
                {t("location")}
              </button>
              <button
                type="button"
                onClick={() => toggleOption("showCategory")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  options.showCategory
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                data-testid="toggle-category"
              >
                {t("category")}
              </button>
              <button
                type="button"
                onClick={() => toggleOption("showDescription")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  options.showDescription
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                data-testid="toggle-description"
              >
                {t("description")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border-t px-6 py-4">
          {printError && (
            <div className="border-destructive/50 bg-destructive/10 text-destructive mb-3 flex items-center gap-2 rounded-lg border p-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{printError}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownload}
              disabled={isGenerating}
              data-testid="label-download"
            >
              <Download className="mr-2 h-4 w-4" />
              {t("download")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePrint}
              disabled={isGenerating}
              data-testid="label-print"
            >
              <Printer className="mr-2 h-4 w-4" />
              {t("print")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
export function useLabelPrintModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<LabelData[]>([]);

  const openLabelModal = useCallback((data: LabelData | LabelData[]) => {
    setItems(Array.isArray(data) ? data : [data]);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setItems([]);
  }, []);

  const LabelPrintModalComponent = useCallback(
    () =>
      items.length > 0 ? (
        <LabelPrintModal isOpen={isOpen} onClose={closeModal} items={items} />
      ) : null,
    [isOpen, closeModal, items]
  );

  return {
    openLabelModal,
    LabelPrintModal: LabelPrintModalComponent,
  };
}
