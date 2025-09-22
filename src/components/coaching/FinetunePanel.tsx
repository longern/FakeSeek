import { useCallback, useEffect, useState } from "react";
import OpenAI from "openai";

import { useAppSelector } from "../../app/hooks";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";

function useOpenAIClient() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  if (currentPreset === null) throw new Error("No preset selected");

  const client = new OpenAI({
    apiKey: currentPreset.apiKey,
    baseURL: currentPreset.baseURL,
    dangerouslyAllowBrowser: true,
  });

  return client;
}

function useListFinetuneJobs() {
  const client = useOpenAIClient();

  const listFinetuneJobs = useCallback(async () => {
    return await client.fineTuning.jobs.list();
  }, [client]);

  return listFinetuneJobs;
}

export function useCreateFinetuneJob() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );
  const client = useOpenAIClient();

  const createFinetuneJob = useCallback(async () => {
    return await client.fineTuning.jobs.create({
      method: { type: "supervised" },
      model: currentPreset?.defaultModel!,
      training_file: "",
    });
  }, [client]);

  return createFinetuneJob;
}

function FinetunePanel() {
  const [finetuneJobs, setFinetuneJobs] = useState<FineTuningJob[]>([]);

  const listFinetuneJobs = useListFinetuneJobs();

  useEffect(() => {
    listFinetuneJobs().then((res) => {
      setFinetuneJobs(res.data);
    });
  }, [listFinetuneJobs]);

  return JSON.stringify(finetuneJobs, null, 2);
}

export default FinetunePanel;
