import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import OpenAI, { APIError } from "openai";
import { FineTuningJob } from "openai/resources/fine-tuning/jobs/jobs.mjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Preset } from "../../app/presets";
import { useCurrentPreset } from "../presets/hooks";
import HFLogo from "./hf-logo.svg";
import CreateFinetuneJobDialog from "./CreateFinetuneJobDialog";

const NO_PRESET_ERROR = new Error("No preset selected");

function getClientFromPreset(currentPreset: Preset | null) {
  if (currentPreset === null) throw NO_PRESET_ERROR;

  return new OpenAI({
    apiKey: currentPreset.apiKey,
    baseURL: currentPreset.baseURL,
    dangerouslyAllowBrowser: true,
  });
}

function FinetuneJobDetail({ job: selectedJob }: { job: FineTuningJob }) {
  const currentPreset = useCurrentPreset();
  const { t } = useTranslation("fineTuning");

  const isCancellable = ["validating_files", "queued", "running"].includes(
    selectedJob.status
  );

  return (
    <Stack sx={{ padding: 2 }}>
      <Collapse in={isCancellable}>
        <Box sx={{ marginBottom: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              const confirmed = window.confirm(
                t("confirm-cancel-finetune-job", { id: selectedJob.id })
              );
              if (!confirmed) return;

              const client = getClientFromPreset(currentPreset);
              client.fineTuning.jobs.cancel(selectedJob.id);
            }}
          >
            {t("Cancel")}
          </Button>
        </Box>
      </Collapse>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 1,
          columnGap: 4,
          overflowWrap: "anywhere",
          "&>*": { minHeight: "32px", alignContent: "center" },
        }}
      >
        <Typography>{t("Job ID")}</Typography>
        <Typography>{selectedJob.id}</Typography>

        <Typography>{t("Status")}</Typography>
        <Box>
          <Chip
            label={t(selectedJob.status)}
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

        <Typography>{t("Base model")}</Typography>
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
                aria-label={t("Push to Hub")}
                onClick={() => {
                  const client = getClientFromPreset(currentPreset);
                  const hfToken = window.prompt(
                    t("Enter your Hugging Face token")
                  );
                  if (!hfToken) return;
                  const repoId = window.prompt(
                    t("Enter the Hugging Face repo ID to push to")
                  );
                  if (!repoId) return;
                  client.post(
                    `/models/${selectedJob.fine_tuned_model!}/push_to_hub`,
                    { body: { hf_token: hfToken, repo_id: repoId } }
                  );
                }}
                sx={{ marginLeft: 1 }}
              >
                <Box
                  component="img"
                  src={HFLogo}
                  alt="Push to Hugging Face"
                  sx={{ width: "20px", height: "20px" }}
                />
              </IconButton>
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

      {selectedJob.error && (
        <>
          <Divider sx={{ marginY: 2 }} />
          <Typography color="error">{selectedJob.error.message}</Typography>
        </>
      )}
    </Stack>
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

  const { t } = useTranslation("fineTuning");

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

  const retrieveJob = useCallback(
    async (jobId: string) => {
      try {
        const client = getClientFromPreset(currentPreset);
        const job = await client.fineTuning.jobs.retrieve(jobId);
        return job;
      } catch (e) {
        console.error("Failed to retrieve fine-tuning job", e);
        return null;
      }
    },
    [currentPreset]
  );

  useEffect(() => {
    listJobs();
  }, [listJobs]);

  const selectedJob =
    selectedJobId === null || !Array.isArray(finetuneJobs)
      ? undefined
      : finetuneJobs.find((j) => j.id === selectedJobId);

  const isSelecitedJobFinal =
    selectedJob &&
    ["succeeded", "failed", "cancelled"].includes(selectedJob.status);

  useEffect(() => {
    if (selectedJobId === null || isSelecitedJobFinal) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    const intervalCallback = async () => {
      const job = await retrieveJob(selectedJobId);
      if (!job) return;
      setFinetuneJobs((prevJobs) => {
        if (!(prevJobs instanceof Array)) return prevJobs;
        return prevJobs.map((j) => (j.id === job.id ? job : j));
      });
    };

    intervalCallback();
    interval = setInterval(intervalCallback, 10000);

    return () => clearInterval(interval);
  }, [selectedJobId, isSelecitedJobFinal, retrieveJob]);

  const selectedJobDetail = selectedJob && (
    <FinetuneJobDetail job={selectedJob} />
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
                  paddingX: 1,
                  width: isMobile ? "100%" : "300px",
                  flexShrink: 0,
                  overflowY: "auto",
                }}
                onClick={() => setSelectedJobId(null)}
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
                  <List sx={{ width: "100%" }}>
                    {finetuneJobs.map((job) => (
                      <ListItem key={job.id} disablePadding>
                        <ListItemButton
                          selected={job.id === selectedJobId}
                          sx={{ borderRadius: 2 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedJobId(job.id);
                          }}
                        >
                          <ListItemText
                            primary={job.fine_tuned_model || job.id}
                            secondary={new Date(
                              job.created_at * 1000
                            ).toLocaleString()}
                            slotProps={{
                              primary: { noWrap: true },
                              secondary: { noWrap: true },
                            }}
                          />
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{
                              flexShrink: 0,
                              textWrap: "nowrap",
                              fontSize: "0.8125rem",
                              marginLeft: 1,
                              userSelect: "none",
                            }}
                          >
                            {t(job.status)}
                          </Typography>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            )}
            <Box sx={{ width: "100%", overflowY: "auto" }}>
              {selectedJobDetail}
            </Box>
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
