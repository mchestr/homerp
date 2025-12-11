"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/api/api-client";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGoogleLogin = async () => {
    try {
      setIsRedirecting(true);
      setError(null);

      const redirectUri = `${window.location.origin}/callback/google`;
      const { authorization_url } = await authApi.getGoogleAuthUrl(redirectUri);

      window.location.href = authorization_url;
    } catch (err) {
      setError("Failed to initiate login. Please try again.");
      setIsRedirecting(false);
      console.error("Login error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">HomERP</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border bg-card p-8 shadow-lg">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-muted-foreground">
                Sign in to manage your inventory
              </p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                onClick={handleGoogleLogin}
                disabled={isRedirecting}
                className="h-12 w-full gap-3 text-base"
                variant="outline"
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <GoogleIcon className="h-5 w-5" />
                    Continue with Google
                  </>
                )}
              </Button>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              onClick={handleGoogleLogin}
              className="font-medium text-primary hover:underline"
            >
              Sign up for free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
