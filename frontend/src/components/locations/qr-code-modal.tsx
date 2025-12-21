"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Download, Printer, X, QrCode, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { locationsApi, Location } from "@/lib/api/api";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
}

const SIZE_OPTIONS = [
  { value: 5, labelKey: "sizeSmall" as const, pixels: "~165px" },
  { value: 10, labelKey: "sizeMedium" as const, pixels: "~330px" },
  { value: 20, labelKey: "sizeLarge" as const, pixels: "~660px" },
];

export function QRCodeModal({ isOpen, onClose, location }: QRCodeModalProps) {
  const t = useTranslations("locations");
  const tCommon = useTranslations("common");
  const [size, setSize] = useState(10);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Fetch signed URL when modal opens or size changes
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    locationsApi
      .getQrSignedUrl(location.id, size)
      .then((response) => {
        if (!cancelled) {
          setQrUrl(response.url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load QR code");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, location.id, size]);

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

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `${location.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.click();
  };

  const handlePrint = () => {
    if (!qrUrl) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code - ${location.name}</title>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, sans-serif; }
              h1 { font-size: 24px; margin-bottom: 16px; }
              img { max-width: 80vw; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <h1>${location.name}</h1>
            <img src="${qrUrl}" alt="QR Code for ${location.name}" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex touch-none items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4 backdrop-blur-xs"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div
        ref={modalRef}
        className="animate-in fade-in-0 zoom-in-95 bg-background w-full max-w-md rounded-xl shadow-2xl duration-200"
      >
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <QrCode className="text-primary h-5 w-5" />
            <h2 id="qr-modal-title" className="text-lg font-semibold">
              {tCommon("qrCode")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 text-center">
            <p className="font-medium">{location.name}</p>
            <p className="text-muted-foreground text-sm">{t("scanToView")}</p>
          </div>

          <div className="mb-4 flex min-h-[200px] items-center justify-center rounded-lg border bg-white p-4">
            {isLoading ? (
              <Loader2
                className="text-muted-foreground h-8 w-8 animate-spin"
                data-testid="qr-loading"
              />
            ) : error ? (
              <p className="text-destructive" data-testid="qr-error">
                {error}
              </p>
            ) : qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR code for ${location.name}`}
                className="max-w-full"
                data-testid="qr-code-image"
              />
            ) : null}
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">
              {t("size")}
            </label>
            <div className="flex gap-2">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSize(option.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    size === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{t(option.labelKey)}</div>
                  <div className="text-muted-foreground text-xs">
                    {option.pixels}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 flex gap-3 border-t px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={!qrUrl || isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            {tCommon("download")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrint}
            disabled={!qrUrl || isLoading}
          >
            <Printer className="mr-2 h-4 w-4" />
            {tCommon("print")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
export function useQRCodeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);

  const openQRModal = useCallback((loc: Location) => {
    setLocation(loc);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setLocation(null);
  }, []);

  const QRCodeModalComponent = useCallback(
    () =>
      location ? (
        <QRCodeModal isOpen={isOpen} onClose={closeModal} location={location} />
      ) : null,
    [isOpen, closeModal, location]
  );

  return {
    openQRModal,
    QRCodeModal: QRCodeModalComponent,
  };
}
