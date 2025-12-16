"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Coins,
  ChevronRight,
  Globe,
  DollarSign,
  Brain,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/client";

const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "CNY", label: "Chinese Yuan (¥)" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "MXN", label: "Mexican Peso ($)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
  { code: "KRW", label: "South Korean Won (₩)" },
];

export default function SettingsPage() {
  const { user, creditBalance, updateSettings } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const t = useTranslations();
  const currentLocale = useLocale();

  const handleCurrencyChange = async (currency: string) => {
    setIsUpdating(true);
    try {
      await updateSettings({ currency });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLanguageChange = async (language: string) => {
    setIsUpdating(true);
    try {
      // Update user settings in backend
      await updateSettings({ language });
      // Set the locale cookie for next-intl
      setLocaleCookie(language as Locale);
      // Reload to apply the new locale
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("settings.profile")}</h2>
        <div className="mt-4 flex items-center gap-5">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || "User"}
              className="ring-muted h-20 w-20 rounded-full ring-4"
            />
          ) : (
            <div className="bg-muted ring-border flex h-20 w-20 items-center justify-center rounded-full ring-4">
              <User className="text-muted-foreground h-10 w-10" />
            </div>
          )}
          <div>
            <p className="text-xl font-semibold">{user?.name || "User"}</p>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("settings.preferences")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.customizeExperience")}
        </p>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <DollarSign className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{t("settings.currency")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("settings.currencyDescription")}
                </p>
              </div>
            </div>
            <Select
              value={user?.currency || "USD"}
              onValueChange={handleCurrencyChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Globe className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{t("settings.language")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("settings.languageDescription")}
                </p>
              </div>
            </div>
            <Select
              value={currentLocale}
              onValueChange={handleLanguageChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settings.language")} />
              </SelectTrigger>
              <SelectContent>
                {locales.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {localeNames[locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("settings.appearance")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.appearanceDescription")}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{t("settings.theme")}</p>
            <p className="text-muted-foreground text-sm">
              {t("settings.themeDescription")}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* AI System Profile */}
      <Link
        href="/settings/profile"
        className="block"
        data-testid="system-profile-link"
      >
        <div className="bg-card hover:border-primary/50 rounded-xl border p-6 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Brain className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">
                  {t("settings.aiSystemProfile")}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t("settings.aiSystemProfileDescription")}
                </p>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          </div>
        </div>
      </Link>

      {/* Collaboration */}
      <Link
        href="/settings/collaboration"
        className="block"
        data-testid="collaboration-link"
      >
        <div className="bg-card hover:border-primary/50 rounded-xl border p-6 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Users className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">{t("settings.collaboration")}</h2>
                <p className="text-muted-foreground text-sm">
                  {t("settings.collaborationDescription")}
                </p>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          </div>
        </div>
      </Link>

      {/* Billing & Credits */}
      <Link
        href="/settings/billing"
        className="block"
        data-testid="billing-link"
      >
        <div className="bg-card hover:border-primary/50 rounded-xl border p-6 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Coins className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">
                  {t("settings.billingAndCredits")}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {creditBalance
                    ? t("settings.creditsAvailable", {
                        count: creditBalance.total_credits,
                      })
                    : t("settings.manageAiCredits")}
                </p>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          </div>
        </div>
      </Link>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("settings.account")}</h2>
        <div className="mt-4 space-y-4">
          <div className="bg-muted/50 flex items-start gap-4 rounded-lg p-4">
            <div className="bg-primary/10 rounded-lg p-2">
              <Shield className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{t("settings.authentication")}</p>
              <p className="text-muted-foreground text-sm">
                {t("settings.signedInViaGoogle")}
              </p>
            </div>
          </div>
          <div className="bg-muted/50 flex items-start gap-4 rounded-lg p-4">
            <div className="bg-primary/10 rounded-lg p-2">
              <Calendar className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{t("settings.memberSince")}</p>
              <p className="text-muted-foreground text-sm">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString(
                      currentLocale,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
