"use client";

import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, DollarSign } from "lucide-react";
import { RevenueTimeSeriesResponse } from "@/lib/api/api";
import { formatDateShort } from "@/lib/utils";

interface RevenueChartProps {
  data: RevenueTimeSeriesResponse | undefined;
  isLoading: boolean;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const t = useTranslations("admin.charts");

  if (isLoading) {
    return (
      <div
        className="flex h-[250px] items-center justify-center"
        data-testid="revenue-chart"
      >
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data || data.data.every((d) => d.value === 0)) {
    return (
      <div
        className="flex h-[250px] flex-col items-center justify-center text-center"
        data-testid="revenue-chart"
      >
        <DollarSign className="text-muted-foreground/50 h-10 w-10" />
        <p className="text-muted-foreground mt-2 text-sm">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          data={data.data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDateShort(value)}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            cursor={{
              stroke: "hsl(var(--muted-foreground))",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            content={({ active, payload, label }) => {
              if (
                active &&
                payload &&
                payload.length &&
                typeof label === "string"
              ) {
                return (
                  <div className="bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-xs">
                    <span className="font-medium">
                      {formatDateShort(label)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatPrice(payload[0].value as number)}
                    </span>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
