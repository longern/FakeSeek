# FakeSeek

Serverless multi-step research agent powered by DeepSeek-R1 and Cloudflare Workflows.

## Features
- Run long-running tasks with Cloudflare Workflows
- Use DeepSeek-R1 to reason, invoke tools and generate reports
- Search internet using Google Search API
- Fetch and extract content with Jina AI

## Deployment

Variables:

- `FALLBACK_API_KEY`: API key for fallback search engine
- `FALLBACK_BASE_URL`: Base URL for fallback search engine
- `FALLBACK_MODEL`: Model for fallback search engine
- `GOOGLE_API_KEY`: API key for Google Search API
- `GOOGLE_CSE_CX`: Custom search engine ID for Google Search API
- `OPENAI_API_KEY`: API key for OpenAI API
- `OPENAI_BASE_URL`: Base URL for OpenAI API
- `OPENAI_MODEL`: Model for OpenAI API
