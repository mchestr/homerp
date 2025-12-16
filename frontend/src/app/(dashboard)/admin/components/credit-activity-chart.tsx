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
  Legend,
} from "recharts";
import { Loader2, Coins } from "lucide-react";
import { CreditActivityResponse } from "@/lib/api/api-client";
import { formatDateShort } from "@/lib/utils";

interface CreditActivityChartProps {
  data: CreditActivityResponse | undefined;
  isLoading: boolean;
}

export function CreditActivityChart({
  data,
  isLoading,
}: CreditActivityChartProps) {
  const t = useTranslations("admin.charts");

  if (isLoading) {
    return (
      <div className="flex h-[250px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data || data.data.every((d) => d.purchases === 0 && d.usage === 0)) {
    return (
      <div className="flex h-[250px] flex-col items-center justify-center text-center">
        <Coins className="text-muted-foreground/50 h-10 w-10" />
        <p className="text-muted-foreground mt-2 text-sm">{t("noData")}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data.data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
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
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          content={({ active, payload, label }) => {
            if (
              active &&
              payload &&
              payload.length &&
              typeof label === "string"
            ) {
              return (
                <div className="bg-popover rounded-md border px-3 py-2 text-xs shadow-xs">
                  <p className="mb-1 font-medium">{formatDateShort(label)}</p>
                  <p className="text-green-600 dark:text-green-400">
                    {t("purchases")}: {payload[0].value}
                  </p>
                  <p className="text-orange-600 dark:text-orange-400">
                    {t("usage")}: {payload[1].value}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          formatter={(value) =>
            value === "purchases" ? t("purchases") : t("usage")
          }
        />
        <Bar
          dataKey="purchases"
          fill="hsl(142 76% 36%)"
          radius={[4, 4, 0, 0]}
          name="purchases"
        />
        <Bar
          dataKey="usage"
          fill="hsl(24 95% 53%)"
          radius={[4, 4, 0, 0]}
          name="usage"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
