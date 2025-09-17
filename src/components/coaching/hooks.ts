import OpenAI from "openai";
import { useCallback } from "react";

import { useAppSelector } from "../../app/hooks";
import { TokenKLDiversity, TokenLogprobs } from "./MessageViewer";

export function useGenerate() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const generate = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      options?: { signal?: AbortSignal }
    ) => {
      if (currentPreset === null) throw new Error("No preset selected");
      const client = new OpenAI({
        apiKey: currentPreset.apiKey,
        baseURL: currentPreset.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const completion = client.chat.completions.create(
        {
          model: currentPreset.defaultModel!,
          messages: messages as any,
          temperature: currentPreset.temperature,
          logprobs: true,
          top_logprobs: 5,
        },
        { signal: options?.signal }
      );
      return completion;
    },
    [currentPreset]
  );

  return generate;
}

export function useForward() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const forward = useCallback(
    async ({
      prompt,
      completion,
      model,
      topLogprobs = 1,
    }: {
      prompt: Array<{ role: string; content: string }>;
      completion: Array<{ role: string; content: string }>;
      model?: string;
      topLogprobs?: number;
    }) => {
      const { AutoTokenizer } = await import("@huggingface/transformers");

      model = model ?? "openai/gpt-oss-120b";

      const tokenizer = await AutoTokenizer.from_pretrained(model);
      if (!tokenizer.chat_template) {
        const { downloadFile } = await import("@huggingface/hub");
        const templateBlob = await downloadFile({
          repo: model,
          path: "chat_template.jinja",
        });
        const chatTemplate = await templateBlob?.text();
        tokenizer.chat_template = chatTemplate;
      }

      const text = tokenizer.apply_chat_template([...prompt, ...completion], {
        tokenize: false,
      }) as string;

      const client = new OpenAI({
        apiKey: currentPreset?.apiKey,
        baseURL: currentPreset?.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const extraBody: Record<string, any> = { prompt_logprobs: topLogprobs };
      const logprobsResponse = await client.completions.create({
        model: "gpt-oss-120b",
        prompt: text,
        max_tokens: 1,
        ...extraBody,
      });

      const choice = logprobsResponse.choices[0];
      if (!("prompt_logprobs" in choice))
        throw new Error("No prompt_logprobs in completion");

      const promptLogprobs = choice.prompt_logprobs as Array<{
        [tokenId: string]: {
          logprob: number;
          rank: number;
          decoded_token: string;
        };
      }>;

      const promptIds = tokenizer.apply_chat_template(prompt, {
        add_generation_prompt: true,
        return_tensor: false,
      }) as number[];
      const promptCompletionIds = tokenizer.apply_chat_template(
        [...prompt, ...completion],
        { return_tensor: false }
      ) as number[];
      const completionIds = promptCompletionIds.slice(promptIds.length);
      promptLogprobs.splice(0, promptIds.length);

      const logprobs: TokenLogprobs[] = promptLogprobs.map(
        (tokenLogProbs, i) => ({
          token: tokenLogProbs[completionIds[i]].decoded_token,
          token_id: completionIds[i],
          logprob: tokenLogProbs[completionIds[i]].logprob,
          top_logprobs: Object.entries(tokenLogProbs)
            .sort((a, b) => a[1].rank - b[1].rank)
            .map(([tokenId, info]) => ({
              token: info.decoded_token,
              token_id: parseInt(tokenId),
              logprob: info.logprob,
              rank: info.rank,
            })),
        })
      );

      return logprobs;
    },
    [currentPreset]
  );

  return forward;
}

export function useCalculateKL() {
  const forward = useForward();

  const calculateKL = useCallback(
    async ({
      prompt,
      teacherPrompt,
      completion,
      model,
    }: {
      prompt: Array<{ role: string; content: string }>;
      teacherPrompt: Array<{ role: string; content: string }>;
      completion: Array<{ role: string; content: string }>;
      model?: string;
    }) => {
      const logprobs = await forward({ model, prompt, completion });
      const teacherLogprobs = await forward({
        model,
        prompt: teacherPrompt,
        completion,
        topLogprobs: 3,
      });

      if (logprobs.length !== teacherLogprobs.length)
        throw new Error("Logprobs length mismatch");

      const klValues = logprobs.map((logprob, i) => {
        const teacherLogprob = teacherLogprobs[i];
        const tokenId = (() => {
          for (const id of Object.keys(logprob))
            if (id in teacherLogprob) return id;
        })();

        if (!tokenId)
          throw new Error(`Token ID not found in logprobs at position ${i}`);

        return {
          token: logprob.token,
          lpr:
            logprob.logprob -
            teacherLogprob.top_logprobs.find(
              (topLogprob) => topLogprob.token_id === logprob.token_id
            )!.logprob,
          logprob: logprob.logprob,
          teacherTopLogprobs: teacherLogprob.top_logprobs,
        } as TokenKLDiversity;
      });

      return klValues;
    },
    [forward]
  );

  return calculateKL;
}
