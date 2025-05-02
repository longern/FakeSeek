import {
  Add as AddIcon,
  ArrowUpward as ArrowUpwardIcon,
  Camera as CameraIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Search as SearchIcon,
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
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

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
  stopController,
  onResearch,
  onSearch,
  onGenerateImage,
  onChat,
}: {
  stopController?: AbortController;
  onResearch: (task: string) => void;
  onSearch: (query: string) => void;
  onGenerateImage: (prompt: ResponseInputMessageContentList) => void;
  onChat: (message: ResponseInputMessageContentList) => void;
}) {
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableResearch, setEnableResearch] = useState(false);
  const [enableGenerateImage, setEnableGenerateImage] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const { t } = useTranslation();

  const handleSend = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage("");
      if (enableSearch) {
        onSearch(message);
      } else if (enableResearch) {
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
          onChat([{ type: "input_text", text: message }]);
        }
      }
    },
    [enableSearch, enableResearch, enableGenerateImage, message]
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
          multiline
          placeholder={t("Send message...")}
          required
          value={message}
          fullWidth
          sx={{
            minHeight: "48px",
            borderRadius: "24px",
            padding: "0.5rem 1rem",
          }}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.form!;
              if (form.checkValidity()) form.requestSubmit();
            }
          }}
        />
      </Card>
      <Stack direction="row" alignItems="center" gap={1} sx={{ paddingY: 1 }}>
        <Chip
          label={t("Research")}
          color={enableResearch ? "primary" : "default"}
          onClick={() => {
            if (!enableResearch) Notification.requestPermission();
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
            setEnableResearch(!enableResearch);
            setEnableSearch(false);
            setEnableGenerateImage(false);
            navigator.vibrate?.(1);
          }}
        />
        <Chip
          label={t("Search")}
          color={enableSearch ? "primary" : "default"}
          icon={<SearchIcon />}
          onClick={() => {
            setEnableSearch(!enableSearch);
            setEnableResearch(false);
            setEnableGenerateImage(false);
            navigator.vibrate?.(1);
          }}
        />
        <Chip
          label={t("Generate Image")}
          color={enableGenerateImage ? "primary" : "default"}
          icon={<BrushIcon />}
          onClick={() => {
            setEnableGenerateImage(!enableGenerateImage);
            setEnableSearch(false);
            setEnableResearch(false);
            navigator.vibrate?.(1);
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label={t("Add")}
          size="small"
          onClick={() => setShowPanel((showPanel) => !showPanel)}
        >
          <AddIcon />
        </IconButton>
        {stopController ? (
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
            onClick={() => stopController.abort("User manually stopped")}
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
              "&:hover": {
                backgroundColor: "primary.dark",
              },
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
