"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { ApiError } from "@/lib/infra/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LOGIN_ENDPOINT = "POST /api/auth/login";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  const handleSignInClick = () => {
    login.mutate({ username, password });
  };

  const statusMessage = login.isPending
    ? "Calling endpoint…"
    : login.isSuccess
      ? "Signed in. Redirecting…"
      : login.isError
        ? "Request failed."
        : "Idle";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-base-300 via-base-200 to-base-100 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, #2f7d40 50%, transparent), transparent)",
        }}
      />
      <Card className="relative z-[1] w-full max-w-md shadow-2xl shadow-black/25">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex flex-col items-center gap-3">
            <div className="relative size-20 overflow-hidden rounded-xl bg-base-200/80 shadow-inner ring-1 ring-base-content/[0.08]">
              <Image
                src="/images/crest.png"
                alt="Gonsalves family crest"
                fill
                className="object-contain p-2"
                sizes="80px"
                priority
              />
            </div>
            <CardTitle className="font-heading text-2xl font-bold tracking-tight text-base-content">
              Gonsalves Family Admin
            </CardTitle>
          </div>
          <div className="prose prose-invert prose-evergreen prose-sm mx-auto max-w-sm text-center [&_p]:mb-0">
            <p>Sign in to manage the family tree</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username or email
              </Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {login.error && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                <span>{login.error.message}</span>
              </div>
            )}
            <Button
              type="submit"
              className="btn-block"
              disabled={login.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleSignInClick();
              }}
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>

            <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.04] p-3 font-mono text-[11px] leading-relaxed text-base-content/50">
              <div className="mb-1 font-semibold text-base-content/80">Status</div>
              <div>Endpoint: {LOGIN_ENDPOINT}</div>
              <div>Input username: {username || "(empty)"}</div>
              <div>Phase: {statusMessage}</div>
              {login.error && (
                <div className="mt-2 text-error">
                  Error: {login.error.message}
                  {login.error instanceof ApiError && ` (HTTP ${login.error.status})`}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
