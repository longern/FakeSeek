import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import ReplayIcon from "@mui/icons-material/Replay";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  Divider,
  IconButton,
  InputBase,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
} from "openai/resources/responses/responses.mjs";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import Markdown, { CodeBox } from "./Markdown";
import { CreateResponseParams } from "./app/thunks";
import { TOOL_GOOGLE_SEARCH, TOOL_PYTHON } from "./app/tools-definitions";

export function UserMessage({
  message,
}: {
  message: ResponseInputItem.Message;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);

  const { t } = useTranslation();

  return message.content.map((part, index) => (
    <Fragment key={index}>
      <Box
        sx={{
          maxWidth: "100%",
          overflowWrap: "break-word",
          minWidth: "48px",
          padding: "8px 12px",
          backgroundColor: "#eff6ff",
          borderRadius: "20px",
          marginLeft: 4,
          alignSelf: "flex-end",
          whiteSpace: "pre-wrap",
        }}
        onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
          if (part.type !== "input_text") return;

          const { nativeEvent } = e;
          if (nativeEvent.pointerType === "mouse") return;
          nativeEvent.preventDefault();
          window.getSelection()?.removeAllRanges();
          setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
          setSelectedPart(index);
        }}
      >
        <Box key={index}>
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
      </Box>

      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem
          onClick={async () => {
            const part = message.content[selectedPart!];
            if (part.type !== "input_text") return;
            await navigator.clipboard.writeText(part.text);
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          {t("Copy")}
        </MenuItem>
      </Menu>
    </Fragment>
  ));
}

export function AssistantMessage({
  message,
  onRetry,
}: {
  message: ResponseOutputMessage;
  onRetry: (options?: CreateResponseParams) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [showSelection, setShowSelection] = useState(false);
  const [retryMenuAnchor, setRetryMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  const { t } = useTranslation();

  const handleCopy = useCallback(() => {
    const content = message.content
      .map((part) => (part.type === "refusal" ? part.refusal : part.text))
      .join("\n");
    navigator.clipboard.writeText(content);
    setContextMenu(null);
  }, [message.content]);

  return (
    <>
      <Box
        sx={{
          maxWidth: "100%",
          overflowWrap: "break-word",
          marginRight: 4,
        }}
        onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
          const { nativeEvent } = e;
          if (nativeEvent.pointerType === "mouse") return;
          nativeEvent.preventDefault();
          window.getSelection()?.removeAllRanges();
          setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
        }}
      >
        {message.content.map((part, index) => (
          <Box key={index}>
            {part.type === "output_text" ? (
              <Markdown>{part.text}</Markdown>
            ) : part.type === "refusal" ? (
              <Alert severity="error">{part.refusal}</Alert>
            ) : null}
          </Box>
        ))}

        <Stack direction="row" gap={1} sx={{ marginTop: 1 }}>
          <IconButton
            sx={{ width: "28px", height: "28px", borderRadius: 1 }}
            onClick={handleCopy}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <Button
            size="small"
            sx={{ minWidth: 0, color: "text.secondary" }}
            onClick={(e) => {
              setRetryMenuAnchor(e.currentTarget);
            }}
          >
            <ReplayIcon fontSize="small" />
            <ExpandMoreIcon fontSize="small" />
          </Button>
        </Stack>
      </Box>

      <Menu
        anchorEl={retryMenuAnchor}
        open={Boolean(retryMenuAnchor)}
        onClose={() => setRetryMenuAnchor(null)}
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem
          onClick={() => {
            onRetry({
              model: "o4-mini",
              tools: [TOOL_PYTHON, TOOL_GOOGLE_SEARCH],
            });
            setRetryMenuAnchor(null);
          }}
        >
          o4-mini
        </MenuItem>
        <Divider component="li" />
        <MenuItem
          onClick={() => {
            onRetry();
            setRetryMenuAnchor(null);
          }}
        >
          {t("Retry")}
        </MenuItem>
      </Menu>

      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          {t("Copy")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setShowSelection(true);
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <SelectAllIcon />
          </ListItemIcon>
          {t("Select Text")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onRetry();
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <ReplayIcon />
          </ListItemIcon>
          {t("Retry")}
        </MenuItem>
      </Menu>

      <Dialog
        fullScreen
        open={showSelection}
        onClose={() => setShowSelection(false)}
      >
        <Toolbar
          disableGutters
          sx={{
            position: "sticky",
            top: 0,
            backgroundColor: "background.paper",
            borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
            zIndex: 1,
          }}
        >
          <IconButton
            aria-label="Close"
            size="large"
            onClick={() => setShowSelection(false)}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, textAlign: "center" }}>
            {t("Select Text")}
          </Typography>
          <Box sx={{ width: "48px" }} />
        </Toolbar>
        <InputBase
          multiline
          fullWidth
          value={message.content
            .map((part) =>
              part.type === "output_text" ? part.text : part.refusal
            )
            .join("\n")}
          slotProps={{ input: { readOnly: true } }}
          sx={{ height: "100%", padding: 2, alignItems: "flex-start" }}
        />
      </Dialog>
    </>
  );
}

export function ReasoningContent({
  content,
  reasoning,
}: {
  content: ResponseReasoningItem.Summary[];
  reasoning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const { t } = useTranslation();

  if (!reasoning && content.length === 0) return null;

  return (
    <>
      <Button
        size="small"
        sx={{ paddingX: 1.5 }}
        onClick={() => setExpanded((expanded) => !expanded)}
      >
        {reasoning ? t("Thinking...") : t("Thinking finished")}
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Button>
      <Collapse in={expanded} unmountOnExit>
        <Box
          color="text.secondary"
          sx={{
            marginY: -1,
            paddingLeft: 1,
            borderLeft: "2px solid #ddd",
            fontSize: "0.875rem",
          }}
        >
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
      <Button
        size="small"
        sx={{ paddingX: 1.5 }}
        onClick={() => setExpanded((expanded) => !expanded)}
      >
        {t("Web Search")}
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Button>
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
    return (
      <Box sx={{ marginRight: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (message.status === "incomplete") {
    return (
      <Box sx={{ marginRight: 4 }}>
        <Alert severity="error">{message.output}</Alert>
      </Box>
    );
  }

  switch (toolCall.name) {
    case "search":
      return (
        <Box sx={{ marginRight: 4 }}>
          <SearchResultsContent message={message} />
        </Box>
      );
    case "google_search":
      return (
        <Box sx={{ marginRight: 4 }}>
          <GoogleSearchResultsContent message={message} />
        </Box>
      );
    case "search_image":
      return (
        <Box sx={{ marginRight: 4 }}>
          <SearchImageResultsContent message={message} />
        </Box>
      );
    case "run_python":
      return (
        <Box sx={{ marginRight: 4 }}>
          <RunPythonResultContent message={message} toolCall={toolCall} />
        </Box>
      );
  }
}
