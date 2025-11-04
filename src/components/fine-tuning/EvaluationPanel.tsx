import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
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
  Menu,
  MenuItem,
  Stack,
  SxProps,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import OpenAI from "openai";
import {
  Activity,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useCurrentPreset } from "../presets/hooks";
import {
  DatasetRecord,
  EditableMessage,
} from "./dataset-editor/DatasetRecordEditor";
import { parseDataset } from "./dataset-editor/utils";
import DatasetRecordsSidebar from "./DatasetRecordsSidebar";
import { DatasetFile, listDatasets, readDatasetText } from "./DatasetsPanel";
import DatasetsTable from "./DatasetsTable";

const Markdown = lazy(() =>
  import("../Markdown").then((mod) => ({ default: mod.Markdown }))
);

function TwoColumnLayout({
  left,
  right,
  tab,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  tab: number;
}) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  return !isMobile ? (
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

function ModelMenu({
  models,
  onChange,
  sx,
}: {
  models: string[] | null;
  onChange: (model: string) => void;
  sx?: SxProps;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { t } = useTranslation("fineTuning");

  return (
    <>
      <IconButton
        size="small"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={sx}
      >
        <ArrowDropDownIcon />
      </IconButton>

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {models === null ? (
          <CircularProgress />
        ) : models.length === 0 ? (
          <MenuItem disabled>{t("No data")}</MenuItem>
        ) : (
          models.map((model) => (
            <MenuItem
              key={model}
              value={model}
              onClick={() => {
                onChange(model);
                setAnchorEl(null);
              }}
            >
              {model}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

function AssistantMessageRenderer({
  message,
}: {
  message?: DatasetRecord["completion"] | null;
}) {
  return message === undefined ? null : message === null ? (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        padding: 2,
      }}
    >
      <CircularProgress />
    </Box>
  ) : (
    message[0].content && (
      <Box sx={{ padding: 1 }}>
        <Card variant="outlined" sx={{ borderRadius: 3, padding: 1 }}>
          <Suspense fallback={message[0].content}>
            <Markdown>{message[0].content}</Markdown>
          </Suspense>
        </Card>
      </Box>
    )
  );
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
  const [baseCompletions, setBaseCompletions] = useState<Array<
    DatasetRecord["completion"] | null
  > | null>(null);
  const [finetunedCompletions, setFinetunedCompletions] = useState<Array<
    DatasetRecord["completion"] | null
  > | null>(null);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const currentPreset = useCurrentPreset();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { t } = useTranslation("fineTuning");

  const finetunedModels =
    models && models.filter((model) => model.startsWith("ft:"));

  const handleGenerateAll = useCallback(async () => {
    const prompt = records?.[selectedRecordIndex].prompt;
    if (!prompt) return;

    const client = new OpenAI({
      apiKey: currentPreset?.apiKey,
      baseURL: currentPreset?.baseURL,
      dangerouslyAllowBrowser: true,
    });

    setBaseCompletions((completions) => {
      const newCompletions = completions ? [...completions] : [];
      newCompletions[selectedRecordIndex] = null;
      return newCompletions;
    });
    client.chat.completions
      .create({
        model: baseModel ?? "gpt-oss-120b",
        messages: prompt as any,
        temperature: 0,
      })
      .then((completion) => {
        setBaseCompletions((completions) => {
          const newCompletions = completions ? [...completions] : [];
          newCompletions[selectedRecordIndex] = [completion.choices[0].message];
          return newCompletions;
        });
      });

    setFinetunedCompletions((completions) => {
      const newCompletions = completions ? [...completions] : [];
      newCompletions[selectedRecordIndex] = null;
      return newCompletions;
    });
    client.chat.completions
      .create({
        model: finetunedModel ?? "gpt-oss-120b",
        messages: prompt as any,
        temperature: 0,
      })
      .then((completion) => {
        setFinetunedCompletions((completions) => {
          const newCompletions = completions ? [...completions] : [];
          newCompletions[selectedRecordIndex] = [completion.choices[0].message];
          return newCompletions;
        });
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

        <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
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

          <Container sx={{ padding: 1 }}>
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

          <Box
            sx={{
              position: "sticky",
              top: 0,
              backgroundColor: "background.paper",
            }}
          >
            <TwoColumnLayout
              left={
                <AssistantMessageRenderer
                  message={baseCompletions?.[selectedRecordIndex]}
                />
              }
              right={
                <AssistantMessageRenderer
                  message={finetunedCompletions?.[selectedRecordIndex]}
                />
              }
              tab={tab}
            />
          </Box>
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
