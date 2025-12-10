"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Coins, X, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InsufficientCreditsModal({
  isOpen,
  onClose,
}: InsufficientCreditsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const router = useRouter();

  // Handle escape key
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePurchase = () => {
    onClose();
    router.push("/settings/billing");
  };

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
          <div className="rounded-full bg-amber-500/10 p-2 text-amber-500">
            <Coins className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 id="modal-title" className="text-lg font-semibold">
              Insufficient Credits
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You don&apos;t have enough credits to use AI classification.
              Purchase more credits to continue.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePurchase}>
            <CreditCard className="mr-2 h-4 w-4" />
            Purchase Credits
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
export function useInsufficientCreditsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const show = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const InsufficientCreditsModalComponent = useCallback(
    () => <InsufficientCreditsModal isOpen={isOpen} onClose={close} />,
    [isOpen, close]
  );

  return {
    show,
    close,
    InsufficientCreditsModal: InsufficientCreditsModalComponent,
  };
}
