"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/api/api-client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const provider = params.provider as string;

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");

      if (!code) {
        setError("No authorization code received");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/callback/${provider}`;
        const response = await authApi.handleCallback(
          provider,
          code,
          redirectUri
        );

        login(response.token.access_token, response.user);

        // Check for stored redirect URL (from QR scan or protected route access)
        const redirectPath = sessionStorage.getItem("post_login_redirect");
        sessionStorage.removeItem("post_login_redirect");

        router.push(redirectPath || "/dashboard");
      } catch (err) {
        console.error("Callback error:", err);
        setError("Authentication failed. Please try again.");
      }
    };

    handleCallback();
  }, [searchParams, login, router, provider]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-destructive text-2xl font-bold">
            Authentication Failed
          </h1>
          <p className="text-muted-foreground mt-2">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="text-primary mt-4 underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
