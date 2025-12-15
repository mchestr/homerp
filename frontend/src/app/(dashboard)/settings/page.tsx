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
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-4 flex items-center gap-5">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || "User"}
              className="h-20 w-20 rounded-full ring-4 ring-muted"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted ring-4 ring-border">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-xl font-semibold">{user?.name || "User"}</p>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize your experience
        </p>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Currency</p>
                <p className="text-sm text-muted-foreground">
                  Display prices in your preferred currency
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
              <div className="rounded-lg bg-primary/10 p-2">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("settings.language")}</p>
                <p className="text-sm text-muted-foreground">
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

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize how the app looks
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">
              Choose light, dark, or system theme
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
        <div className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">AI System Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Configure your profile for personalized AI recommendations
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </Link>

      {/* Collaboration */}
      <Link
        href="/settings/collaboration"
        className="block"
        data-testid="collaboration-link"
      >
        <div className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Collaboration</h2>
                <p className="text-sm text-muted-foreground">
                  Share your inventory with family or team members
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </Link>

      {/* Billing & Credits */}
      <Link
        href="/settings/billing"
        className="block"
        data-testid="billing-link"
      >
        <div className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Billing & Credits</h2>
                <p className="text-sm text-muted-foreground">
                  {creditBalance
                    ? `${creditBalance.total_credits} credits available`
                    : "Manage your AI credits"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </Link>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-4 rounded-lg bg-muted/50 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Authentication</p>
              <p className="text-sm text-muted-foreground">
                Signed in via Google OAuth
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-lg bg-muted/50 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Member since</p>
              <p className="text-sm text-muted-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
