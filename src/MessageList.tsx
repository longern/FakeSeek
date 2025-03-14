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
import {
  ResponseInputItem,
  ResponseOutputMessage,
} from "openai/resources/responses/responses.mjs";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import Markdown from "./Markdown";

type ExcludeEasy<T> = T extends { content: infer A }
  ? A extends string
    ? never
    : T
  : T;
export type ChatMessage = ExcludeEasy<ResponseInputItem>;

function ReasoningContent({
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
  const [selectedMessage, setSelectedMessage] =
    useState<ResponseOutputMessage | null>(null);
  const [showSelection, setShowSelection] = useState(false);

  const { t } = useTranslation();

  return (
    <>
      {messages.map((message, index) =>
        message.type === "message" ? (
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
              setSelectedMessage(message as ResponseOutputMessage);
            }}
          >
            {message.content.map((part, index) => (
              <Box key={index}>
                {part.type === "input_text" || part.type === "output_text" ? (
                  message.role === "user" ? (
                    part.text
                  ) : (
                    <Markdown>{part.text}</Markdown>
                  )
                ) : null}
              </Box>
            ))}
          </Box>
        ) : message.type === "reasoning" ? (
          <Box key={message.id} sx={{ marginBottom: -1 }}>
            <ReasoningContent
              key={index}
              content={message.summary.map((s) => s.text).join("\n")}
              reasoning={message.status !== "completed"}
            />
          </Box>
        ) : message.type === "web_search_call" ? (
          <Box key={message.id}>
            <Button
              onClick={async () => {
                const researchId = message.id;
                const res = await fetch(`/api/tasks/${researchId}`);
                const data = await res.json();
                if (
                  ["terminated", "errored", "complete"].includes(data.status)
                ) {
                  const result = data.output
                    ? [
                        {
                          type: "message",
                          role: "assistant",
                          content: [
                            {
                              type: "output_text",
                              text: `(Researched for ${
                                (data.output.finish_time -
                                  data.output.create_time) /
                                1000
                              } seconds)`,
                            },
                          ],
                        },
                        ...data.output.messages,
                      ]
                    : [
                        {
                          type: "message",
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
          </Box>
        ) : null
      )}

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
            const content = selectedMessage.content
              .map((part) =>
                part.type === "output_text" ? part.text : part.refusal
              )
              .join("");
            navigator.clipboard.writeText(content);
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
          value={
            selectedMessage === null
              ? ""
              : selectedMessage.content
                  .map((part) =>
                    part.type === "output_text" ? part.text : part.refusal
                  )
                  .join("")
          }
          slotProps={{ input: { readOnly: true } }}
          sx={{ height: "100%", padding: 2, alignItems: "flex-start" }}
        />
      </Dialog>
    </>
  );
}

export default MessageList;
