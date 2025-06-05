import {
  Add as AddIcon,
  ArrowUpward as ArrowUpwardIcon,
  Camera as CameraIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import BrushIcon from "@mui/icons-material/Brush";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import { ResponseInputMessageContentList } from "openai/resources/responses/responses.mjs";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import SearchModeChip from "./SearchModeChip";
import { CreateResponseParams } from "../app/thunks";
import { useAppSelector } from "../app/hooks";
import { TOOL_DEFAULT_MCP, TOOL_PYTHON } from "../app/tools-definitions";

export interface Abortable {
  abort: () => void;
}

function urlBase64ToUint8Array(base64String: string) {
  return new Uint8Array(
    atob(base64String.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

function readImages(images: string[]) {
  const imagesBase64 = images.map(async (image) => {
    const res = await fetch(image);
    const blob = await res.blob();
    const reader = new FileReader();
    return new Promise<string>((resolve) => {
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  });

  return Promise.all(imagesBase64);
}

function InputArea({
  abortable,
  onResearch,
  onSearch,
  onSearchImage,
  onGenerateImage,
  onChat,
}: {
  abortable?: Abortable;
  onResearch: (task: string) => void;
  onSearch: (query: string) => void;
  onSearchImage: (query: string) => void;
  onGenerateImage: (prompt: ResponseInputMessageContentList) => void;
  onChat: (
    message: ResponseInputMessageContentList,
    options?: CreateResponseParams
  ) => void;
}) {
  const [searchMode, setSearchMode] = useState<
    "auto" | "webpage" | "image" | "deep-research" | undefined
  >(undefined);
  const [enableResearch, setEnableResearch] = useState(false);
  const [enableGenerateImage, setEnableGenerateImage] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const toolsProvider = useAppSelector((state) => state.provider.toolsProvider);

  const { t } = useTranslation();

  const handleSend = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage("");
      if (searchMode === "webpage") {
        onSearch(message);
      } else if (searchMode === "image") {
        onSearchImage(message);
      } else if (searchMode === "deep-research") {
        onResearch(message);
      } else if (enableGenerateImage) {
        readImages(images).then((base64Images) => {
          const imageData = base64Images.map((base64) => ({
            type: "input_image" as const,
            detail: "low" as const,
            image_url: base64,
          }));
          onGenerateImage([
            ...imageData,
            { type: "input_text", text: message },
          ]);
        });
        setImages([]);
      } else {
        if (images.length) {
          readImages(images).then((base64Images) => {
            const imageData = base64Images.map((base64) => ({
              type: "input_image" as const,
              detail: "low" as const,
              image_url: base64,
            }));
            onChat([...imageData, { type: "input_text", text: message }]);
          });
          setImages([]);
          return;
        } else {
          onChat([{ type: "input_text", text: message }], {
            tools:
              searchMode === "auto"
                ? toolsProvider === "openai-builtin"
                  ? [
                      { type: "web_search_preview" },
                      { type: "code_interpreter", container: { type: "auto" } },
                    ]
                  : [TOOL_DEFAULT_MCP, TOOL_PYTHON]
                : undefined,
            model: searchMode === "auto" ? "gpt-4.1-mini" : undefined,
          });
        }
      }
    },
    [
      searchMode,
      enableResearch,
      enableGenerateImage,
      message,
      images,
      onChat,
      onResearch,
      onSearch,
      onSearchImage,
      onGenerateImage,
    ]
  );

  return (
    <Stack
      component="form"
      onSubmit={handleSend}
      sx={{ width: "100%", padding: 1 }}
    >
      <Card variant="outlined" elevation={0} sx={{ borderRadius: "24px" }}>
        {images.length > 0 && (
          <>
            <Stack
              direction="row"
              gap={1}
              sx={{ margin: 1.5, overflowX: "auto" }}
            >
              {images.map((image, index) => (
                <Box
                  key={index}
                  sx={{
                    position: "relative",
                    flexShrink: 0,
                    display: "flex",
                    borderRadius: 3,
                    overflow: "hidden",
                    "&>img": { objectFit: "cover" },
                  }}
                >
                  <img
                    src={image}
                    alt={`Image ${index + 1}`}
                    width="96"
                    height="96"
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setImages((prev) => prev.filter((_, i) => i !== index));
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "24px",
                      height: "24px",
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      color: "white",
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                      },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Divider />
          </>
        )}
        <InputBase
          inputRef={inputRef}
          multiline
          placeholder={t("Send message...")}
          required
          value={message}
          fullWidth
          minRows={2}
          maxRows={12}
          autoFocus
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.form!;
              if (form.checkValidity()) form.requestSubmit();
            }
          }}
          onFocus={() => setShowPanel(false)}
          sx={{
            padding: 0,
            "&>.MuiInputBase-input": { paddingX: 2, paddingTop: 1.5 },
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ padding: 1.5 }}
        >
          <SearchModeChip
            value={searchMode}
            onChange={(mode) => {
              setSearchMode(mode);
              setEnableGenerateImage(false);

              if (mode === "deep-research") {
                navigator.serviceWorker
                  .getRegistration()
                  .then(async (registration) => {
                    if (!registration) return;
                    const subscription =
                      await registration.pushManager.getSubscription();
                    if (subscription) return;
                    const SERVER_PUBLIC_KEY =
                      "BGQRGebCwAzQGNxKag65PqQdQSE4wOlPLN36wpyVIMFzXKg58AgsoSVFiBi9IJrRNqHBxsftMNvwAN5Ki5AOe8A";
                    await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey:
                        urlBase64ToUint8Array(SERVER_PUBLIC_KEY),
                    });
                  });
              }
              inputRef.current?.focus();
            }}
            onMenuClose={() => {
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          />
          <Chip
            label={t("Generate Image")}
            color={enableGenerateImage ? "primary" : "default"}
            icon={<BrushIcon fontSize="small" />}
            onClick={() => {
              setEnableGenerateImage(!enableGenerateImage);
              setSearchMode(undefined);
              setEnableResearch(false);
              navigator.vibrate?.(1);
              inputRef.current?.focus();
            }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            aria-label={t("Add")}
            size="small"
            onClick={() => {
              setShowPanel((showPanel) => !showPanel);
              if (showPanel && inputRef.current) {
                inputRef.current.focus();
              }
            }}
          >
            <AddIcon
              sx={{
                transform: showPanel ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </IconButton>
          {abortable ? (
            <IconButton
              aria-label={t("Stop")}
              size="small"
              sx={{
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
              }}
              onClick={() => abortable.abort()}
            >
              <StopIcon />
            </IconButton>
          ) : (
            <IconButton
              type="submit"
              aria-label={t("Send")}
              size="small"
              color="primary"
              disabled={!message}
              sx={{
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                "&:hover": { backgroundColor: "primary.dark" },
                "&:disabled": {
                  backgroundColor: "action.disabled",
                  color: "primary.contrastText",
                },
              }}
            >
              <ArrowUpwardIcon />
            </IconButton>
          )}
        </Stack>
      </Card>
      <Collapse in={showPanel}>
        <Grid container>
          <Grid size={{ xs: 4, lg: 2 }}>
            <Card elevation={0} sx={{ margin: 1 }}>
              <CardActionArea component="label">
                <CardMedia
                  sx={{
                    backgroundColor: "background.default",
                    borderRadius: 1,
                    paddingY: 3,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <ImageIcon />
                </CardMedia>
                <CardContent sx={{ padding: 1, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("Image")}
                  </Typography>
                </CardContent>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (!e.target.files) return;
                    const files = Array.from(e.target.files);
                    const imageURLs = files.map((file) =>
                      URL.createObjectURL(file)
                    );
                    setImages((images) => [...images, ...imageURLs]);
                    setShowPanel(false);
                    inputRef.current?.focus();
                    e.target.value = "";
                  }}
                />
              </CardActionArea>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, lg: 2 }}>
            <Card elevation={0} sx={{ margin: 1 }}>
              <CardActionArea component="label">
                <CardMedia
                  sx={{
                    backgroundColor: "background.default",
                    borderRadius: 1,
                    paddingY: 3,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <CameraIcon />
                </CardMedia>
                <CardContent sx={{ padding: 1, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("Camera")}
                  </Typography>
                </CardContent>
                <input
                  type="file"
                  accept="image/*"
                  capture
                  hidden
                  onChange={(e) => {
                    if (!e.target.files) return;
                    const files = Array.from(e.target.files);
                    const imageURLs = files.map((file) =>
                      URL.createObjectURL(file)
                    );
                    setImages((images) => [...images, ...imageURLs]);
                    setShowPanel(false);
                    inputRef.current?.focus();
                    e.target.value = "";
                  }}
                />
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Collapse>
    </Stack>
  );
}

export default InputArea;
