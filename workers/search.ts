export function search(
  query: string,
  env: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
  }
) {
  const params = new URLSearchParams({
    q: query,
    cx: env.GOOGLE_CSE_CX,
    key: env.GOOGLE_API_KEY,
  });
  return fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
}
