import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
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
import OpenAI, { APIError } from "openai";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";
import { Model } from "openai/resources/models.mjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listDatasets, readDataset } from "./DatasetsPanel";

import type { Preset } from "../../app/presets";
import { useCurrentPreset } from "./hooks";

function getClientFromPreset(currentPreset: Preset | null) {
  if (currentPreset === null) throw new Error("No preset selected");

  return new OpenAI({
    apiKey: currentPreset.apiKey,
    baseURL: currentPreset.baseURL,
    dangerouslyAllowBrowser: true,
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
  const [baseModels, setBaseModels] = useState<Array<Model>>([]);
  const [existingDatasets, setExistingDatasets] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const currentPreset = useCurrentPreset();
  const { t } = useTranslation();

  const handleCreate = useCallback(async () => {
    const datasetContent = await readDataset(dataset);
    const file = new File([datasetContent], dataset, {
      type: "application/yaml",
    });
    setCreating(true);
    const client = getClientFromPreset(currentPreset);
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
  }, [baseModel, currentPreset, dataset, onClose]);

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
          <Collapse in={creating} orientation="horizontal">
            <CircularProgress size={16} sx={{ marginRight: 1 }} />
          </Collapse>
          {t("Create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FinetunePanel() {
  const [finetuneJobs, setFinetuneJobs] = useState<
    FineTuningJob[] | null | Error
  >(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const currentPreset = useCurrentPreset();

  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();

  const listJobs = useCallback(async () => {
    try {
      const client = getClientFromPreset(currentPreset);
      const res = await client.fineTuning.jobs.list();
      setFinetuneJobs(res.data);
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 404)
          setFinetuneJobs(
            new Error(t("This model provider does not support fine-tuning"))
          );
        else setFinetuneJobs(e);
      } else setFinetuneJobs(e as Error);
    }
  }, [currentPreset]);

  useEffect(() => {
    listJobs();
  }, [listJobs]);

  const selectedJob =
    selectedJobId === null || !Array.isArray(finetuneJobs)
      ? undefined
      : finetuneJobs.find((j) => j.id === selectedJobId);

  const selectedJobDetail = selectedJob && (
    <Stack spacing={2} sx={{ padding: 2 }}>
      {["validating_files", "queued", "running"].includes(
        selectedJob.status
      ) && (
        <Box>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              const client = getClientFromPreset(currentPreset);
              client.fineTuning.jobs.cancel(selectedJob.id);
            }}
          >
            {t("Cancel")}
          </Button>
        </Box>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 1,
          columnGap: 4,
          "&>*": { minHeight: "32px", alignContent: "center" },
        }}
      >
        <Typography>{t("Job ID")}</Typography>
        <Typography>{selectedJob.id}</Typography>

        <Typography>{t("Status")}</Typography>
        <Box>
          <Chip
            label={selectedJob.status}
            size="small"
            color={
              selectedJob.status === "succeeded"
                ? "success"
                : selectedJob.status === "failed"
                ? "error"
                : selectedJob.status === "cancelled"
                ? "default"
                : "info"
            }
          />
        </Box>

        <Typography>{t("Model")}</Typography>
        <Typography>{selectedJob.model}</Typography>

        <Typography>{t("Fine-tuned model")}</Typography>
        <Typography>
          {!selectedJob.fine_tuned_model ? (
            "-"
          ) : (
            <>
              {selectedJob.fine_tuned_model}
              <IconButton
                size="small"
                aria-label={t("Delete")}
                onClick={() => {
                  const confirmed = window.confirm(
                    t("confirm-delete-finetuned-model", {
                      model: selectedJob.fine_tuned_model,
                    })
                  );
                  if (!confirmed) return;
                  const client = getClientFromPreset(currentPreset);
                  client.models.delete(selectedJob.fine_tuned_model!);
                }}
                sx={{ marginLeft: 1 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Typography>

        <Typography>{t("Created at")}</Typography>
        <Typography>
          {new Date(selectedJob.created_at * 1000).toLocaleString()}
        </Typography>

        <Typography>{t("Finished at")}</Typography>
        <Typography>
          {selectedJob.finished_at === null
            ? "-"
            : new Date(selectedJob.finished_at * 1000).toLocaleString()}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Card elevation={0} sx={{ height: "100%", borderRadius: 0 }}>
      <Stack divider={<Divider />} sx={{ height: "100%" }}>
        <Box sx={{ padding: 2 }}>
          {!isMobile && (
            <Typography variant="h6" gutterBottom>
              {t("Fine-tuning jobs")}
            </Typography>
          )}
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
              disabled={currentPreset === null}
              onClick={() => setShowCreateDialog(true)}
            >
              {t("Create")}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
          <Stack
            direction="row"
            divider={
              isMobile ? null : <Divider orientation="vertical" flexItem />
            }
            sx={{ height: "100%" }}
          >
            {isMobile && selectedJobDetail ? null : (
              <Box
                sx={{
                  padding: 1,
                  width: isMobile ? "100%" : "300px",
                  flexShrink: 0,
                  overflowY: "auto",
                }}
              >
                {finetuneJobs instanceof Error || !finetuneJobs?.length ? (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {finetuneJobs === null ? (
                      <CircularProgress sx={{ margin: "auto" }} />
                    ) : finetuneJobs instanceof Error ? (
                      <Typography color="text.secondary">
                        {finetuneJobs.message}
                      </Typography>
                    ) : (
                      t("No fine-tuning jobs found")
                    )}
                  </Box>
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
                          sx={{ borderRadius: 2 }}
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
            <Box sx={{ width: "100%" }}>{selectedJobDetail}</Box>
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
