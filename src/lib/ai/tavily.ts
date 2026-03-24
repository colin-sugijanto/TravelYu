type TavilyResult = {
  title: string;
  url: string;
  content: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

export async function searchIndonesiaPlaces(query: string, limit = 5): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: `${query} Indonesia travel`,
      max_results: limit,
      search_depth: "basic",
      include_raw_content: false,
    }),
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as TavilyResponse;
  return payload.results ?? [];
}
