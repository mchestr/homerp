"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminApi,
  AIUsageLog,
  AIUsageByUser,
  DailyUsage,
} from "@/lib/api/api-client";
import { formatDateTime } from "@/lib/utils";
import {
  Activity,
  Loader2,
  Coins,
  DollarSign,
  Cpu,
  BarChart3,
  History,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Configuration constants
const HISTORY_PAGE_SIZE = 20;
const DAILY_USAGE_DAYS = 30;

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  testId,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="bg-card rounded-xl border p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <Icon className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="text-xl font-bold sm:text-2xl">{value}</p>
          </div>
        </div>
      </div>
      {description && (
        <p className="text-muted-foreground mt-2 text-xs">{description}</p>
      )}
    </div>
  );
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function getOperationLabel(
  operationType: string,
  t: (key: string) => string
): string {
  const labels: Record<string, string> = {
    image_classification: t("admin.aiUsage.imageClassification"),
    location_analysis: t("admin.aiUsage.locationAnalysis"),
    assistant_query: t("admin.aiUsage.assistantQuery"),
    location_suggestion: t("admin.aiUsage.locationSuggestion"),
  };
  return labels[operationType] || operationType;
}

export default function AIUsagePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin-ai-usage-summary"],
    queryFn: () => adminApi.getAIUsageSummary(),
    enabled: !!user?.is_admin,
  });

  const { data: dailyUsage, isLoading: dailyLoading } = useQuery({
    queryKey: ["admin-ai-usage-daily"],
    queryFn: () => adminApi.getAIUsageDaily(DAILY_USAGE_DAYS),
    enabled: !!user?.is_admin,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-ai-usage-history", historyPage, operationFilter],
    queryFn: () =>
      adminApi.getAIUsageHistory(
        historyPage,
        HISTORY_PAGE_SIZE,
        operationFilter === "all" ? undefined : operationFilter
      ),
    enabled: !!user?.is_admin,
  });

  const { data: byUserData, isLoading: byUserLoading } = useQuery({
    queryKey: ["admin-ai-usage-by-user"],
    queryFn: () => adminApi.getAIUsageByUser(),
    enabled: !!user?.is_admin,
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Prepare chart data - reverse to show oldest to newest
  const chartData =
    dailyUsage
      ?.slice()
      .reverse()
      .map((day: DailyUsage) => ({
        date: day.date,
        tokens: day.total_tokens,
        calls: day.total_calls,
        cost: day.total_cost_usd,
      })) ?? [];

  const totalPages = historyData
    ? Math.ceil(historyData.total / HISTORY_PAGE_SIZE)
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("admin.aiUsage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.aiUsage.description")}
          </p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div
            className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
            data-testid="ai-usage-metrics-grid"
          >
            <StatCard
              title={t("admin.aiUsage.totalCalls")}
              value={summary.total_calls.toLocaleString()}
              icon={Activity}
              testId="stat-total-calls"
            />
            <StatCard
              title={t("admin.aiUsage.totalTokens")}
              value={formatTokens(summary.total_tokens)}
              icon={Cpu}
              description={`${formatTokens(summary.total_prompt_tokens)} prompt + ${formatTokens(summary.total_completion_tokens)} completion`}
              testId="stat-total-tokens"
            />
            <StatCard
              title={t("admin.aiUsage.totalCost")}
              value={formatCost(summary.total_cost_usd)}
              icon={DollarSign}
              testId="stat-total-cost"
            />
            <StatCard
              title={t("admin.aiUsage.tokensPerCredit")}
              value={
                summary.total_calls > 0
                  ? Math.round(
                      summary.total_tokens / summary.total_calls
                    ).toLocaleString()
                  : "0"
              }
              icon={Coins}
              description={t("admin.aiUsage.avgTokensPerCall")}
              testId="stat-tokens-per-credit"
            />
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-card rounded-xl border p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {t("admin.aiUsage.daily")} - {t("admin.aiUsage.last30Days")}
            </h2>
            {dailyLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="tokenGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatTokens(value)}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover rounded-lg border p-3 shadow-lg">
                              <p className="font-medium">{data.date}</p>
                              <p className="text-muted-foreground text-sm">
                                {t("admin.aiUsage.tokens")}:{" "}
                                {data.tokens.toLocaleString()}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {t("admin.aiUsage.calls")}: {data.calls}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {t("admin.aiUsage.cost")}:{" "}
                                {formatCost(data.cost)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="hsl(var(--primary))"
                      fill="url(#tokenGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-muted-foreground">
                  {t("admin.aiUsage.noData")}
                </p>
              </div>
            )}
          </div>

          {/* Breakdown Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Operation */}
            <div className="bg-card rounded-xl border p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="text-primary h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  {t("admin.aiUsage.byOperation")}
                </h2>
              </div>
              {summary.by_operation.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.aiUsage.operationType")}</TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.calls")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.tokens")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.cost")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.by_operation.map((op) => (
                      <TableRow key={op.operation_type}>
                        <TableCell>
                          <Badge variant="outline">
                            {getOperationLabel(op.operation_type, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {op.total_calls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(op.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCost(op.total_cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {t("admin.aiUsage.noData")}
                </p>
              )}
            </div>

            {/* By Model */}
            <div className="bg-card rounded-xl border p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Cpu className="text-primary h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  {t("admin.aiUsage.byModel")}
                </h2>
              </div>
              {summary.by_model.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.aiUsage.model")}</TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.calls")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.tokens")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.cost")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.by_model.map((model) => (
                      <TableRow key={model.model}>
                        <TableCell>
                          <Badge variant="secondary">{model.model}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {model.total_calls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(model.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCost(model.total_cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {t("admin.aiUsage.noData")}
                </p>
              )}
            </div>
          </div>

          {/* By User */}
          <div className="bg-card rounded-xl border p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="text-primary h-5 w-5" />
              <h2 className="text-lg font-semibold">
                {t("admin.aiUsage.byUser")}
              </h2>
            </div>
            {byUserLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : byUserData && byUserData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.aiUsage.user")}</TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.calls")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.tokens")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.aiUsage.cost")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byUserData.map((userUsage: AIUsageByUser) => (
                      <TableRow key={userUsage.user_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {userUsage.user_name || userUsage.user_email}
                            </span>
                            {userUsage.user_name && (
                              <span className="text-muted-foreground text-xs">
                                {userUsage.user_email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {userUsage.total_calls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(userUsage.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCost(userUsage.total_cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                {t("admin.aiUsage.noData")}
              </p>
            )}
          </div>

          {/* History Log */}
          <div className="bg-card rounded-xl border p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <History className="text-primary h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  {t("admin.aiUsage.history")}
                </h2>
              </div>
              <Select
                value={operationFilter}
                onValueChange={setOperationFilter}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("admin.aiUsage.allOperations")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.aiUsage.allOperations")}
                  </SelectItem>
                  <SelectItem value="image_classification">
                    {t("admin.aiUsage.imageClassification")}
                  </SelectItem>
                  <SelectItem value="location_analysis">
                    {t("admin.aiUsage.locationAnalysis")}
                  </SelectItem>
                  <SelectItem value="assistant_query">
                    {t("admin.aiUsage.assistantQuery")}
                  </SelectItem>
                  <SelectItem value="location_suggestion">
                    {t("admin.aiUsage.locationSuggestion")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {historyLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : historyData && historyData.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.aiUsage.date")}</TableHead>
                        <TableHead>{t("admin.aiUsage.user")}</TableHead>
                        <TableHead>
                          {t("admin.aiUsage.operationType")}
                        </TableHead>
                        <TableHead>{t("admin.aiUsage.model")}</TableHead>
                        <TableHead className="text-right">
                          {t("admin.aiUsage.prompt")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("admin.aiUsage.completion")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("admin.aiUsage.tokens")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("admin.aiUsage.cost")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.items.map((log: AIUsageLog) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-sm"
                              title={log.user_email || undefined}
                            >
                              {log.user_name || log.user_email || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="whitespace-nowrap"
                            >
                              {getOperationLabel(log.operation_type, t)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.model}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {log.prompt_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.completion_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {log.total_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCost(log.estimated_cost_usd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      Page {historyPage} of {totalPages} ({historyData.total}{" "}
                      total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setHistoryPage((p) => Math.max(1, p - 1))
                        }
                        disabled={historyPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setHistoryPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={historyPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <History className="text-muted-foreground mb-2 h-8 w-8" />
                <p className="text-muted-foreground">
                  {t("admin.aiUsage.noData")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("admin.aiUsage.noDataDescription")}
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
