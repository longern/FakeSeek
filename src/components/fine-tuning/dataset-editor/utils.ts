import { createContext } from "react";
import yaml from "yaml";

import { DatasetRecord } from "./DatasetRecordEditor";
import { convertFromHarmony, convertToHarmony } from "../utils";

export const OpenDatasetEditorContext = createContext<
  (datasetName: string | undefined, onClose?: () => void) => void
>(() => {});

export async function getDatasetDirectoryHandle() {
  const root = await navigator.storage.getDirectory();
  const fineTuningDirHandle = await root.getDirectoryHandle(".fine-tuning", {
    create: true,
  });
  const datasetDirectoryHandle = await fineTuningDirHandle.getDirectoryHandle(
    "datasets",
    { create: true }
  );
  return datasetDirectoryHandle;
}

export async function saveDataset(
  content: Array<DatasetRecord>,
  datasetName: string,
  model?: string
) {
  const dataset = model
    ? content.map((record) => ({
        ...record,
        prompt: convertFromHarmony(model, record.prompt),
        completion: convertFromHarmony(model, record.completion),
      }))
    : content;
  const document = new yaml.Document(dataset);
  if (model) document.commentBefore = ` Model: ${model}`;
  const documentString = document.toString({ lineWidth: 0 });

  const dir = await getDatasetDirectoryHandle();
  const fileHandle = await dir.getFileHandle(datasetName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(documentString);
  await writable.close();
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
