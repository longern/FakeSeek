export function search(
  query: string,
  env: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
  },
  options?: {
    searchType: "image" | undefined;
  }
) {
  const params = new URLSearchParams({
    q: query,
    cx: env.GOOGLE_CSE_CX,
    key: env.GOOGLE_API_KEY,
  });
  if (options?.searchType) params.set("searchType", options?.searchType);
  return fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
}
