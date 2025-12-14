"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { authApi, OAuthProvider } from "@/lib/api/api-client";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [redirectingProvider, setRedirectingProvider] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  // Load available OAuth providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersData = await authApi.getProviders();
        setProviders(providersData);
      } catch (err) {
        console.error("Failed to load OAuth providers:", err);
        setError("Failed to load login providers. Please try again later.");
        setProviders([]);
      } finally {
        setLoadingProviders(false);
      }
    };
    loadProviders();
  }, []);

  const handleProviderLogin = async (providerId: string) => {
    try {
      setRedirectingProvider(providerId);
      setError(null);

      // Store redirect URL for post-login
      const redirectPath = searchParams.get("redirect");
      if (redirectPath) {
        sessionStorage.setItem("post_login_redirect", redirectPath);
      }

      const redirectUri = `${window.location.origin}/callback/${providerId}`;
      const { authorization_url } = await authApi.getAuthUrl(
        providerId,
        redirectUri
      );

      window.location.href = authorization_url;
    } catch (err) {
      setError("Failed to initiate login. Please try again.");
      setRedirectingProvider(null);
      console.error("Login error:", err);
    }
  };

  if (authLoading || loadingProviders) {
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

              {providers.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No login providers configured. Please contact your
                  administrator.
                </div>
              ) : (
                providers.map((provider) => (
                  <Button
                    key={provider.id}
                    onClick={() => handleProviderLogin(provider.id)}
                    disabled={redirectingProvider !== null}
                    className="h-12 w-full gap-3 text-base"
                    variant="outline"
                    data-testid={`login-button-${provider.id}`}
                  >
                    {redirectingProvider === provider.id ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <ProviderIcon
                          provider={provider.icon}
                          className="h-5 w-5"
                        />
                        Continue with {provider.name}
                      </>
                    )}
                  </Button>
                ))
              )}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </div>

          {providers.length > 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => handleProviderLogin(providers[0].id)}
                className="font-medium text-primary hover:underline"
              >
                Sign up for free
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  switch (provider) {
    case "google":
      return <GoogleIcon className={className} />;
    case "github":
      return <GitHubIcon className={className} />;
    default:
      return null;
  }
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
