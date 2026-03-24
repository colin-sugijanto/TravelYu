"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { AppShell } from "@/components/layout/shell";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Magic link sudah dikirim. Cek email kamu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <Card className="p-6">
          <CardTitle className="text-xl">Login ke TravelYu</CardTitle>
          <CardText className="mt-1">Google OAuth atau email magic link (Supabase Auth)</CardText>

          <button
            onClick={handleGoogle}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
          >
            Continue with Google
          </button>

          <div className="my-4 h-px bg-[var(--border)]" />

          <form onSubmit={handleMagicLink} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
              required
            />
            <button
              type="submit"
              className="h-11 w-full rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)]"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>

          {message ? <p className="mt-3 text-xs text-[var(--text-soft)]">{message}</p> : null}
        </Card>
      </div>
    </AppShell>
  );
}
