import { CloudRain, Sun } from "lucide-react";

import { CardText } from "@/components/ui/card";

interface WeatherBannerProps {
  city: string;
  condition: "clear" | "rain";
  advice: string;
}

export function WeatherBanner({ city, condition, advice }: WeatherBannerProps) {
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
        <p className="text-sm font-semibold">Forecast Alert · {city}</p>
        <CardText>{advice}</CardText>
      </div>
    </div>
  );
}
