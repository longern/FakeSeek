import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import OpenAI from "openai";
import {
  EasyInputMessage,
  Response,
  ResponseInputContent,
} from "openai/resources/responses/responses.mjs";
import { Activity, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import responseReducer from "@/app/reducer";
import { getRequestAPI } from "@/app/thunks";
import { useCurrentPreset } from "@/components/presets/hooks";
import ResponseItem from "@/components/ResponseItem";
import {
  DatasetRecord,
  EditableMessage,
} from "../dataset-editor/DatasetRecordEditor";
import { parseDataset } from "../dataset-editor/utils";
import { DatasetFile, listDatasets, readDatasetText } from "../DatasetsPanel";
import DatasetRecordsSidebar from "./DatasetRecordsSidebar";
import DatasetsTable from "./DatasetsTable";
import ModelMenu from "./ModelMenu";

function TwoColumnLayout({
  variant,
  left,
  right,
  tab,
}: {
  variant: "side-by-side" | "tabbed";
  left: React.ReactNode;
  right: React.ReactNode;
  tab: number;
}) {
  return variant === "side-by-side" ? (
    <Stack direction="row">
      <Box sx={{ flexBasis: "50%", flexShrink: 0, minWidth: 0 }}>{left}</Box>
      <Box sx={{ flexBasis: "50%", flexShrink: 0, minWidth: 0 }}>{right}</Box>
    </Stack>
  ) : (
    <>
      <Activity mode={tab === 0 ? "visible" : "hidden"}>{left}</Activity>
      <Activity mode={tab === 1 ? "visible" : "hidden"}>{right}</Activity>
    </>
  );
}

function normMessage(
  prompt: {
    role: string;
    content:
      | string
      | Array<
          { type: "text"; text: string } | { type: "image"; image: string }
        >;
  }[]
): EasyInputMessage[] {
  return prompt.map((part) => ({
    type: "message",
    role: part.role as "user" | "assistant" | "system" | "developer",
    content: Array.isArray(part.content)
      ? part.content.map((item): ResponseInputContent => {
          switch (item.type) {
            case "text":
              return { type: "input_text", text: item.text };
            case "image":
              return {
                type: "input_image",
                image_url: item.image,
                detail: "auto",
              };
          }
        })
      : part.content,
  }));
}

function ComparePanel({
  datasetName,
  onBack,
}: {
  datasetName: string;
  onBack?: () => void;
}) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [baseModel, setBaseModel] = useState<string | null>(null);
  const [finetunedModel, setFinetunedModel] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [records, setRecords] = useState<DatasetRecord[] | null>(null);
  const [baseResponses, setBaseResponses] = useState<
    Array<(Response & { timestamp: number }) | null>
  >([]);
  const [finetunedResponses, setFinetunedResponses] = useState<
    Array<(Response & { timestamp: number }) | null>
  >([]);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const currentPreset = useCurrentPreset();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { t } = useTranslation("fineTuning");

  const finetunedModels =
    models && models.filter((model) => model.startsWith("ft:"));

  const handleGenerateAll = useCallback(async () => {
    const prompt = records?.[selectedRecordIndex].prompt;
    if (!prompt) return;

    const requestAPI = getRequestAPI(currentPreset?.apiMode ?? "responses");

    setBaseResponses((responses) => {
      const newResponses = [...responses];
      newResponses[selectedRecordIndex] = null;
      return newResponses;
    });
    requestAPI(normMessage(prompt), {
      model: baseModel ?? "gpt-oss-120b",
      apiKey: currentPreset?.apiKey,
      baseURL: currentPreset?.baseURL,
      temperature: 0,
      onStreamEvent: (_, event) => {
        setBaseResponses((responses) => {
          const newResponses = [...responses];
          const oldValue = newResponses[selectedRecordIndex];
          if (event.type === "response.created")
            newResponses[selectedRecordIndex] = Object.assign(event.response, {
              timestamp: Date.now(),
            });
          else if (oldValue) {
            newResponses[selectedRecordIndex] = {
              ...responseReducer(oldValue, event),
              timestamp: oldValue.timestamp,
            };
          }
          return newResponses;
        });
      },
    });

    setFinetunedResponses((responses) => {
      const newResponses = responses ? [...responses] : [];
      newResponses[selectedRecordIndex] = null;
      return newResponses;
    });
    requestAPI(normMessage(prompt), {
      model: finetunedModel!,
      apiKey: currentPreset?.apiKey,
      baseURL: currentPreset?.baseURL,
      temperature: 0,
      onStreamEvent: (_, event) => {
        setFinetunedResponses((responses) => {
          const newResponses = responses ? [...responses] : [];
          const oldValue = newResponses[selectedRecordIndex];
          if (event.type === "response.created")
            newResponses[selectedRecordIndex] = Object.assign(event.response, {
              timestamp: Date.now(),
            });
          else if (oldValue) {
            newResponses[selectedRecordIndex] = {
              ...responseReducer(oldValue, event),
              timestamp: oldValue.timestamp,
            };
          }
          return newResponses;
        });
      },
    });
  }, [records, selectedRecordIndex, baseModel, finetunedModel, currentPreset]);

  useEffect(() => {
    readDatasetText(datasetName).then((content) => {
      const { dataset } = parseDataset(content);
      setRecords(dataset);
    });
  }, [datasetName]);

  useEffect(() => {
    if (currentPreset === null) return;
    const client = new OpenAI({
      apiKey: currentPreset.apiKey,
      baseURL: currentPreset.baseURL,
      dangerouslyAllowBrowser: true,
    });
    client.models
      .list()
      .then((res) => {
        const modelNames = res.data.map((model) => model.id);
        setModels(modelNames);
        const baseModels = modelNames.filter((name) => !name.startsWith("ft:"));
        if (baseModels.length === 1) setBaseModel(baseModels[0]);
      })
      .catch((reason) => {
        console.error("Failed to fetch model list:", reason);
      });
  }, [currentPreset]);

  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ padding: 2 }}>
        <Stack direction="row" spacing={1} sx={{ marginBottom: 1 }}>
          <IconButton aria-label={t("Back")} size="small" onClick={onBack}>
            <NavigateBeforeIcon />
          </IconButton>
          {isMobile && (
            <IconButton
              aria-label={t("View sidebar")}
              size="small"
              color={showSidebar ? "primary" : "default"}
              onClick={() => setShowSidebar((prev) => !prev)}
            >
              <ViewSidebarOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
            </IconButton>
          )}
          <Typography variant="h6" noWrap>
            {datasetName}
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          disabled={!baseModel || !finetunedModel}
          onClick={handleGenerateAll}
        >
          {t("Generate all")}
        </Button>
      </Box>

      <Stack
        direction="row"
        sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}
        divider={<Divider orientation="vertical" flexItem />}
      >
        <DatasetRecordsSidebar
          in={showSidebar || !isMobile}
          onClose={() => setShowSidebar(false)}
          absolute={isMobile}
          records={records}
          selectedRecordIndex={selectedRecordIndex}
          setSelectedRecordIndex={setSelectedRecordIndex}
        />

        <Box sx={{ flexGrow: 1, overflowY: "auto", paddingBottom: 1 }}>
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              backgroundColor: "background.paper",
            }}
          >
            <Tabs
              variant="fullWidth"
              value={isMobile ? tab : false}
              onChange={(_, newValue) => setTab(newValue)}
            >
              <Tab
                component={!isMobile || tab === 0 ? "div" : "button"}
                value={0}
                label={
                  <Typography
                    color="textPrimary"
                    noWrap
                    sx={{ maxWidth: "100%" }}
                  >
                    {baseModel ?? t("Base model")}
                    {(!isMobile || tab === 0) && (
                      <ModelMenu
                        models={
                          models &&
                          models.filter((model) => !model.startsWith("ft:"))
                        }
                        onChange={(model) => setBaseModel(model)}
                        sx={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "auto",
                        }}
                      />
                    )}
                  </Typography>
                }
                disabled={!isMobile}
                disableRipple
                sx={{
                  position: "relative",
                  borderRight: "1px solid",
                  borderColor: "divider",
                }}
              />

              <Tab
                component={!isMobile || tab === 1 ? "div" : "button"}
                value={1}
                label={
                  <Typography
                    color="textPrimary"
                    noWrap
                    sx={{ maxWidth: "100%" }}
                  >
                    {finetunedModel ?? t("Fine-tuned model")}
                    {(!isMobile || tab === 1) && (
                      <ModelMenu
                        models={finetunedModels}
                        onChange={(model) => setFinetunedModel(model)}
                        sx={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "auto",
                        }}
                      />
                    )}
                  </Typography>
                }
                disabled={!isMobile}
                disableRipple
                sx={{ position: "relative" }}
              />
            </Tabs>
            <Divider />
          </Box>

          <Container sx={{ marginY: 1, paddingX: 1 }}>
            {(records?.[selectedRecordIndex].prompt ?? []).map((part, i) => (
              <Card
                key={i}
                variant="outlined"
                sx={{ borderRadius: 3, overflow: "visible" }}
              >
                <EditableMessage role="user" content={part.content} readonly />
              </Card>
            ))}
          </Container>

          <TwoColumnLayout
            variant={isMobile ? "tabbed" : "side-by-side"}
            left={
              baseResponses[selectedRecordIndex] !== undefined && (
                <Card
                  variant="outlined"
                  sx={{ marginX: 1, padding: 1, borderRadius: 3 }}
                >
                  {baseResponses[selectedRecordIndex] === null ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        paddingY: 2,
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponseItem
                      response={baseResponses[selectedRecordIndex]}
                    />
                  )}
                </Card>
              )
            }
            right={
              finetunedResponses[selectedRecordIndex] !== undefined && (
                <Card
                  variant="outlined"
                  sx={{ marginX: 1, padding: 1, borderRadius: 3 }}
                >
                  {finetunedResponses[selectedRecordIndex] === null ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        paddingY: 2,
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponseItem
                      response={finetunedResponses[selectedRecordIndex]}
                    />
                  )}
                </Card>
              )
            }
            tab={tab}
          />
        </Box>
      </Stack>
    </Stack>
  );
}

function EvaluationPanel() {
  const [datasets, setDatasets] = useState<DatasetFile[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    listDatasets().then((datasets) => {
      setDatasets(datasets);
    });
  }, []);

  return (
    <Card elevation={0} sx={{ height: "100%", borderRadius: 0 }}>
      <Stack sx={{ height: "100%" }} divider={<Divider />}>
        {!isMobile && !selected && (
          <Box sx={{ padding: 2 }}>
            <Typography variant="h6">{t("Evaluation")}</Typography>
          </Box>
        )}

        {selected ? (
          <ComparePanel
            datasetName={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <Box sx={{ overflowY: "auto" }}>
            <DatasetsTable
              datasets={datasets}
              selected={selected}
              setSelected={setSelected}
            />
          </Box>
        )}
      </Stack>
    </Card>
  );
}

export default EvaluationPanel;
