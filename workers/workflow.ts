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
  createTime: number;
};

const DEVELOPER_PROMPT = `\
You are executing one step of a research task. Current step is number {cur_step}. You must choose between invoking a tool and generating the final report.
Today is {cur_date}. When generating the final report, unless the user requests otherwise, your response should be in the same language as the user's question.
When calling tools, you must invoke **only one** tool in this step, think carefully what parameters to use first and then use the following format, replace \`tool_name\` and \`tool_input\` (do not output anything else):
\`\`\`tool-{tool_name}
{tool_input}
\`\`\`

Available tools:
- search: Google search
  input: query
- fetch: Fetch a URL
  input: URL
- sleep: Sleep for a certain amount of time (System will invoke LLM API again after sleep)
  input: time in seconds

Before you calling any tool, make sure you are calling **only one** tool and **only once**.
`;

function extractTool(content?: string) {
  const matches =
    content !== undefined
      ? content.matchAll(/```tool-(.*)\n([\s\S]+?)\n```/g)
      : [];
  return Array.from(matches).map((match) => ({
    name: match[1],
    input: match[2],
  }));
}

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
    const { instructions, model, apiKey, baseURL } = event.payload;

    const taskHistory: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: DEVELOPER_PROMPT.replace(
          "{cur_date}",
          new Date().toUTCString()
        ),
      },
      {
        role: "user",
        content: instructions,
      },
    ];

    for (let i = 1; i <= 1024; i++) {
      // Detect sleep tool
      const lastResult = taskHistory[taskHistory.length - 1];
      const toolCalls = extractTool(lastResult?.content as string);
      if (
        lastResult?.role === "assistant" &&
        toolCalls.length &&
        toolCalls[0].name === "sleep"
      ) {
        const time = parseInt(toolCalls[0].input);
        await step.sleep(`sleep ${i}`, time * 1000);
        taskHistory.push({
          role: "system",
          content: `Slept for ${time} seconds`,
        });
        continue;
      }

      const taskResult: ChatCompletionMessageParam = await step.do(
        `step ${i}`,
        { retries: { limit: 2, delay: 60000 } },
        async () => {
          const lastResult = taskHistory[taskHistory.length - 1];
          const toolCalls = extractTool(lastResult?.content as string);
          if (lastResult?.role === "assistant" && toolCalls.length) {
            for (const call of toolCalls) {
              if (call.name === "search") {
                const response = await search(call.input, this.env);
                const data = await response.json<{ items: any[] }>();
                if (!data.items) throw new Error(JSON.stringify(data));
                return {
                  role: "user",
                  content: data.items
                    .map(
                      (item, index) =>
                        `${index}. ${item.title}\n${item.link}\n${item.snippet}`
                    )
                    .join("\n"),
                  refusal: null,
                };
              } else if (call.name === "fetch") {
                const url = call.input;
                const response = await fetch("https://r.jina.ai/" + url);
                const text = await response.text();
                return { role: "user", content: text };
              }
            }
          }

          const client = new OpenAI({
            apiKey: apiKey ?? this.env.OPENAI_API_KEY,
            baseURL: baseURL ?? this.env.OPENAI_BASE_URL,
          });
          taskHistory[0].content = DEVELOPER_PROMPT.replace(
            "{cur_date}",
            new Date().toUTCString()
          ).replace("{cur_step}", i.toString());
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

      taskHistory.push(taskResult);

      if (
        taskResult.role === "assistant" &&
        !(taskResult.content as string).match(/```tool-(.*)\n([\s\S]+?)\n```/g)
      )
        return {
          messages: taskHistory
            .filter((m) => m.role === "assistant")
            .map((m) => ({
              id: `msg-${crypto.randomUUID()}`,
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: m.content as string }],
            })),
          create_time: event.timestamp.getTime(),
          finish_time: Date.now(),
        };
    }
  }
}
