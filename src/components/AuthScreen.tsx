import { useState } from "react";
import { Gamepad2, Mail, Lock, User, ArrowRight, LogIn, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { authErrorMessage } from "../lib/image";
import { cn } from "../utils/cn";

export default function AuthScreen() {
  const { login, signup, loginWithGoogle, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
    } catch (err: any) {
      setError(authErrorMessage(err?.code || ""));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    setGoogleBusy(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(authErrorMessage(err?.code || ""));
      setGoogleBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-900/50">
            <Gamepad2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Game Studio OS</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage rentals, bills & revenue — all in one place
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          {/* Google sign-in */}
          <button
            onClick={google}
            disabled={googleBusy || busy}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-hairline bg-panel2 py-2.5 text-sm font-medium text-ink transition hover:border-muted/50 disabled:opacity-60"
          >
            {googleBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-ink" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Continue with Google
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-muted">or with email</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          {/* tabs */}
          <div className="mb-6 inline-flex w-full rounded-xl bg-white/5 p-1">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition",
                mode === "login" ? "bg-violet-600 text-white shadow" : "text-slate-300 hover:text-white"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition",
                mode === "signup" ? "bg-violet-600 text-white shadow" : "text-slate-300 hover:text-white"
              )}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field icon={<User className="h-4 w-4" />} label="Studio name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NEXUS Game Studio"
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                />
              </Field>
            )}
            <Field icon={<Mail className="h-4 w-4" />} label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="h-4 w-4" /> Sign In
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" /> Create Account
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={continueAsGuest}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4 text-violet-300" /> Try demo without account
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="font-medium text-violet-300 hover:text-violet-200"
          >
            {mode === "login" ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 transition focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/20">
        <span className="text-slate-500">{icon}</span>
        {children}
      </div>
    </label>
  );
}
