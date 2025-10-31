import type { PreTrainedTokenizer } from "@huggingface/transformers";
import OpenAI from "openai";
import { useCallback } from "react";

import { useAppSelector } from "../../app/hooks";
import { useCurrentPreset } from "../presets/hooks";
import { DatasetRecord } from "./dataset-editor/DatasetRecordEditor";
import { TokenLogprobs } from "./dataset-editor/MessageViewer";
import { convertFromHarmony } from "./utils";

const TOKENIZER_CACHE: Record<string, PreTrainedTokenizer> = {};

export async function getTokenizer(model: string) {
  if (model in TOKENIZER_CACHE) return TOKENIZER_CACHE[model];

  const { AutoTokenizer } = await import("@huggingface/transformers");

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

  TOKENIZER_CACHE[model] = tokenizer;

  return tokenizer;
}

export function encodeSingleToken(
  tokenizer: PreTrainedTokenizer,
  token: string
) {
  const encoded = tokenizer.encode(token);
  if (encoded.length !== 1)
    throw new Error(`Tokenizer encoded multiple tokens for single token.`);
  return encoded[0];
}

export async function completionApplyTemplate({
  model,
  prompt,
  completion,
}: {
  model: string;
  prompt: DatasetRecord["prompt"];
  completion: DatasetRecord["completion"];
}) {
  const tokenizer = await getTokenizer(model);
  const promptIds = tokenizer.apply_chat_template(
    model ? convertFromHarmony(model, prompt) : prompt,
    {
      add_generation_prompt: true,
      tokenize: false,
      return_tensor: false,
    }
  ) as string;
  const promptCompletionIds = tokenizer.apply_chat_template(
    model
      ? convertFromHarmony(model, prompt.concat(completion as any))
      : prompt,
    { tokenize: false, return_tensor: false }
  ) as string;
  const completionText = promptCompletionIds.slice(promptIds.length);
  return completionText;
}

export async function tokenizeCompletion({
  model,
  prompt,
  completion,
}: {
  model: string;
  prompt: DatasetRecord["prompt"];
  completion: DatasetRecord["completion"];
}) {
  const tokenizer = await getTokenizer(model);
  const completionText = await completionApplyTemplate({
    model,
    prompt,
    completion,
  });
  const completionIds = tokenizer.encode(completionText);
  const tokens = completionIds.map((id) => tokenizer.decode([id], {}));
  return tokens;
}

export function useGenerate() {
  const currentPreset = useCurrentPreset();

  const generate = useCallback(
    async (
      messages: Array<
        DatasetRecord["prompt"][number] | DatasetRecord["completion"]
      >,
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
      tokenizerModel,
      topLogprobs = 1,
    }: {
      prompt: DatasetRecord["prompt"];
      completion: Array<DatasetRecord["completion"]>;
      tokenizerModel: string;
      model?: string;
      topLogprobs?: number;
    }) => {
      const tokenizer = await getTokenizer(tokenizerModel);

      const text = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, [...prompt, ...completion]),
        { tokenize: false }
      ) as string;

      const client = new OpenAI({
        apiKey: currentPreset?.apiKey,
        baseURL: currentPreset?.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const extraBody: Record<string, any> = { prompt_logprobs: topLogprobs };
      model = model ?? currentPreset?.defaultModel ?? "openai/gpt-oss-120b";
      const logprobsResponse = await client.completions.create({
        model,
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

      const promptIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, prompt),
        { add_generation_prompt: true, return_tensor: false }
      ) as number[];
      const promptCompletionIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, [...prompt, ...completion]),
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

export function useContinueGeneration() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const continueGeneration = useCallback(
    async ({
      prompt,
      completion,
      tokenIndex,
      tokenId,
      tokenizerModel,
      maxTokens,
      topLogprobs,
    }: {
      prompt: DatasetRecord["prompt"];
      completion: Array<DatasetRecord["completion"]>;
      tokenIndex: number;
      tokenId: number;
      tokenizerModel: string;
      maxTokens?: number;
      topLogprobs?: number;
    }) => {
      const tokenizer = await getTokenizer(tokenizerModel);

      const promptIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, prompt),
        { add_generation_prompt: true, return_tensor: false }
      ) as number[];
      const promptCompletionIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, [...prompt, ...completion]),
        { return_tensor: false }
      ) as number[];
      const completionIds = promptCompletionIds.slice(promptIds.length);
      const completionPrefixIds = completionIds.slice(0, tokenIndex);
      const prefixIds = [...promptIds, ...completionPrefixIds, tokenId];

      const prefixText = tokenizer.decode(prefixIds);

      const client = new OpenAI({
        apiKey: currentPreset?.apiKey,
        baseURL: currentPreset?.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const model = currentPreset?.defaultModel ?? "openai/gpt-oss-120b";
      const response = await client.completions.create({
        model,
        prompt: prefixText,
        max_tokens: maxTokens ?? 32768,
        temperature: currentPreset?.temperature,
        logprobs: topLogprobs,
        ...{ include_stop_str_in_output: true, skip_special_tokens: false },
      });

      const choice = response.choices[0];
      const completionPrefixText = tokenizer.decode(completionPrefixIds);
      const token = tokenizer.decode([tokenId]);

      return { prefix: completionPrefixText, token, choice };
    },
    [currentPreset]
  );

  return continueGeneration;
}

export function useMoreLogprobs() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const moreLogprobs = useCallback(
    async ({
      prompt,
      completion,
      tokenIndex,
      tokenizerModel,
      topLogprobs = 20,
    }: {
      prompt: DatasetRecord["prompt"];
      completion: Array<DatasetRecord["completion"]>;
      tokenIndex: number;
      tokenizerModel: string;
      topLogprobs: number;
    }) => {
      const tokenizer = await getTokenizer(tokenizerModel);

      const promptIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, prompt),
        { add_generation_prompt: true, return_tensor: false }
      ) as number[];
      const promptCompletionIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, [...prompt, ...completion]),
        { return_tensor: false }
      ) as number[];
      const completionIds = promptCompletionIds.slice(promptIds.length);
      const completionPrefixIds = completionIds.slice(0, tokenIndex);
      const prefixIds = [...promptIds, ...completionPrefixIds];

      const prefixText = tokenizer.decode(prefixIds);

      const client = new OpenAI({
        apiKey: currentPreset?.apiKey,
        baseURL: currentPreset?.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const model = currentPreset?.defaultModel ?? "openai/gpt-oss-120b";
      const response = await client.completions.create({
        model,
        prompt: prefixText,
        max_tokens: 1,
        temperature: currentPreset?.temperature,
        logprobs: topLogprobs,
        ...{ include_stop_str_in_output: true, skip_special_tokens: false },
      });

      const choice = response.choices[0];
      const logprobs = choice.logprobs;

      return logprobs;
    },
    [currentPreset]
  );

  return moreLogprobs;
}
