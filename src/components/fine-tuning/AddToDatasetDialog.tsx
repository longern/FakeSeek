import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Toolbar,
  Typography,
} from "@mui/material";
import { Tool } from "openai/resources/responses/responses.mjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatMessage } from "@/app/messages";
import { DatasetFile, listDatasets, readDatasetText } from "./DatasetsPanel";
import { DatasetRecord } from "./dataset-editor/DatasetRecordEditor";
import {
  getDatasetDirectoryHandle,
  parseDataset,
  saveDataset,
} from "./dataset-editor/utils";
import DatasetsTable from "./evals/DatasetsTable";

function toDatasetRecord({
  messages,
  badResponse,
  instructions,
  tools,
}: {
  messages: ChatMessage[];
  badResponse: ChatMessage;
  instructions?: string;
  tools?: Tool[];
}): DatasetRecord {
  const mapper = (msg: ChatMessage): DatasetRecord["prompt"] => {
    switch (msg.object) {
      case "message":
        return [
          {
            role: "user",
            content: msg.content
              .flatMap((part) =>
                part.type === "input_text" ? [part.text] : []
              )
              .join(""),
          },
        ];

      case "response":
        const records = [];
        let pendingReasoning: string | undefined = undefined;
        for (const item of msg.output) {
          switch (item.type) {
            case "reasoning":
              pendingReasoning = (item.content ?? item.summary)
                .map((part) => part.text)
                .join("\n");
              break;
            case "message":
              records.push({
                role: "assistant" as const,
                content: item.content
                  .map((part) =>
                    part.type === "refusal" ? part.refusal : part.text
                  )
                  .join(""),
                thinking: pendingReasoning,
              });
              break;
            case "function_call":
              records.push({
                role: "assistant" as const,
                content: "",
                thinking: pendingReasoning,
                tool_calls: [
                  { name: item.name, arguments: JSON.parse(item.arguments) },
                ],
              });
              break;
          }
        }
        return records;

      case "function_call_output":
        return [{ role: "tool", content: msg.output }];
    }
  };

  const prompt = messages.flatMap(mapper);
  const completion = mapper(badResponse) as DatasetRecord["completion"];

  if (instructions) prompt.unshift({ role: "system", content: instructions });

  return { prompt, completion, tools };
}

async function appendToDataset({
  selectedDataset,
  prevMessages,
  badResponse,
  instructions,
  tools,
}: {
  selectedDataset: string;
  prevMessages: ChatMessage[];
  badResponse: ChatMessage;
  instructions?: string;
  tools?: Tool[];
}) {
  const datasetContent = await readDatasetText(selectedDataset);
  const { model, dataset } = parseDataset(datasetContent);
  dataset.push(
    toDatasetRecord({
      messages: prevMessages,
      badResponse,
      instructions,
      tools,
    })
  );
  saveDataset(dataset, selectedDataset, model);

  const newDatasetContent = document.toString();
  const dir = await getDatasetDirectoryHandle();
  const fileHandle = await dir.getFileHandle(selectedDataset, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(newDatasetContent);
  await writable.close();
}

function AddToDatasetDialog({
  open,
  onClose,
  instructions,
  prevMessages,
  badResponse,
  tools,
}: {
  open: boolean;
  onClose: () => void;
  instructions?: string;
  prevMessages: ChatMessage[] | null;
  badResponse: ChatMessage | null;
  tools?: Tool[];
}) {
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Array<DatasetFile>>([]);

  const { t } = useTranslation("fineTuning");

  const handleExport = () => {
    if (
      selectedDataset === null ||
      badResponse === null ||
      prevMessages === null
    )
      return;

    appendToDataset({
      prevMessages,
      badResponse,
      instructions,
      tools,
      selectedDataset,
    });
    onClose();
  };

  useEffect(() => {
    listDatasets().then(setDatasets);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            overflow: "hidden", // KaTeX overflow?
          },
        },
      }}
    >
      <DialogTitle sx={{ padding: 0, backgroundColor: "background.default" }}>
        <Toolbar disableGutters>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
          >
            {t("Add to Dataset")}
          </Typography>
        </Toolbar>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          padding: 0,
          backgroundColor: (theme) => theme.palette.background.paper,
        }}
      >
        <DatasetsTable
          datasets={datasets}
          selected={selectedDataset}
          setSelected={setSelectedDataset}
        />
      </DialogContent>

      <DialogActions sx={{ paddingX: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          {t("Create dataset")}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={selectedDataset === null}
          onClick={handleExport}
        >
          {t("Append")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddToDatasetDialog;
