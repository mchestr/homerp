"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
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
  }, [isOpen, isLoading, onClose]);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const iconColors = {
    danger: "text-red-500 bg-red-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    default: "text-primary bg-primary/10",
  };

  const confirmButtonVariant = variant === "danger" ? "destructive" : "default";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "w-full max-w-md rounded-xl bg-background shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        <div className="flex items-start gap-4 p-6">
          <div className={cn("rounded-full p-2", iconColors[variant])}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmButtonVariant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
import { useState, useCallback } from "react";

interface UseConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

export function useConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<UseConfirmModalOptions>({
    title: "",
    message: "",
  });
  const [resolveRef, setResolveRef] = useState<
    ((value: boolean) => void) | null
  >(null);

  const confirm = useCallback(
    (opts: UseConfirmModalOptions): Promise<boolean> => {
      setOptions(opts);
      setIsOpen(true);
      return new Promise((resolve) => {
        setResolveRef(() => resolve);
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    if (!isLoading) {
      setIsOpen(false);
      resolveRef?.(false);
    }
  }, [isLoading, resolveRef]);

  const handleConfirm = useCallback(() => {
    resolveRef?.(true);
    setIsOpen(false);
  }, [resolveRef]);

  const ConfirmModalComponent = useCallback(
    () => (
      <ConfirmModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        variant={options.variant}
        isLoading={isLoading}
      />
    ),
    [isOpen, handleClose, handleConfirm, options, isLoading]
  );

  return {
    confirm,
    setIsLoading,
    ConfirmModal: ConfirmModalComponent,
  };
}
