import OpenAI from "openai";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

export type DigestWorkflowParams = {
  firstTime: number;
  interval: number;
  instructions: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
};

export class DigestWorkflow extends WorkflowEntrypoint<
  {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL?: string;
  },
  DigestWorkflowParams
> {
  async run(event: WorkflowEvent<DigestWorkflowParams>, step: WorkflowStep) {
    const { firstTime, interval, instructions, model, apiKey, baseURL } =
      event.payload;

    for (let i = 0; i <= 1000; i++) {
      if (Date.now() > firstTime + i * interval) continue;
      await step.sleepUntil(`sleep ${i}`, new Date(firstTime + i * interval));

      const digest = await step.do(`digest ${i + 1}`, async () => {
        const client = new OpenAI({
          apiKey: apiKey ?? this.env.OPENAI_API_KEY,
          baseURL: baseURL ?? this.env.OPENAI_BASE_URL,
        });
        const completion = await client.chat.completions.create({
          model: model ?? "o3-mini",
          messages: [
            {
              role: "user",
              content: instructions,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "search",
                parameters: {
                  type: "object",
                  properties: {
                    q: {
                      type: "string",
                      description: "The search query",
                    },
                  },
                  required: ["q"],
                },
              },
            },
          ],
        });

        return completion.choices[0].message.tool_calls;
      });

      return digest;
    }
  }
}
