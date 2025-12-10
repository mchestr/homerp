"use client";

import { useAuth } from "@/context/auth-context";
import { User, Mail, Calendar, Shield, Coins, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";

export default function SettingsPage() {
  const { user, creditBalance } = useAuth();

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

      {/* Billing & Credits */}
      <Link href="/settings/billing" className="block">
        <div className="rounded-xl border bg-card p-6 hover:border-primary/50 transition-colors">
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
