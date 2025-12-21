"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { aiApi, SessionResponse } from "@/lib/api/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmModal } from "@/components/ui/confirm-modal";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SessionSidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string | null) => void;
  onNewSession: () => void;
  className?: string;
}

export function SessionSidebar({
  currentSessionId,
  onSessionSelect,
  onNewSession,
  className,
}: SessionSidebarProps) {
  const t = useTranslations("aiAssistant");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { confirm, setIsLoading, ConfirmModal } = useConfirmModal();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn: () => aiApi.listSessions({ limit: 50, active_only: true }),
  });

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: (title?: string) =>
      aiApi.createSession(title ? { title } : undefined),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      onSessionSelect(newSession.id);
    },
    onError: () => {
      toast({
        title: t("sessionError"),
        description: t("sessionCreateFailed"),
        variant: "destructive",
      });
    },
  });

  // Update session mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      aiApi.updateSession(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      setEditingSessionId(null);
    },
    onError: () => {
      toast({
        title: t("sessionError"),
        description: t("sessionUpdateFailed"),
        variant: "destructive",
      });
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteSession(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      // If we deleted the current session, clear selection
      if (deletedId === currentSessionId) {
        onSessionSelect(null);
      }
    },
    onError: () => {
      toast({
        title: t("sessionError"),
        description: t("sessionDeleteFailed"),
        variant: "destructive",
      });
    },
  });

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleStartEdit = (session: SessionResponse) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveEdit = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateMutation.mutate({
        id: editingSessionId,
        title: editingTitle.trim(),
      });
    } else {
      setEditingSessionId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = async (session: SessionResponse) => {
    const confirmed = await confirm({
      title: t("deleteSessionTitle"),
      message: t("deleteSessionMessage", { title: session.title }),
      confirmLabel: t("deleteSession"),
      variant: "danger",
    });
    if (confirmed) {
      setIsLoading(true);
      try {
        await deleteMutation.mutateAsync(session.id);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleNewSession = () => {
    onNewSession();
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header with New Chat button */}
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="text-sm font-medium">{t("sessions")}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNewSession}
          disabled={createMutation.isPending}
          data-testid="new-session-button"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="sr-only">{t("newSession")}</span>
        </Button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : !sessions?.sessions.length ? (
          <div className="py-8 text-center">
            <MessageSquare className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t("noSessions")}</p>
            <Button
              variant="link"
              size="sm"
              onClick={handleNewSession}
              className="mt-2"
              data-testid="start-new-session-link"
            >
              {t("startNewSession")}
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-center rounded-lg transition-colors",
                  currentSessionId === session.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                {editingSessionId === session.id ? (
                  <div className="flex flex-1 items-center gap-1 p-2">
                    <Input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveEdit}
                      className="h-7 text-sm"
                      data-testid="edit-session-input"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      className="flex min-w-0 flex-1 flex-col items-start gap-0.5 p-2 text-left"
                      data-testid={`session-${session.id}`}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {session.title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="mr-1 h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                          data-testid={`session-menu-${session.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStartEdit(session)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("renameSession")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("deleteSession")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal />
    </div>
  );
}
