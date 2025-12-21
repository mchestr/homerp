"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import ReactMarkdown, { Components } from "react-markdown";
import Link from "next/link";
import {
  aiApi,
  SessionMessageResponse,
  SessionQueryResponse,
} from "@/lib/api/api";
import {
  Bot,
  Send,
  Loader2,
  User,
  AlertCircle,
  Sparkles,
  Wrench,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInsufficientCreditsModal } from "@/components/billing/insufficient-credits-modal";
import { useOperationCosts } from "@/hooks/use-operation-costs";
import { SessionSidebar } from "@/components/ai/session-sidebar";
import { cn, isInsufficientCreditsError } from "@/lib/utils";

// Valid internal link patterns for security
const VALID_LINK_PATTERNS = [
  /^\/items\/[a-f0-9-]{36}$/,
  /^\/categories\/[a-f0-9-]{36}$/,
  /^\/locations\/[a-f0-9-]{36}$/,
];

// Custom link component for ReactMarkdown to handle internal navigation
const MarkdownLink = ({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) => {
  // Check if the link is internal (starts with /)
  if (href && href.startsWith("/")) {
    // Validate that href matches expected patterns to prevent injection
    const isValidInternalLink = VALID_LINK_PATTERNS.some((pattern) =>
      pattern.test(href)
    );

    if (!isValidInternalLink) {
      // Render invalid links as plain text for security
      return <span className="text-muted-foreground">{children}</span>;
    }

    return (
      <Link
        href={href}
        className="font-medium text-blue-600 underline decoration-blue-600/50 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/50 dark:hover:decoration-blue-400"
      >
        {children}
      </Link>
    );
  }
  // External links open in new tab
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline decoration-blue-600/50 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/50 dark:hover:decoration-blue-400"
    >
      {children}
    </a>
  );
};

const markdownComponents: Components = {
  a: MarkdownLink,
};

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  creditsUsed?: number;
}

// Convert backend session messages to frontend Message format
function convertSessionMessages(messages: SessionMessageResponse[]): Message[] {
  return messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content || "",
      timestamp: new Date(msg.created_at),
      toolsUsed: msg.tool_calls
        ? msg.tool_calls.map(
            (tc: { function?: { name?: string } }) =>
              tc.function?.name || "unknown"
          )
        : undefined,
    }));
}

export default function AIAssistantPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { show: showCreditsModal, InsufficientCreditsModal } =
    useInsufficientCreditsModal();
  const { getCost, isLoading: isCostsLoading } = useOperationCosts();
  const assistantQueryCost = getCost("assistant_query");

  // Fetch session details when a session is selected
  const { data: sessionDetails, isLoading: isLoadingSession } = useQuery({
    queryKey: ["ai-session", currentSessionId],
    queryFn: () =>
      currentSessionId ? aiApi.getSession(currentSessionId) : null,
    enabled: !!currentSessionId,
  });

  // Update messages when session is loaded
  useEffect(() => {
    if (sessionDetails?.messages) {
      setMessages(convertSessionMessages(sessionDetails.messages));
    }
  }, [sessionDetails]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat mutation using the new tool-enabled endpoint
  const chatMutation = useMutation({
    mutationFn: (data: { prompt: string; session_id?: string }) =>
      aiApi.chat(data),
    onSuccess: (response: SessionQueryResponse) => {
      // Update current session ID if a new session was created
      if (response.session_id && response.session_id !== currentSessionId) {
        setCurrentSessionId(response.session_id);
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      }

      // Add the new messages from the response
      if (response.new_messages) {
        const newMessages = convertSessionMessages(response.new_messages);
        // Filter out any tool messages and only keep user/assistant
        const displayMessages = newMessages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        );

        // Find the assistant message and add tool usage info
        const assistantMsg = displayMessages.find(
          (m) => m.role === "assistant"
        );
        if (assistantMsg && response.tools_used?.length) {
          assistantMsg.toolsUsed = response.tools_used;
        }
        if (assistantMsg && response.credits_used) {
          assistantMsg.creditsUsed = response.credits_used;
        }

        // Only add the assistant message (user message already added optimistically)
        const assistantMessages = displayMessages.filter(
          (m) => m.role === "assistant"
        );
        setMessages((prev) => [...prev, ...assistantMessages]);
      }

      // Invalidate session cache to update the sidebar
      queryClient.invalidateQueries({
        queryKey: ["ai-session", response.session_id],
      });
    },
    onError: (error: unknown) => {
      if (isInsufficientCreditsError(error)) {
        showCreditsModal();
        // Remove the pending message
        setMessages((prev) => prev.slice(0, -1));
      } else {
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${t("aiAssistant.errorPrefix")} ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");

    chatMutation.mutate({
      prompt: prompt.trim(),
      session_id: currentSessionId || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSessionSelect = (sessionId: string | null) => {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    if (!sessionId) {
      // New chat - clear messages
      setMessages([]);
    }
    // Close sidebar on mobile when a session is selected
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    // Close sidebar on mobile when starting new chat
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const exampleQueries = [
    t("aiAssistant.examples.plantingSchedule"),
    t("aiAssistant.examples.craftProjects"),
    t("aiAssistant.examples.organizationTips"),
    t("aiAssistant.examples.shoppingList"),
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Session Sidebar */}
      <div
        className={cn(
          "bg-card border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <SessionSidebar
          currentSessionId={currentSessionId}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          className="h-full"
        />
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0"
              data-testid="toggle-sidebar-button"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Bot className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">
                {sessionDetails?.title || t("aiAssistant.title")}
              </h1>
              <p className="text-muted-foreground truncate text-sm">
                {t("aiAssistant.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-card flex min-h-0 flex-1 flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingSession ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-full">
                  <Sparkles className="text-primary h-8 w-8" />
                </div>
                <h2 className="mb-2 text-lg font-semibold">
                  {t("aiAssistant.emptyStateTitle")}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md text-sm">
                  {t("aiAssistant.emptyStateDescription")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {exampleQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(query)}
                      data-testid={`example-query-${index}`}
                      className="bg-muted/50 hover:bg-muted rounded-lg border px-4 py-2 text-left text-sm transition-colors"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <Bot className="text-primary h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown components={markdownComponents}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                      {message.role === "assistant" &&
                        message.toolsUsed &&
                        message.toolsUsed.length > 0 && (
                          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
                            <Wrench className="h-3 w-3" />
                            {t("aiAssistant.toolsUsed")}:{" "}
                            {message.toolsUsed.map((tool, i) => (
                              <span
                                key={i}
                                className="bg-background/50 rounded px-1.5 py-0.5"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                    {message.role === "user" && (
                      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <Bot className="text-primary h-4 w-4" />
                    </div>
                    <div className="bg-muted flex items-center gap-2 rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">
                        {t("aiAssistant.thinking")}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="shrink-0 border-t p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("aiAssistant.placeholder")}
                  className="min-h-[60px] resize-none"
                  rows={2}
                  maxLength={2000}
                  data-testid="assistant-input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!prompt.trim() || chatMutation.isPending}
                  className="h-auto self-end px-4 py-3"
                  data-testid="send-button"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{prompt.length}/2000</span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {isCostsLoading
                    ? "..."
                    : t("aiAssistant.creditCost", {
                        cost: assistantQueryCost ?? 1,
                      })}
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>

      <InsufficientCreditsModal />
    </div>
  );
}
