import { useCallback, useEffect, useMemo, useState } from "react";
import OpenAI from "openai";

import { useAppSelector } from "../../app/hooks";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { listDatasets, readDataset } from "./DatasetsPanel";

function useOpenAIClient() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  if (currentPreset === null) throw new Error("No preset selected");

  const client = useMemo(
    () =>
      new OpenAI({
        apiKey: currentPreset.apiKey,
        baseURL: currentPreset.baseURL,
        dangerouslyAllowBrowser: true,
      }),
    [currentPreset]
  );

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

  const createFinetuneJob = useCallback(
    async (trainingFile: File) => {
      const uploaded = await client.files.create({
        file: trainingFile,
        purpose: "fine-tune",
      });
      return await client.fineTuning.jobs.create({
        method: { type: "supervised" },
        model: currentPreset?.defaultModel!,
        training_file: uploaded.id,
      });
    },
    [client]
  );

  return createFinetuneJob;
}

function CreateFinetuneJobDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [dataset, setDataset] = useState("");
  const [existingDatasets, setExistingDatasets] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const createFinetuneJob = useCreateFinetuneJob();
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    listDatasets().then(setExistingDatasets);
    setDataset("");
    setCreating(false);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("Create a fine-tuning job")}</DialogTitle>

      <DialogContent dividers>
        <Typography id="dataset-select-label" variant="subtitle1" gutterBottom>
          {t("Dataset")}
        </Typography>
        <Select
          labelId="dataset-select-label"
          size="small"
          value={dataset}
          required
          fullWidth
          onChange={(event) => setDataset(event.target.value)}
        >
          {existingDatasets.map((ds) => (
            <MenuItem key={ds} value={ds} children={ds} />
          ))}
        </Select>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          disabled={dataset === "" || creating}
          onClick={async () => {
            const datasetContent = await readDataset(dataset);
            const file = new File([datasetContent], dataset, {
              type: "application/yaml",
            });
            setCreating(true);
            await createFinetuneJob(file);
            onClose();
          }}
          variant="contained"
        >
          {t("Create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FinetunePanel() {
  const [finetuneJobs, setFinetuneJobs] = useState<FineTuningJob[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { t } = useTranslation();
  const listFinetuneJobs = useListFinetuneJobs();

  useEffect(() => {
    listFinetuneJobs().then((res) => setFinetuneJobs(res.data));
  }, [listFinetuneJobs]);

  return (
    <Card elevation={0} sx={{ height: "100%" }}>
      <Stack divider={<Divider />} sx={{ height: "100%" }}>
        <Box sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t("Fine-tuning jobs")}
          </Typography>
          <Button variant="contained" onClick={() => setShowCreateDialog(true)}>
            {t("Create")}
          </Button>
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
          <List disablePadding>
            {finetuneJobs.map((job) => (
              <ListItem
                key={job.id}
                disablePadding
                secondaryAction={job.status}
              >
                <ListItemButton>
                  <ListItemText
                    primary={job.id}
                    secondary={new Date(job.created_at * 1000).toLocaleString()}
                    slotProps={{ primary: { noWrap: true } }}
                  />
                  <ListItemIcon></ListItemIcon>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Stack>

      <CreateFinetuneJobDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </Card>
  );
}

export default FinetunePanel;
