import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import OpenAI from "openai";
import { Model } from "openai/resources/models.mjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import yaml from "yaml";

import type { Preset } from "../../app/presets";
import { useCurrentPreset } from "../presets/hooks";
import { listDatasets, readDataset } from "./DatasetsPanel";

const NO_PRESET_ERROR = new Error("No preset selected");

function getClientFromPreset(currentPreset: Preset | null) {
  if (currentPreset === null) throw NO_PRESET_ERROR;

  return new OpenAI({
    apiKey: currentPreset.apiKey,
    baseURL: currentPreset.baseURL,
    dangerouslyAllowBrowser: true,
  });
}

function convertYamlFileToJsonl(yamlFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        const data = yaml.parse(content);
        const jsonlContent = Array.isArray(data)
          ? data.map((record: any) => JSON.stringify(record)).join("\n")
          : JSON.stringify(data);
        const jsonlFile = new File([jsonlContent], yamlFile.name, {
          type: "application/jsonl",
        });
        resolve(jsonlFile);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsText(yamlFile);
  });
}

function CreateFinetuneJobDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [baseModel, setBaseModel] = useState("");
  const [dataset, setDataset] = useState("");
  const [suffix, setSuffix] = useState("");
  const [baseModels, setBaseModels] = useState<Array<Model>>([]);
  const [existingDatasets, setExistingDatasets] = useState<string[]>([]);
  const [enabledIntegrations, setEnabledIntegrations] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const currentPreset = useCurrentPreset();
  const { t } = useTranslation("fineTuning");

  const handleCreate = useCallback(async () => {
    const datasetFile = await readDataset(dataset);
    const jsonlFile = await convertYamlFileToJsonl(datasetFile);
    setCreating(true);

    try {
      const client = getClientFromPreset(currentPreset);

      const uploaded = await client.files.create({
        file: jsonlFile,
        purpose: "fine-tune",
      });

      await client.fineTuning.jobs.create({
        method: { type: "lawf" as any },
        model: baseModel,
        suffix,
        training_file: uploaded.id,
        integrations:
          enabledIntegrations.length === 0
            ? undefined
            : enabledIntegrations.map((name) => ({ type: name } as any)),
      });
      onClose();
    } catch (e) {
      console.error("Failed to create fine-tuning job", e);
    } finally {
      setCreating(false);
    }
  }, [baseModel, currentPreset, dataset, enabledIntegrations, onClose, suffix]);

  useEffect(() => {
    if (!open) return;
    const client = getClientFromPreset(currentPreset);
    client.models.list().then((modelsPage) => setBaseModels(modelsPage.data));
    listDatasets().then((datasetFiles) =>
      setExistingDatasets(datasetFiles.map((file) => file.name))
    );
    setDataset("");
    setCreating(false);
  }, [open, currentPreset]);

  const isSuffixValid = /^[a-zA-Z0-9-_]{0,50}$/.test(suffix);
  const isFormValid = baseModel !== "" && dataset !== "" && isSuffixValid;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("Create a fine-tuning job")}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <Typography
              id="base-model-select-label"
              variant="subtitle1"
              gutterBottom
            >
              {t("Base model")}
            </Typography>
            <Select
              labelId="base-model-select-label"
              size="small"
              value={baseModel}
              required
              onChange={(event) => setBaseModel(event.target.value)}
            >
              {baseModels.map((model) => (
                <MenuItem key={model.id} value={model.id} children={model.id} />
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <Typography
              id="dataset-select-label"
              variant="subtitle1"
              gutterBottom
            >
              {t("Dataset")}
            </Typography>
            <Select
              labelId="dataset-select-label"
              size="small"
              value={dataset}
              required
              onChange={(event) => setDataset(event.target.value)}
            >
              {existingDatasets.map((ds) => (
                <MenuItem key={ds} value={ds} children={ds} />
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <Typography
              id="suffix-input-label"
              variant="subtitle1"
              gutterBottom
            >
              {t("Suffix")}
            </Typography>
            <OutlinedInput
              id="suffix-input"
              aria-describedby="suffix-input-label"
              size="small"
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              error={!isSuffixValid}
            />
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={enabledIntegrations.includes("tensorboard")}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setEnabledIntegrations((prev) =>
                    checked
                      ? [...prev, "tensorboard"]
                      : prev.filter((item) => item !== "tensorboard")
                  );
                }}
              />
            }
            label="TensorBoard"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          disabled={!isFormValid || creating}
          onClick={handleCreate}
          variant="contained"
          loading={creating}
        >
          {t("Create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateFinetuneJobDialog;
