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
You are a helpful assistant. You can use search engines to find information. Use this format and do not output anything else:
\`\`\`search
query
\`\`\`
`;

export class DigestWorkflow extends WorkflowEntrypoint<
  {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL?: string;
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
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
          if (lastResult?.role === "assistant" && lastResult.tool_calls) {
            for (const call of lastResult.tool_calls) {
              if (call.function.name === "search") {
                const query = call.function.arguments;
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
          const completion = await client.chat.completions.create({
            model: model ?? "o3-mini",
            messages: taskHistory,
          });

          if (!completion.choices) throw new Error(JSON.stringify(completion));
          const content = completion.choices[0].message.content!;
          const queryMatch = content.match(/```search\n([\s\S]+?)\n```/);
          if (queryMatch) {
            return {
              role: "assistant",
              tool_calls: [
                {
                  id: crypto.randomUUID(),
                  function: { name: "search", arguments: queryMatch[1] },
                  type: "function",
                },
              ],
              content: null,
              refusal: null,
            };
          }

          return completion.choices[0].message;
        }
      );

      if (taskResult.role === "assistant" && taskResult.content)
        return taskResult.content;

      taskHistory.push(taskResult);
    }
  }
}
