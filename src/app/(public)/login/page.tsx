"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get("next") || "/dashboard";

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`,
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
    setLoading(true);
    setMessage(null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        });

        if (settingsResponse.ok) {
          const settings = (await settingsResponse.json()) as {
            external?: { google?: boolean };
          };

          if (!settings.external?.google) {
            setMessage("Google OAuth belum diaktifkan. Gunakan magic link dulu.");
            setLoading(false);
            return;
          }
        }
      } catch {
        // Continue and let Supabase OAuth response decide.
      }
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${nextPath}`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setMessage("Google OAuth belum tersedia. Gunakan magic link dulu.");
      setLoading(false);
      return;
    }

    window.location.assign(data.url);
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <CardTitle className="text-xl">Login ke TravelYu</CardTitle>
        <CardText className="mt-1">Google OAuth atau email magic link (Supabase Auth)</CardText>

        <button
          onClick={handleGoogle}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-65"
          disabled={loading}
        >
          {loading ? "Loading..." : "Continue with Google"}
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
            className="h-11 w-full rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-65"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {message ? <p className="mt-3 text-xs text-[var(--text-soft)]">{message}</p> : null}
      </Card>
    </div>
  );
}
