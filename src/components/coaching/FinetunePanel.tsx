import { useCallback, useEffect, useMemo, useState } from "react";
import OpenAI from "openai";

import { useAppSelector } from "../../app/hooks";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { listDatasets, readDataset } from "./DatasetsPanel";
import { Model } from "openai/resources/models.mjs";

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

function CreateFinetuneJobDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [baseModel, setBaseModel] = useState("");
  const [dataset, setDataset] = useState("");
  const [baseModels, setBaseModels] = useState<Array<Model>>([]);
  const [existingDatasets, setExistingDatasets] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const client = useOpenAIClient();
  const { t } = useTranslation();

  const handleCreate = useCallback(async () => {
    const datasetContent = await readDataset(dataset);
    const file = new File([datasetContent], dataset, {
      type: "application/yaml",
    });
    setCreating(true);
    const uploaded = await client.files.create({
      file,
      purpose: "fine-tune",
    });
    await client.fineTuning.jobs.create({
      method: { type: "supervised" },
      model: baseModel,
      training_file: uploaded.id,
    });
    onClose();
  }, [baseModel, client, dataset, onClose]);

  useEffect(() => {
    if (!open) return;
    client.models.list().then((modelsPage) => setBaseModels(modelsPage.data));
    listDatasets().then(setExistingDatasets);
    setDataset("");
    setCreating(false);
  }, [open, client]);

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
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          disabled={baseModel === "" || dataset === "" || creating}
          onClick={handleCreate}
          variant="contained"
        >
          {creating && <CircularProgress size={16} sx={{ marginRight: 1 }} />}
          {t("Create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FinetunePanel() {
  const [finetuneJobs, setFinetuneJobs] = useState<FineTuningJob[] | null>(
    null
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const client = useOpenAIClient();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();

  const listJobs = useCallback(async () => {
    const res = await client.fineTuning.jobs.list();
    setFinetuneJobs(res.data);
  }, [client]);

  useEffect(() => {
    listJobs();
  }, [listJobs]);

  const selectedJob =
    selectedJobId === null || finetuneJobs === null
      ? undefined
      : finetuneJobs.find((j) => j.id === selectedJobId);

  const selectedJobDetail = selectedJob && (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        {selectedJob.id}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("Status")}: {selectedJob.status}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("Model")}: {selectedJob.model}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("Fine-tuned model")}: {selectedJob.fine_tuned_model ?? "-"}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("Created at")}:{" "}
        {new Date(selectedJob.created_at * 1000).toLocaleString()}
      </Typography>
    </Box>
  );

  return (
    <Card elevation={0} sx={{ height: "100%" }}>
      <Stack divider={<Divider />} sx={{ height: "100%" }}>
        <Box sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t("Fine-tuning jobs")}
          </Typography>
          <Stack direction="row">
            <Button
              variant="outlined"
              onClick={() => setSelectedJobId(null)}
              sx={{
                display: {
                  xs: selectedJobId ? "inline-flex" : "none",
                  sm: "none",
                },
              }}
            >
              {t("Back")}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              onClick={() => setShowCreateDialog(true)}
            >
              {t("Create")}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
          <Stack
            direction="row"
            divider={<Divider orientation="vertical" flexItem />}
            sx={{ height: "100%" }}
          >
            {isMobile && selectedJobDetail ? null : (
              <Box
                sx={{
                  width: isMobile ? "100%" : "260px",
                  overflowY: "auto",
                  display: "flex",
                }}
              >
                {finetuneJobs === null ? (
                  <CircularProgress sx={{ margin: "auto" }} />
                ) : (
                  <List disablePadding sx={{ width: "100%" }}>
                    {finetuneJobs.map((job) => (
                      <ListItem
                        key={job.id}
                        disablePadding
                        secondaryAction={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ userSelect: "none" }}
                          >
                            {job.status}
                          </Typography>
                        }
                      >
                        <ListItemButton
                          selected={job.id === selectedJobId}
                          onClick={() =>
                            setSelectedJobId((value) =>
                              value === job.id ? null : job.id
                            )
                          }
                        >
                          <ListItemText
                            primary={job.id}
                            secondary={new Date(
                              job.created_at * 1000
                            ).toLocaleString()}
                            slotProps={{
                              primary: { noWrap: true },
                              secondary: { noWrap: true },
                            }}
                          />
                          <ListItemIcon></ListItemIcon>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}
            {!isMobile ? <Box>{selectedJobDetail}</Box> : selectedJobDetail}
          </Stack>
        </Box>
      </Stack>

      <CreateFinetuneJobDialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          listJobs();
        }}
      />
    </Card>
  );
}

export default FinetunePanel;
