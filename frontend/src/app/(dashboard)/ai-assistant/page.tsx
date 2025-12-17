"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { aiApi, AssistantQueryRequest } from "@/lib/api/api-client";
import {
  Bot,
  Send,
  Loader2,
  User,
  AlertCircle,
  Sparkles,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useInsufficientCreditsModal } from "@/components/billing/insufficient-credits-modal";
import { useOperationCosts } from "@/hooks/use-operation-costs";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  itemsInContext?: number;
  creditsUsed?: number;
}

export default function AIAssistantPage() {
  const t = useTranslations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { show: showCreditsModal, InsufficientCreditsModal } =
    useInsufficientCreditsModal();
  const { getCost } = useOperationCosts();
  const assistantQueryCost = getCost("assistant_query");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const queryMutation = useMutation({
    mutationFn: (data: AssistantQueryRequest) => aiApi.query(data),
    onSuccess: (response) => {
      if (response.success && response.response) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
          itemsInContext: response.items_in_context,
          creditsUsed: response.credits_used,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (response.error) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${t("aiAssistant.errorPrefix")} ${response.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 402) {
        showCreditsModal();
        // Remove the pending message
        setMessages((prev) => prev.slice(0, -1));
      } else {
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${t("aiAssistant.errorPrefix")} ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || queryMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");

    queryMutation.mutate({
      prompt: prompt.trim(),
      include_inventory_context: includeContext,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const exampleQueries = [
    t("aiAssistant.examples.plantingSchedule"),
    t("aiAssistant.examples.craftProjects"),
    t("aiAssistant.examples.organizationTips"),
    t("aiAssistant.examples.shoppingList"),
  ];

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Bot className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("aiAssistant.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("aiAssistant.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-card flex min-h-0 flex-1 flex-col rounded-xl border">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
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
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                    {message.role === "assistant" &&
                      message.itemsInContext !== undefined &&
                      message.itemsInContext > 0 && (
                        <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                          <Database className="h-3 w-3" />
                          {t("aiAssistant.itemsUsed", {
                            count: message.itemsInContext,
                          })}
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
              {queryMutation.isPending && (
                <div className="flex gap-3">
                  <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Bot className="text-primary h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
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
            <div className="flex items-center gap-2">
              <Switch
                id="include-context"
                checked={includeContext}
                onCheckedChange={setIncludeContext}
                data-testid="include-context-switch"
              />
              <Label
                htmlFor="include-context"
                className="flex cursor-pointer items-center gap-1 text-sm"
              >
                <Database className="h-3.5 w-3.5" />
                {t("aiAssistant.includeInventory")}
              </Label>
            </div>
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
                disabled={!prompt.trim() || queryMutation.isPending}
                className="h-auto self-end px-4 py-3"
                data-testid="send-button"
              >
                {queryMutation.isPending ? (
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
                {t("aiAssistant.creditCost", { cost: assistantQueryCost })}
              </span>
            </div>
          </form>
        </div>
      </div>

      <InsufficientCreditsModal />
    </div>
  );
}
