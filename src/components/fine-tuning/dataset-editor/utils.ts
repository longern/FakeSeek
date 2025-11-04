import { createContext } from "react";
import yaml from "yaml";

import { DatasetRecord } from "./DatasetRecordEditor";
import { convertToHarmony } from "../utils";

export const OpenDatasetEditorContext = createContext<
  (datasetName: string | undefined, onClose?: () => void) => void
>(() => {});

export async function getDatasetDirectoryHandle() {
  const root = await navigator.storage.getDirectory();
  const fineTuningDirHandle = await root.getDirectoryHandle(".coaching", {
    create: true,
  });
  const datasetDirectoryHandle = await fineTuningDirHandle.getDirectoryHandle(
    "datasets",
    { create: true }
  );
  return datasetDirectoryHandle;
}

export function parseDataset(content: string) {
  const parsed = yaml.parseDocument(content);
  const match = parsed.commentBefore?.match(/Model:\s*(\S+)/);
  const model = match ? match[1] : undefined;
  let dataset = parsed.toJS() as Array<DatasetRecord>;
  if (model)
    dataset = dataset.map((record) => ({
      ...record,
      prompt: convertToHarmony(model, record.prompt),
      completion: convertToHarmony(model, record.completion),
    }));
  return { model, dataset };
}
