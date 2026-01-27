import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import OpenAI from "openai";
import {
  Response,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseReasoningItem,
} from "openai/resources/responses/responses.mjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  ElementType,
  lazy,
} from "react";
import { useTranslation } from "react-i18next";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { useAppSelector } from "../app/hooks";
import { ChatMessage } from "../app/messages";
import ResponseItem from "./ResponseItem";

const markdownPromise = import("./Markdown");
const Markdown = lazy(() => markdownPromise);
const CodeBox = lazy(() =>
  markdownPromise.then((mod) => ({ default: mod.CodeBox }))
);

export function UserMessage({
  message,
  onContextMenu,
  slots,
}: {
  message: ResponseInputItem.Message & {
    id: string;
    object: "message";
    timestamp: number;
  };
  onContextMenu?: (
    e: React.PointerEvent<HTMLDivElement>,
    { selectedPart }: { selectedPart?: number }
  ) => void;
  slots?: Pick<MessageItemSlots, "messageActions">;
}) {
  const Actions = slots?.messageActions;

  return (
    <Stack
      sx={{ marginLeft: 4, alignSelf: "flex-end", alignItems: "flex-end" }}
    >
      {message.content.map((part, index) => (
        <Box
          key={index}
          sx={{
            maxWidth: "100%",
            wordBreak: "break-word",
            minWidth: "48px",
            padding: "10px 16px",
            backgroundColor: "#edf3fe",
            borderRadius: "22px",
            whiteSpace: "pre-wrap",
          }}
          onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
            if (part.type !== "input_text") return;

            const { nativeEvent } = e;
            if (nativeEvent.pointerType === "mouse") return;
            nativeEvent.preventDefault();
            window.getSelection()?.removeAllRanges();
            onContextMenu?.(e, { selectedPart: index });
          }}
        >
          {part.type === "input_text" ? (
            part.text
          ) : part.type === "input_image" ? (
            <PhotoProvider bannerVisible={false}>
              <PhotoView src={part.image_url!}>
                <img src={part.image_url!} alt="Input Image" />
              </PhotoView>
            </PhotoProvider>
          ) : null}
        </Box>
      ))}

      {Actions && <Actions message={message} />}
    </Stack>
  );
}

export function UserMessageContextMenu({
  open,
  onClose,
  anchorPosition,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
  payload?: { message: ChatMessage; selectedPart?: number };
}) {
  const { t } = useTranslation();

  const handleCopyClick = useCallback(async () => {
    if (!payload) return;
    const { message, selectedPart } = payload;
    if (message.object !== "message" || selectedPart === undefined) return;
    const part = message.content[selectedPart];
    if (part.type !== "input_text") return;
    await navigator.clipboard.writeText(part.text);
    onClose();
  }, [onClose, payload]);

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      slotProps={{ list: { sx: { minWidth: "160px" } } }}
    >
      <MenuItem onClick={handleCopyClick}>
        <ListItemIcon>
          <ContentCopyIcon />
        </ListItemIcon>
        {t("Copy")}
      </MenuItem>
    </Menu>
  );
}

function ImageAnnotation({
  annotation,
}: {
  annotation: ResponseOutputText.FileCitation & { filename: string };
}) {
  const [imageDateUrl, setImageDateUrl] = useState<string | null>(null);
  const preset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets?.[state.presets.current]
  );

  useEffect(() => {
    const { apiKey, baseURL } = preset || {};
    const client = new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    client.files.content(annotation.file_id).then(async (response) => {
      const blob = await response.blob();
      setImageDateUrl(URL.createObjectURL(blob));
    });
  }, [annotation.file_id, preset?.apiKey, preset?.baseURL]);

  if (!imageDateUrl) return;

  return (
    <PhotoView key={annotation.file_id} src={imageDateUrl}>
      <Box
        sx={{
          "&>img": { objectFit: "contain", backgroundColor: "black" },
        }}
      >
        <img
          src={imageDateUrl}
          alt={annotation.filename}
          width="150"
          height="150"
        />
      </Box>
    </PhotoView>
  );
}

function ImageAnnotationList({
  annotations,
}: {
  annotations: (ResponseOutputText.FileCitation & { filename: string })[];
}) {
  return (
    <PhotoProvider>
      <Stack gap={0.5} sx={{ flexDirection: "row", flexWrap: "wrap" }}>
        {annotations.map((annotation) => (
          <ImageAnnotation key={annotation.file_id} annotation={annotation} />
        ))}
      </Stack>
    </PhotoProvider>
  );
}

function FileAnnotationList({
  annotations,
}: {
  annotations: (ResponseOutputText.FileCitation & { filename?: string })[];
}) {
  const imageFilter = (annotation: (typeof annotations)[number]) => {
    if (!annotation.filename) return false;
    const ext = annotation.filename.split(".").pop()?.toLowerCase();
    if (!ext) return false;
    return ["png", "jpg", "jpeg", "gif"].includes(ext);
  };
  const imageAnnotations = annotations.filter(
    imageFilter
  ) as (ResponseOutputText.FileCitation & { filename: string })[];
  const nonImageAnnotations = annotations.filter(
    (annotation) => !imageFilter(annotation)
  );

  return (
    <>
      {imageAnnotations.length > 0 && (
        <ImageAnnotationList annotations={imageAnnotations} />
      )}
      {nonImageAnnotations.length > 0 && (
        <Box
          sx={{ marginY: 2, display: "flex", flexDirection: "column", gap: 1 }}
        >
          {nonImageAnnotations.map((annotation) => (
            <Box key={annotation.file_id}>
              <Typography variant="body2" color="text.secondary">
                {annotation.filename || annotation.file_id}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}

function UrlAnnotationList({
  annotations,
}: {
  annotations: Array<ResponseOutputText.URLCitation>;
}) {
  const [showAnnotations, setShowAnnotations] = useState(false);

  const { t } = useTranslation();

  if (annotations.length === 0) return null;

  return (
    <>
      <Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowAnnotations((prev) => !prev)}
        >
          {t("Found {{count}} results", {
            count: annotations.length,
          })}
          <NavigateNextIcon fontSize="small" />
        </Button>
      </Box>

      <Dialog open={showAnnotations} onClose={() => setShowAnnotations(false)}>
        <List disablePadding>
          {annotations.map((annotation, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                component="a"
                href={annotation.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListItemText
                  primary={<Typography noWrap>{annotation.title}</Typography>}
                  secondary={
                    <Typography variant="body2" noWrap color="text.secondary">
                      {annotation.url}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Dialog>
    </>
  );
}

function AnnotationList({
  annotations,
}: {
  annotations: ResponseOutputText["annotations"];
}) {
  const fileAnnotations = annotations.filter(
    (annotation) =>
      annotation.type === "file_citation" ||
      (annotation.type as any) === "container_file_citation"
  ) as ResponseOutputText.FileCitation[];
  const urlAnnotations = annotations.filter(
    (annotation) => annotation.type === "url_citation"
  );

  return (
    <>
      {fileAnnotations.length > 0 && (
        <FileAnnotationList annotations={fileAnnotations} />
      )}
      {urlAnnotations.length > 0 && (
        <UrlAnnotationList annotations={urlAnnotations} />
      )}
    </>
  );
}

export function AssistantMessage({
  message,
  onContextMenu,
}: {
  message: ResponseOutputMessage;
  onContextMenu?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      <Box
        sx={{ maxWidth: "100%", overflowWrap: "break-word" }}
        onContextMenu={onContextMenu}
      >
        {message.content.map((part, index) => (
          <Box key={index}>
            {part.type === "output_text" ? (
              <>
                <Markdown>{part.text}</Markdown>
                <AnnotationList annotations={part.annotations} />
              </>
            ) : part.type === "refusal" ? (
              <Alert severity="error">{part.refusal}</Alert>
            ) : null}
          </Box>
        ))}
      </Box>
    </>
  );
}

export function ReasoningContent({
  message,
}: {
  message: ResponseReasoningItem;
}) {
  const [expanded, setExpanded] = useState(false);

  const { t } = useTranslation();

  const reasoning = message.status !== "completed";
  const content = message.content || message.summary;
  if (!reasoning && content.length === 0) return null;

  return (
    <>
      <Box
        sx={{
          position: expanded ? "sticky" : "static",
          top: 0,
          width: "100%",
          zIndex: 1,
          background: (theme) =>
            `linear-gradient(to top, transparent 0, ${
              theme.palette.background.paper
            } ${theme.spacing(1)})`,
          marginTop: 1,
          paddingBottom: 0.5,
        }}
      >
        <Link
          component="button"
          underline="none"
          sx={{
            paddingY: 0.5,
            display: "flex",
            gap: 1,
            alignItems: "center",
            fontSize: "0.925rem",
            color: "text.secondary",
            transition: "color 0.25s ease-in-out",
            ":hover": { color: "rgba(0, 0, 0, 0.4)" },
            ":active": { color: "rgba(0, 0, 0, 0.35)" },
          }}
          onClick={() => setExpanded((expanded) => !expanded)}
        >
          {reasoning ? t("Thinking...") : t("Thought")}
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              transform: expanded ? "rotate(0)" : "rotate(-90deg)",
              transition: "transform 0.25s ease-in-out",
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </Box>
        </Link>
      </Box>

      <Collapse in={expanded} timeout={150} unmountOnExit>
        <Box
          color="text.secondary"
          sx={{
            position: "relative",
            marginTop: -1,
            marginBottom: -1,
            paddingLeft: 2.5,
            fontSize: "0.875rem",
          }}
        >
          <Divider
            orientation="vertical"
            sx={{ position: "absolute", left: "6px" }}
          />
          {content.map((part, index) => (
            <Markdown key={index}>{part.text}</Markdown>
          ))}
        </Box>
      </Collapse>
    </>
  );
}

export function GenerateImageContent({
  message,
}: {
  message: ResponseInputItem.ImageGenerationCall;
}) {
  const image = useMemo(() => {
    const byteCharacters = atob(message.result!);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([byteNumbers], { type: "image/png" }));
  }, [message]);

  const alt = (message as any).revised_prompt ?? `Generated Image`;

  return (
    <PhotoProvider bannerVisible={false}>
      <PhotoView src={image}>
        <img src={image} alt={alt} title={alt} />
      </PhotoView>
    </PhotoProvider>
  );
}

interface SearchResults {
  items: Array<{
    title: string;
    htmlTitle: string;
    link: string;
    formattedUrl: string;
    htmlFormattedUrl: string;
    snippet: string;
  }>;
}

function SearchResultsContent({
  message,
}: {
  message: ResponseInputItem.FunctionCallOutput;
}) {
  const results = useMemo(() => {
    return JSON.parse(message.output) as SearchResults["items"];
  }, [message]);

  return (
    <Stack gap={3.5}>
      {results.map((result, index) => (
        <Box key={index}>
          <Link
            href={result.link}
            underline="hover"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Typography variant="h6" component="h3">
              {result.title}
            </Typography>
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  display: "inline-block",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {result.link}
              </Typography>
            </Box>
          </Link>
          <Box sx={{ overflowWrap: "break-word" }}>{result.snippet}</Box>
        </Box>
      ))}
    </Stack>
  );
}

function GoogleSearchResultsContent({
  message,
}: {
  message: ResponseInputItem.FunctionCallOutput;
}) {
  const [expanded, setExpanded] = useState(false);

  const { t } = useTranslation();

  return (
    <>
      <Box>
        <Button
          variant="outlined"
          size="small"
          sx={{ paddingX: 1.5 }}
          onClick={() => setExpanded((expanded) => !expanded)}
        >
          {t("Web Search")}
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Button>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={{
            "& ul": { listStyle: "none", marginY: 0, paddingLeft: 0 },
            "& li>p": { marginY: 0 },
            "& li": { marginY: 1 },
          }}
        >
          <Markdown children={message.output} />
        </Box>
      </Collapse>
    </>
  );
}

interface SearchImageResults {
  items: Array<{
    title: string;
    htmlTitle: string;
    link: string;
    displayLink: string;
    image: {
      contextLink: string;
      thumbnailLink: string;
      thumbnailHeight: number;
      thumbnailWidth: number;
    };
  }>;
}

function SearchImageResultsContent({
  message,
}: {
  message: ResponseInputItem.FunctionCallOutput;
}) {
  const results = useMemo(() => {
    return JSON.parse(message.output) as SearchImageResults["items"];
  }, [message]);

  return (
    <PhotoProvider
      toolbarRender={({ index }) => (
        <IconButton
          href={results[index].image.contextLink}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "white", opacity: 0.75 }}
        >
          <LinkIcon />
        </IconButton>
      )}
    >
      <Stack gap={0.5} sx={{ flexDirection: "row", flexWrap: "wrap" }}>
        {results.map((result) => (
          <PhotoView key={result.link} src={result.link}>
            <Box
              sx={{
                "&>img": { objectFit: "contain", backgroundColor: "black" },
              }}
            >
              <img
                src={result.image.thumbnailLink}
                alt={result.title}
                width="150"
                height="150"
              />
            </Box>
          </PhotoView>
        ))}
      </Stack>
    </PhotoProvider>
  );
}

export function RunPythonContent() {
  const { t } = useTranslation();

  return (
    <Box sx={{ marginY: 1 }}>
      <Stack
        component="span"
        direction="row"
        gap={0.5}
        sx={{ alignItems: "center" }}
      >
        <CodeIcon sx={{ color: "text.secondary" }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          <Box component="span" sx={{ userSelect: "none" }}>
            {t("Run Python code")}
          </Box>
        </Typography>
      </Stack>
    </Box>
  );
}

function RunPythonResultInner({
  message,
  toolCall,
}: {
  message: ResponseInputItem.FunctionCallOutput;
  toolCall: ResponseFunctionToolCall;
}) {
  const result = useMemo(() => {
    return JSON.parse(message.output) as {
      run: { stdout: string; stderr: string };
    };
  }, [message]);

  const { code } = useMemo(() => {
    return JSON.parse(toolCall.arguments) as { code: string };
  }, [toolCall]);

  return (
    <>
      <Box sx={{ marginTop: 1 }}>
        <CodeBox language="python">{code}</CodeBox>
      </Box>
      <Box sx={{ marginTop: 1 }}>
        <CodeBox language="output">{result.run.stdout}</CodeBox>
      </Box>
    </>
  );
}

function RunPythonResultContent({
  message,
  toolCall,
}: {
  message: ResponseInputItem.FunctionCallOutput;
  toolCall: ResponseFunctionToolCall;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <Box>
      <Button
        variant="outlined"
        size="small"
        sx={{ paddingX: 1.5 }}
        onClick={() => setExpanded((expanded) => !expanded)}
      >
        {t("Execute Code")}
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Button>
      <Collapse in={expanded} unmountOnExit>
        <RunPythonResultInner message={message} toolCall={toolCall} />
      </Collapse>
    </Box>
  );
}

export function FunctionCallOutput({
  message,
  toolCall,
}: {
  message: ResponseInputItem.FunctionCallOutput;
  toolCall?: ResponseFunctionToolCall;
}) {
  if (!toolCall) return message.output;

  if (message.status === "in_progress") {
    return <CircularProgress size={24} />;
  }

  if (message.status === "incomplete") {
    return <Alert severity="error">{message.output}</Alert>;
  }

  switch (toolCall.name) {
    case "search":
      return <SearchResultsContent message={message} />;
    case "google_search":
      return <GoogleSearchResultsContent message={message} />;
    case "search_image":
      return <SearchImageResultsContent message={message} />;
    case "run_python":
      return <RunPythonResultContent message={message} toolCall={toolCall} />;
  }
}

function findToolCall(
  messages: ChatMessage[],
  message: ResponseInputItem.FunctionCallOutput
): ResponseFunctionToolCall | undefined {
  for (const response of messages) {
    if (response.object !== "response") continue;
    for (const item of response.output) {
      if (item.type === "function_call" && item.call_id === message.call_id) {
        return item as ResponseFunctionToolCall;
      }
    }
  }
}

type MessageItemSlots = {
  messageActions?: ElementType<{
    message: ResponseInputItem.Message & {
      id: string;
      object: "message";
      timestamp: number;
    };
  }>;
  responseActions?: ElementType<{
    message: Response & { timestamp: number };
  }>;
};

export function MessageItem({
  message,
  toolCall,
  onContextMenu,
  slots,
}: {
  message: ChatMessage;
  toolCall?: ResponseFunctionToolCall;
  onContextMenu?: (
    e: React.PointerEvent<HTMLDivElement>,
    payload: { message: ChatMessage; selectedPart?: number }
  ) => void;
  slots?: MessageItemSlots;
}) {
  const itemContextMenu = (
    e: React.PointerEvent<HTMLDivElement>,
    payload?: { selectedPart?: number }
  ) => {
    onContextMenu?.(e, { message, ...(payload ?? {}) });
  };

  if (message.object === "message") {
    return (
      <UserMessage
        message={message}
        onContextMenu={itemContextMenu}
        slots={slots}
      />
    );
  } else if (message.object === "function_call_output") {
    return <FunctionCallOutput message={message} toolCall={toolCall} />;
  } else if (message.object === "response") {
    return (
      <ResponseItem
        response={message}
        onContextMenu={itemContextMenu}
        slots={slots}
      />
    );
  } else {
    return null;
  }
}

function MessageList({
  messages,
  onContextMenu,
  slots,
}: {
  messages: ChatMessage[];
  onContextMenu?: (
    e: React.PointerEvent<HTMLDivElement>,
    payload: {
      message: ChatMessage;
      selectedPart?: number;
    }
  ) => void;
  slots?: MessageItemSlots;
}) {
  return (
    <Stack
      gap={1}
      sx={{
        "& img": {
          display: "block",
          maxWidth: "100%",
          maxHeight: "50vh",
          borderRadius: "8px",
        },
      }}
    >
      {messages.map((response, index) => {
        const toolCall =
          response.object === "function_call_output"
            ? findToolCall(messages.slice(0, index), response)
            : undefined;
        return (
          <MessageItem
            key={response.id}
            message={response}
            onContextMenu={onContextMenu}
            toolCall={toolCall}
            slots={slots}
          />
        );
      })}
    </Stack>
  );
}

export default MessageList;
