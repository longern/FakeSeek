import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReplayIcon from "@mui/icons-material/Replay";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  IconButton,
  InputBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import { Image } from "openai/resources.mjs";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
} from "openai/resources/responses/responses.mjs";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import Markdown from "./Markdown";

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
          marginLeft: "64px",
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
            <img src={part.image_url!} alt="Input Image" />
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
  onRetry: () => void;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [showSelection, setShowSelection] = useState(false);

  const { t } = useTranslation();

  return (
    <>
      <Box
        sx={{ maxWidth: "100%", overflowWrap: "break-word" }}
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
              part.refusal
            ) : null}
          </Box>
        ))}
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
          onClick={() => {
            const content = message.content
              .map((part) =>
                part.type === "refusal" ? part.refusal : part.text
              )
              .join("\n");
            navigator.clipboard.writeText(content);
            setContextMenu(null);
          }}
        >
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
  content: string;
  reasoning: boolean;
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
        {reasoning ? t("Thinking...") : t("Thinking finished")}
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Button>
      <Collapse in={expanded}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ marginTop: 1, paddingLeft: 1, borderLeft: "4px solid #ccc" }}
        >
          {content}
        </Typography>
      </Collapse>
    </>
  );
}

function GenerateImageContent({
  message,
}: {
  message: ResponseInputItem.FunctionCallOutput;
}) {
  const imageURLs = useMemo(() => {
    const data: Array<Image> = JSON.parse(message.output);
    return data.map((image) => {
      const byteCharacters = atob(image.b64_json!);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      return URL.createObjectURL(
        new Blob([byteNumbers], { type: "image/png" })
      );
    });
  }, [message]);

  return (
    <>
      {imageURLs.map((image, index) => (
        <img key={index} src={image} alt={`Generated Image ${index + 1}`} />
      ))}
    </>
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
      <Box sx={{ marginRight: "64px" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (message.status === "incomplete") {
    return (
      <Box sx={{ marginRight: "64px" }}>
        <Typography color="error">{message.output}</Typography>
      </Box>
    );
  }

  switch (toolCall.name) {
    case "generate_image":
      return (
        <Box sx={{ marginRight: "64px" }}>
          <GenerateImageContent message={message} />
        </Box>
      );
  }
}
