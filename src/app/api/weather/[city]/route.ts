export async function GET(_: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "OPENWEATHERMAP_API_KEY missing" }, { status: 500 });
  }

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},ID&units=metric&appid=${apiKey}`,
  );

  if (!response.ok) {
    return Response.json({ error: "Weather request failed" }, { status: response.status });
  }

  const data = await response.json();

  return Response.json({
    city,
    forecast: data?.list?.slice(0, 12) ?? [],
  });
}
