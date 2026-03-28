import { CloudRain, Sun } from "lucide-react";

import { CardText } from "@/components/ui/card";

interface WeatherBannerProps {
  city: string;
  fallbackAdvice?: string;
}

type ForecastSummary = {
  condition: "clear" | "rain";
  advice: string;
  caption: string;
};

async function loadForecast(city: string): Promise<ForecastSummary | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},ID&units=metric&appid=${apiKey}`,
      {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 1800 },
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      list?: Array<{
        pop?: number;
        main?: { temp?: number };
        weather?: Array<{ main?: string; description?: string }>;
      }>;
    };

    const next = payload.list?.[0];
    if (!next) return null;

    const main = next.weather?.[0]?.main?.toLowerCase() ?? "";
    const desc = next.weather?.[0]?.description ?? "cuaca normal";
    const temp = typeof next.main?.temp === "number" ? Math.round(next.main.temp) : null;
    const pop = typeof next.pop === "number" ? next.pop : 0;

    const rainy = main.includes("rain") || main.includes("drizzle") || main.includes("thunder") || pop >= 0.45;

    return {
      condition: rainy ? "rain" : "clear",
      advice: rainy
        ? "Potensi hujan cukup tinggi. Prioritaskan aktivitas outdoor di pagi hari dan siapkan plan indoor cadangan."
        : "Cuaca relatif bersahabat. Aktivitas outdoor tetap direkomendasikan dengan hidrasi yang cukup.",
      caption: `${desc}${temp !== null ? `, ${temp}°C` : ""}`,
    };
  } catch {
    return null;
  }
}

export async function WeatherBanner({ city, fallbackAdvice }: WeatherBannerProps) {
  const forecast = await loadForecast(city);
  const condition = forecast?.condition ?? "clear";
  const advice =
    forecast?.advice ??
    fallbackAdvice ??
    "Periksa pembaruan cuaca lokal sebelum aktivitas luar ruangan.";
  const caption = forecast?.caption ?? "Forecast sementara belum tersedia.";
  const Icon = condition === "rain" ? CloudRain : Sun;

  return (
    <div
      className={
        condition === "rain"
          ? "flex items-start gap-3 rounded-xl border border-[#e7c1b8] bg-[#fce7e3] p-3"
          : "flex items-start gap-3 rounded-xl border border-[#d4e3ca] bg-[#eaf6df] p-3"
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">Forecast Alert - {city}</p>
        <CardText>{advice}</CardText>
        <p className="mt-1 text-xs text-[var(--text-soft)]">{caption}</p>
      </div>
    </div>
  );
}
