"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Coins, CreditCard, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "bg-background w-full max-w-md rounded-xl shadow-2xl",
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
            <p className="text-muted-foreground mt-2 text-sm">
              You don&apos;t have enough credits to use AI classification.
              Credit purchases help cover the costs of AI tokens and site
              maintenance for this hobbyist project.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-muted/30 flex justify-end gap-3 border-t px-6 py-4">
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
