import OpenAI from "openai";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { search } from "./search";

export type DigestWorkflowParams = {
  instructions: string;
  firstTime: number;
  interval: number;
  model?: string;
  apiKey?: string;
  baseURL?: string;
};

const DEVELOPER_PROMPT = `\
You are a helpful assistant. If you are calling tools, use this format, replace \`tool_name\` and do not output anything else:
\`\`\`tool-{tool_name}
query
\`\`\`

Available tools:
- search: Search the web for information
- fetch: Fetch data from a URL
`;

export class DigestWorkflow extends WorkflowEntrypoint<
  {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL?: string;
    OPENAI_MODEL?: string;
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
    FALLBACK_API_KEY?: string;
    FALLBACK_BASE_URL?: string;
    FALLBACK_MODEL?: string;
  },
  DigestWorkflowParams
> {
  async run(event: WorkflowEvent<DigestWorkflowParams>, step: WorkflowStep) {
    const { firstTime, interval, instructions, model, apiKey, baseURL } =
      event.payload;

    const taskHistory: ChatCompletionMessageParam[] = [
      { role: "system", content: DEVELOPER_PROMPT },
      {
        role: "user",
        content: instructions,
      },
    ];

    for (let i = 0; i <= 1024; i++) {
      if (firstTime && interval) {
        if (Date.now() > firstTime + i * interval) continue;
        await step.sleepUntil(`sleep ${i}`, new Date(firstTime + i * interval));
      }

      const taskResult: ChatCompletionMessageParam = await step.do(
        `step ${i + 1}`,
        { retries: { limit: 2, delay: 60000 } },
        async () => {
          const lastResult = taskHistory[taskHistory.length - 1];
          const queryMatch = Array.from(
            (lastResult?.content as string).matchAll(
              /```tool-(.*)\n([\s\S]+?)\n```/g
            )
          );
          if (lastResult?.role === "assistant" && queryMatch.length) {
            for (const call of queryMatch) {
              if (call[1] === "search") {
                const query = call[2];
                const response = await search(query, this.env);
                const data = await response.json<{ items: any[] }>();
                if (!data.items) return data as any;
                return {
                  role: "user",
                  content: data.items
                    .map((item) => `${item.title}\n${item.snippet}`)
                    .join("\n"),
                  refusal: null,
                };
              }
            }
          }

          const client = new OpenAI({
            apiKey: apiKey ?? this.env.OPENAI_API_KEY,
            baseURL: baseURL ?? this.env.OPENAI_BASE_URL,
          });
          const completion = await client.chat.completions
            .create({
              model: model ?? this.env.OPENAI_MODEL ?? "o3-mini",
              messages: taskHistory,
            })
            .then((res) => {
              if (!res.choices) {
                const error =
                  (res as any)?.error?.metadata?.raw ?? JSON.stringify(res);
                throw new Error(error);
              }
              if (!res.choices[0].message.content)
                throw new Error("No content in response");
              return res;
            })
            .catch((err) => {
              if (!this.env.FALLBACK_API_KEY) throw err;
              const fallbackClient = new OpenAI({
                apiKey: this.env.FALLBACK_API_KEY,
                baseURL:
                  this.env.FALLBACK_BASE_URL ??
                  "https://generativelanguage.googleapis.com/v1beta/openai/",
              });
              return fallbackClient.chat.completions
                .create({
                  model: this.env.FALLBACK_MODEL ?? "gemini-2.0-flash",
                  messages: taskHistory,
                })
                .catch((fallbackErr) => {
                  throw new Error(
                    `Primary API failed: ${err.message}\nFallback API failed: ${fallbackErr.message}`
                  );
                });
            });

          return completion.choices[0].message;
        }
      );

      if (
        taskResult.role === "assistant" &&
        !(taskResult.content as string).match(/```tool-(.*)\n([\s\S]+?)\n```/g)
      )
        return taskResult.content;

      taskHistory.push(taskResult);
    }
  }
}
