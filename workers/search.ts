const MARKDOWN_SEARCH_ITEM = `- [{{title}}]({{link}})
  {{snippet}}
`;

export function formatSearchResults(data: any) {
  const dataItems = data.items;
  if (!dataItems || !Array.isArray(dataItems)) {
    throw new Error("Invalid search results format");
  }

  const markdown = dataItems
    .map((item: any) => {
      return MARKDOWN_SEARCH_ITEM.replace("{{title}}", item.title)
        .replace("{{link}}", item.link)
        .replace("{{snippet}}", item.snippet);
    })
    .join("\n");

  return markdown;
}

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
