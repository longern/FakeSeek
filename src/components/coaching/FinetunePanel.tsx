import { useCallback, useEffect, useState } from "react";
import OpenAI from "openai";

import { useAppSelector } from "../../app/hooks";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";

function useListFinetuneJobs() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const listFinetuneJobs = useCallback(async () => {
    if (currentPreset === null) throw new Error("No preset selected");

    const client = new OpenAI({
      apiKey: currentPreset.apiKey,
      baseURL: currentPreset.baseURL,
      dangerouslyAllowBrowser: true,
    });

    const jobs = await client.fineTuning.jobs.list();
    return jobs;
  }, [currentPreset]);

  return listFinetuneJobs;
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
