# FakeSeek

FakeSeek is a browser-first AI workspace for chat, search-assisted reasoning, image generation, and fine-tuning dataset workflows. The frontend stores conversations and presets locally, while the Cloudflare Worker provides optional hosted API routes for search, MCP tools, OpenAI-compatible proxying, logs, and long-running research workflows.

## Features

- Local chat history backed by IndexedDB
- Model provider presets with API key, base URL, default model, API mode, tool provider, temperature, image quality, and fine-tuning endpoint settings
- OpenAI Responses API mode and Chat Completions compatibility mode
- Optional OpenAI built-in tools for web search, code interpreter, and image generation
- Default local tool mode for Google search and remote Python execution
- Image search and image generation/editing from the chat input
- Fine-tuning dataset editing, evaluation, and job management UI
- PWA-style static asset caching with a settings action to refresh deployed assets
- Cloudflare Worker routes for `/api`, `/logs`, `/mcp`, and OpenAI-compatible `/api/v1`
- Hosted default chat fallback: if the user has not created a preset, normal chat requests use the deployed `/api/v1` proxy and the default OpenRouter model

## Deployment

Build the frontend with:

```sh
npm run build
```

Deploy with Wrangler after configuring the Worker bindings in `wrangler.toml` and the required secrets.

### Worker Variables

- `GOOGLE_API_KEY`: API key for Google Search API
- `GOOGLE_CSE_CX`: Custom search engine ID for Google Search API
- `OPENROUTER_API_KEY`: API key used by the hosted `/api/v1/chat/completions` and `/api/v1/responses` proxy routes
- `OPENROUTER_BASE_URL`: Optional OpenAI-compatible base URL for the hosted proxy routes. Defaults to `https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL`: Optional fallback model for hosted proxy routes when a request does not provide `model`
- `OPENAI_API_KEY`: API key used by Cloudflare Workflows research tasks
- `OPENAI_BASE_URL`: Optional OpenAI-compatible base URL for Cloudflare Workflows research tasks
- `OPENAI_MODEL`: Optional model for Cloudflare Workflows research tasks
- `FALLBACK_API_KEY`: Optional API key for the workflow fallback model provider
- `FALLBACK_BASE_URL`: Optional base URL for the workflow fallback model provider
- `FALLBACK_MODEL`: Optional fallback model for workflow retries

Client-side presets can also point directly at a user-provided OpenAI-compatible API base URL. When no preset base URL is configured, the app uses the deployed Worker proxy at `/api/v1`.

If no preset has been created or selected, normal chat sends a non-secret placeholder API key and an empty model value to the hosted Worker proxy. The placeholder only satisfies the browser SDK credential check; the Worker still uses `OPENROUTER_API_KEY` server-side and chooses the model from `OPENROUTER_MODEL` or its server-side fallback. This keeps the first-run chat path usable without asking the user for an API key. Search, image search, deep research, image generation, and fine-tuning still depend on their corresponding Worker variables or preset settings.

## Development

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run build
npm run lint
```
