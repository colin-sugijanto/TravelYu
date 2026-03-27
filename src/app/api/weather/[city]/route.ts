import { getCurrentAppUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ city: string }> }) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { city } = await params;
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "OPENWEATHERMAP_API_KEY missing" }, { status: 500 });
  }

  let data: unknown;

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},ID&units=metric&appid=${apiKey}`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      return Response.json({ error: "Weather request failed" }, { status: response.status });
    }

    data = await response.json();
  } catch {
    return Response.json({ error: "Weather request timed out" }, { status: 504 });
  }

  return Response.json({
    city,
    forecast: (data as { list?: unknown[] } | null)?.list?.slice(0, 12) ?? [],
  });
}
