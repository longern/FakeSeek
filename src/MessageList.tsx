import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReplayIcon from "@mui/icons-material/Replay";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import {
  Box,
  Button,
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
import React, { useState } from "react";
import Markdown from "./Markdown";
import { useTranslation } from "react-i18next";

export interface ChatMessage {
  role: string;
  content: string;
  reasoning_content?: string;
}

function ReasoningContent({
  content,
  reasoning,
}: {
  content: string;
  reasoning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Button onClick={() => setExpanded((expanded) => !expanded)}>
        {reasoning ? "Reasoning" : "Reasoning Finished"}
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

function MessageList({
  messages,
  onMessageChange,
  onRetry,
}: {
  messages: ChatMessage[];
  onMessageChange: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onRetry: (message: ChatMessage) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null
  );
  const [showSelection, setShowSelection] = useState(false);

  const { t } = useTranslation();

  return (
    <>
      {messages.map((message, index) => (
        <Box
          key={index}
          sx={{
            maxWidth: "100%",
            overflowWrap: "break-word",
            ...(message.role === "user"
              ? {
                  minWidth: "48px",
                  padding: "8px 12px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "20px",
                  marginLeft: "64px",
                  alignSelf: "flex-end",
                  whiteSpace: "pre-wrap",
                }
              : {
                  "& img": {
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: "60vh",
                  },
                }),
          }}
          onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
            const { nativeEvent } = e;
            if (nativeEvent.pointerType === "mouse") return;
            nativeEvent.preventDefault();
            window.getSelection()?.removeAllRanges();
            setContextMenu(
              contextMenu === null
                ? { mouseX: e.clientX, mouseY: e.clientY }
                : null
            );
            setSelectedMessage(message);
          }}
        >
          {message.role === "user" ? (
            message.content
          ) : message.content.startsWith("research: ") ? (
            <Button
              onClick={async () => {
                const researchId = message.content.slice(10);
                const res = await fetch(`/api/tasks/${researchId}`);
                const data = await res.json();
                if (
                  ["terminated", "errored", "complete"].includes(data.status)
                ) {
                  const result = data.output
                    ? [
                        {
                          role: "assistant",
                          content: `(Researched for ${
                            (data.output.finish_time -
                              data.output.create_time) /
                            1000
                          } seconds)`,
                        },
                        ...data.output.messages,
                      ]
                    : [
                        {
                          role: "assistant",
                          content: data.error ?? "Error",
                        },
                      ];
                  onMessageChange((messages) => {
                    const newMessages = [...messages];
                    const index = newMessages.findIndex((m) => m === message);
                    newMessages.splice(index, 1, ...result);
                    return newMessages;
                  });
                }
              }}
            >
              Load Result
            </Button>
          ) : (
            <>
              {message.reasoning_content && (
                <ReasoningContent
                  content={message.reasoning_content}
                  reasoning={!message.content}
                />
              )}
              <Markdown>{message.content}</Markdown>
            </>
          )}
        </Box>
      ))}

      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        MenuListProps={{ sx: { minWidth: "160px" } }}
      >
        <MenuItem
          onClick={() => {
            if (!selectedMessage) return;
            navigator.clipboard.writeText(selectedMessage.content);
            setContextMenu(null);
            setSelectedMessage(null);
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
            onRetry(selectedMessage!);
            setContextMenu(null);
            setSelectedMessage(null);
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
        onClose={() => {
          setShowSelection(false);
          setSelectedMessage(null);
        }}
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
            onClick={() => {
              setShowSelection(false);
              setSelectedMessage(null);
            }}
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
          value={selectedMessage?.content}
          slotProps={{ input: { readOnly: true } }}
          sx={{ height: "100%", padding: 2, alignItems: "flex-start" }}
        />
      </Dialog>
    </>
  );
}

export default MessageList;
