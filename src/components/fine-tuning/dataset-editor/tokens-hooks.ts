import OpenAI from "openai";
import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { useCurrentPreset } from "@/components/presets/hooks";
import {
  encodeSingleToken,
  forward,
  getTokenizer,
  tokenizeCompletion,
  useMoreLogprobs,
} from "../hooks";
import { convertFromHarmony, parseCompletion } from "../utils";
import type { DatasetRecord } from "./DatasetRecordEditor";
import { TokenLogprobs } from "./TokenList";

export function toggleAnchor(
  anchors: DatasetRecord["anchors"] | undefined,
  anchor: { token_index: number; token_id: number },
  value: boolean
) {
  anchors ??= [];
  if (value)
    return [
      ...anchors.filter((anc) => anc.token_index < anchor.token_index),
      anchor,
      ...anchors.filter((anc) => anc.token_index > anchor.token_index),
    ];
  else {
    const newAnchors = anchors.filter(
      (anc) => anc.token_index !== anchor.token_index
    );
    return newAnchors.length === 0 ? undefined : newAnchors;
  }
}

export function useTokensProps(
  model: string,
  record: DatasetRecord,
  onError: (err: Error) => void
) {
  const [tokens, setTokens] = useState<Array<string> | null>(null);
  const [tokenIds, setTokenIds] = useState<Array<number> | null>(null);

  const [logprobs, setLogprobs] = useState<Array<TokenLogprobs> | undefined>(
    undefined
  );

  const [draft, setDraft] = useState<
    { text: string; prefix: string } | undefined
  >(undefined);
  const [continueToken, setContinueToken] = useState<{
    tokenIndex: number;
    tokenId: number;
  } | null>(null);

  const currentPreset = useCurrentPreset()!;
  const moreLogprobs = useMoreLogprobs();

  const client = useMemo(() => {
    if (currentPreset === null) return null;
    return new OpenAI({
      apiKey: currentPreset.apiKey,
      baseURL: currentPreset.baseURL,
      dangerouslyAllowBrowser: true,
    });
  }, [currentPreset?.apiKey, currentPreset?.baseURL]);

  const applyDraft = useEffectEvent(
    (
      setCompletion: (completion: {
        role: string;
        content: string | null;
        thinking?: string | undefined;
      }) => void,
      setAnchors: React.Dispatch<
        React.SetStateAction<DatasetRecord["anchors"] | undefined>
      >
    ) => {
      if (!draft) return;

      // Auto-anchor if new token is not the top predicted token
      if (continueToken !== null) {
        setAnchors((anchors) => {
          const logprob = logprobs?.[continueToken.tokenIndex];
          const topTokenId = logprob?.top_logprobs?.[0].token_id;
          return toggleAnchor(
            anchors?.filter((p) => p.token_index < continueToken.tokenIndex),
            {
              token_index: continueToken.tokenIndex,
              token_id: continueToken.tokenId,
            },
            topTokenId !== continueToken.tokenId
          );
        });
      }

      setCompletion(parseCompletion(draft.prefix + draft.text));
      clearDraft();
    }
  );

  const clearDraft = useCallback(() => {
    setDraft(undefined);
    setContinueToken(null);
  }, []);

  const changeToken = useCallback(
    async (tokenIndex: number, token: string) => {
      const tokenizer = await getTokenizer(model);
      const newTokenId = tokenizer.encode(token)[0];
      continueGeneration(tokenIndex, newTokenId);
    },
    [tokens, tokenIds, model, onError]
  );

  const loadMoreLogprobs = useCallback(
    async (tokenIndex: number) => {
      const logprobs = await moreLogprobs({
        prompt: record.prompt,
        completion: record.completion as any,
        tokenIndex: tokenIndex,
        tokenizerModel: model,
        topLogprobs: 20,
      });
      if (!logprobs) return;

      const tokenizer = await getTokenizer(model!);

      const tokenLogprobs = {
        token: logprobs.tokens![0],
        token_id: encodeSingleToken(tokenizer, logprobs.tokens![0]),
        logprob: logprobs.token_logprobs![0],
        top_logprobs: Object.entries(logprobs.top_logprobs![0])
          .sort((a, b) => b[1] - a[1])
          .map(([token, logprob], index) => ({
            token,
            token_id: encodeSingleToken(tokenizer, token),
            logprob,
            rank: index + 1,
          })),
      } as TokenLogprobs;

      setLogprobs((prev) => {
        if (!prev) return prev;
        const newLogprobs = [...prev];
        newLogprobs[tokenIndex] = tokenLogprobs;
        return newLogprobs;
      });
    },
    [client, model, record.prompt, record.completion, moreLogprobs]
  );

  const continueGeneration = useCallback(
    async (tokenIndex: number, tokenId: number) => {
      if (!client) return;

      setContinueToken({ tokenIndex, tokenId });

      const tokenizerModel = model;

      const tokenizer = await getTokenizer(tokenizerModel);

      const promptIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, record.prompt),
        { add_generation_prompt: true, return_tensor: false }
      ) as number[];
      const promptCompletionIds = tokenizer.apply_chat_template(
        convertFromHarmony(tokenizerModel, [
          ...record.prompt,
          ...record.completion,
        ]),
        { return_tensor: false }
      ) as number[];
      const completionIds = promptCompletionIds.slice(promptIds.length);
      const completionPrefixIds = completionIds.slice(0, tokenIndex);
      const prefixIds = [...promptIds, ...completionPrefixIds, tokenId];

      const prefixText = tokenizer.decode(prefixIds);

      const response = await client.completions.create({
        model,
        prompt: prefixText,
        stream: true,
        max_tokens: 32768,
        temperature: currentPreset.temperature,
        ...{ include_stop_str_in_output: true, skip_special_tokens: false },
      });

      const completionPrefixText = tokenizer.decode(completionPrefixIds);
      const token = tokenizer.decode([tokenId]);

      setDraft({ prefix: completionPrefixText, text: token });

      for await (const chunk of response) {
        setDraft(
          (prev) =>
            prev && {
              ...prev,
              text: prev.text + chunk.choices[0].text,
            }
        );
      }
    },
    [client, model, record.prompt, record.completion, currentPreset.temperature]
  );

  useEffect(() => {
    tokenizeCompletion({
      model,
      prompt: record.prompt,
      completion: record.completion,
    })
      .then(({ tokens, tokenIds }) => {
        setTokens(tokens);
        setTokenIds(tokenIds);
      })
      .catch(onError);
  }, [model, record.prompt, record.completion]);

  useEffect(() => {
    if (!client) return;

    setLogprobs(undefined);
    forward(client, {
      model: currentPreset.defaultModel!,
      prompt: record.prompt,
      completion: record.completion as any,
      topLogprobs: 5,
    })
      .then(setLogprobs)
      .catch(onError);
  }, [client, model, record.prompt, record.completion]);

  return {
    tokens,
    tokenIds,
    logprobs,
    client,
    draft,
    applyDraft,
    clearDraft,
    changeToken,
    loadMoreLogprobs,
    continueGeneration,
  };
}

export function useRecordSetters(
  onChange?: (record: (prev: DatasetRecord) => DatasetRecord) => void
) {
  const setCompletion = useCallback(
    (completion: DatasetRecord["completion"][number]) => {
      onChange?.((prev) => ({ ...prev, completion: [completion] }));
    },
    [onChange]
  );

  const setAnchors: React.Dispatch<
    React.SetStateAction<DatasetRecord["anchors"] | undefined>
  > = useCallback(
    (value) => {
      onChange?.((prev) => ({
        ...prev,
        anchors: typeof value === "function" ? value(prev.anchors) : value,
      }));
    },
    [onChange]
  );

  return { setCompletion, setAnchors };
}
