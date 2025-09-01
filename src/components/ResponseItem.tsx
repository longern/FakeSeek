import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import {
  Alert,
  Box,
  Button,
  Dialog,
  Divider,
  IconButton,
  InputBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Response } from "openai/resources/responses/responses.mjs";
import { ElementType, Fragment, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import "react-photo-view/dist/react-photo-view.css";

import { CreateResponseParams } from "../app/thunks";
import { TOOL_DEFAULT_MCP, TOOL_PYTHON } from "../app/tools-definitions";
import { CodeBox } from "./Markdown";
import { McpCallContent } from "./McpCallMessage";
import {
  AssistantMessage,
  GenerateImageContent,
  ReasoningContent,
  RunPythonContent,
} from "./MessageList";

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (year !== now.getFullYear()) {
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  } else if (month === now.getMonth() + 1 && day === now.getDate()) {
    return `${hours}:${minutes}`;
  } else {
    return `${month}/${day} ${hours}:${minutes}`;
  }
}

export function ResponseContextMenu({
  open,
  anchorPosition,
  onClose,
  payload,
  onRetryClick,
}: {
  open: boolean;
  anchorPosition: { mouseX: number; mouseY: number } | null;
  onClose: () => void;
  payload?: {
    message: Response & { timestamp: number };
    selectedPart?: number;
  };
  onRetryClick: () => void;
}) {
  const [showSelection, setShowSelection] = useState(false);

  const { t } = useTranslation();

  const handleCopy = useCallback(() => {
    const content = payload!.message.output
      .flatMap((message) =>
        message.type !== "message"
          ? []
          : message.content.map((part) =>
              part.type === "output_text" ? part.text : part.refusal
            )
      )
      .join("\n");
    navigator.clipboard.writeText(content);
  }, [payload]);

  return (
    <>
      <Menu
        open={open}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={
          anchorPosition
            ? { top: anchorPosition.mouseY, left: anchorPosition.mouseX }
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
            onClose();
          }}
        >
          <ListItemIcon>
            <SelectAllIcon />
          </ListItemIcon>
          {t("Select Text")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onRetryClick();
            onClose();
          }}
        >
          <ListItemIcon>
            <ReplayIcon />
          </ListItemIcon>
          {t("Retry")}
        </MenuItem>
      </Menu>

      {payload && (
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
            value={payload.message.output
              .flatMap((message) =>
                message.type !== "message"
                  ? []
                  : message.content.map((part) =>
                      part.type === "output_text" ? part.text : part.refusal
                    )
              )
              .join("\n")}
            slotProps={{ input: { readOnly: true } }}
            sx={{ height: "100%", padding: 2, alignItems: "flex-start" }}
          />
        </Dialog>
      )}
    </>
  );
}

export function ResponseActions({
  response,
  onRetry,
  onDislike,
}: {
  response: Response & { timestamp: number };
  onRetry: (options?: CreateResponseParams) => void;
  onDislike: () => void;
}) {
  const [retryMenuAnchor, setRetryMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  const handleCopy = useCallback(() => {
    const content = response.output
      .flatMap((message) =>
        message.type !== "message"
          ? []
          : message.content.map((part) =>
              part.type === "output_text" ? part.text : part.refusal
            )
      )
      .join("\n");
    navigator.clipboard.writeText(content);
  }, [response.output]);

  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      gap="4px"
      sx={{ marginTop: 1, marginBottom: 2, alignItems: "center" }}
    >
      <IconButton
        aria-label="Copy"
        sx={{ width: "28px", height: "28px", borderRadius: 1 }}
        onClick={handleCopy}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
      <Button
        aria-label="Retry"
        size="small"
        sx={{ minWidth: 0, color: "text.secondary" }}
        onClick={(e) => {
          setRetryMenuAnchor(e.currentTarget);
        }}
      >
        <ReplayIcon fontSize="small" />
        <ExpandMoreIcon fontSize="small" />
      </Button>
      <IconButton
        aria-label="Dislike"
        onClick={() => onDislike()}
        sx={{ width: "28px", height: "28px", borderRadius: 1 }}
      >
        <ThumbDownOffAltIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: "64px", marginRight: 1, userSelect: "none" }}
      >
        {formatTimestamp(response.timestamp)}
      </Typography>
      {response.usage && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ userSelect: "none" }}
        >
          <span>{response.usage.total_tokens}</span>
          {" tokens"}
        </Typography>
      )}

      <Menu
        anchorEl={retryMenuAnchor}
        open={Boolean(retryMenuAnchor)}
        onClose={() => setRetryMenuAnchor(null)}
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem
          onClick={() => {
            onRetry({
              model: "gpt-5",
              tools: [TOOL_DEFAULT_MCP, TOOL_PYTHON],
            });
            setRetryMenuAnchor(null);
          }}
        >
          gpt-5
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
    </Stack>
  );
}

function ResponseItem({
  response,
  onContextMenu,
  slots,
}: {
  response: Response & { timestamp: number };
  onContextMenu?: (e: React.PointerEvent<HTMLDivElement>) => void;
  slots?: {
    responseActions?: ElementType<{
      message: Response & { timestamp: number };
    }>;
  };
}) {
  const Actions = slots?.responseActions;
  const { t } = useTranslation();

  return (
    <Box sx={{ marginRight: 4 }}>
      {response.error ? (
        <Alert severity="error">{response.error.message}</Alert>
      ) : (
        response.output.map((message) => (
          <Fragment key={message.id}>
            {message.type === "message" ? (
              message.role === "assistant" ? (
                <AssistantMessage
                  message={message}
                  onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
                    const { nativeEvent } = e;
                    if (nativeEvent.pointerType === "mouse") return;
                    nativeEvent.preventDefault();
                    window.getSelection()?.removeAllRanges();
                    onContextMenu?.(e);
                  }}
                />
              ) : null
            ) : message.type === "reasoning" ? (
              <Box>
                <ReasoningContent message={message} />
              </Box>
            ) : message.type === "mcp_call" ? (
              <McpCallContent message={message} />
            ) : message.type === "function_call" ? (
              message.name === "run_python" ? (
                <RunPythonContent />
              ) : (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      marginY: 1,
                      color: "text.secondary",
                      userSelect: "none",
                    }}
                  >
                    {t("Call tool")}: {message.name}
                  </Typography>
                </Box>
              )
            ) : message.type === "image_generation_call" ? (
              <GenerateImageContent message={message} />
            ) : message.type === "web_search_call" ? (
              <Box sx={{ marginY: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", userSelect: "none" }}
                >
                  <Stack
                    component="span"
                    direction="row"
                    gap={0.5}
                    sx={{ alignItems: "center" }}
                  >
                    <SearchIcon />
                    {message.status === "completed"
                      ? t("Search completed")
                      : t("Searching...")}
                  </Stack>
                </Typography>
              </Box>
            ) : message.type === "code_interpreter_call" ? (
              message.code === null ? null : (
                <CodeBox language="python">{message.code}</CodeBox>
              )
            ) : null}
          </Fragment>
        ))
      )}

      {response.status !== "in_progress" && Actions && (
        <Actions message={response} />
      )}
    </Box>
  );
}

export default ResponseItem;
