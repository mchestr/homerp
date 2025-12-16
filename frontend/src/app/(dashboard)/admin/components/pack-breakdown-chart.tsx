"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, CreditCard } from "lucide-react";
import { PackBreakdownResponse } from "@/lib/api/api-client";

interface PackBreakdownChartProps {
  data: PackBreakdownResponse | undefined;
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(262 83% 58%)",
  "hsl(24 95% 53%)",
  "hsl(199 89% 48%)",
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PackBreakdownChart({
  data,
  isLoading,
}: PackBreakdownChartProps) {
  const t = useTranslations("admin.charts");

  if (isLoading) {
    return (
      <div
        className="flex h-[250px] items-center justify-center"
        data-testid="pack-breakdown-chart"
      >
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data || data.packs.length === 0) {
    return (
      <div
        className="flex h-[250px] flex-col items-center justify-center text-center"
        data-testid="pack-breakdown-chart"
      >
        <CreditCard className="text-muted-foreground/50 h-10 w-10" />
        <p className="text-muted-foreground mt-2 text-sm">{t("noData")}</p>
      </div>
    );
  }

  // Prepare data for horizontal bar chart
  const chartData = data.packs.map((pack) => ({
    name: pack.pack_name,
    revenue: pack.total_revenue_cents,
    count: pack.purchase_count,
    percentage: pack.percentage,
  }));

  return (
    <div data-testid="pack-breakdown-chart">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-muted"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            width={100}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover rounded-md border px-3 py-2 text-xs shadow-xs">
                    <p className="mb-1 font-medium">{item.name}</p>
                    <p>
                      {t("revenue")}: {formatPrice(item.revenue)}
                    </p>
                    <p>
                      {t("sales")}: {item.count}
                    </p>
                    <p className="text-muted-foreground">
                      {item.percentage.toFixed(1)}% {t("ofTotal")}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
