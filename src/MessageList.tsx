import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplayIcon from "@mui/icons-material/Replay";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import {
  Box,
  Button,
  Dialog,
  IconButton,
  InputBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  ResponseFunctionToolCall,
  ResponseOutputMessage,
} from "openai/resources/responses/responses.mjs";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import Markdown from "./Markdown";
import { ChatMessage } from "./app/conversations";
import { FunctionCallOutput, ReasoningContent } from "./MessageItem";

function base64ToBlob(base64: string, contentType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([byteNumbers], { type: contentType });
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
    <Stack
      gap={1}
      sx={{
        "& img": {
          display: "block",
          maxWidth: "100%",
          maxHeight: "60vh",
          borderRadius: "8px",
        },
      }}
    >
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
                : null),
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
                ) : part.type === "input_image" ? (
                  <img
                    src={"data:image/png;base64," + part.image_url}
                    alt="Generated Image"
                  />
                ) : null}
              </Box>
            ))}
          </Box>
        ) : message.type === "reasoning" ? (
          <Box key={message.id} sx={{ marginBottom: -1 }}>
            <ReasoningContent
              key={message.id}
              content={message.summary.map((s) => s.text).join("\n")}
              reasoning={message.status !== "completed"}
            />
          </Box>
        ) : message.type === "function_call_output" ? (
          <FunctionCallOutput
            key={message.id || `out_${message.call_id}`}
            message={message}
            toolCall={
              messages.find(
                (m) =>
                  m.type === "function_call" && m.call_id === message.call_id
              ) as ResponseFunctionToolCall | undefined
            }
          />
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
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem
          onClick={() => {
            if (!selectedMessage) return;
            const content = selectedMessage.content.map((part: any) =>
              part.type === "refusal"
                ? new ClipboardItem({ "text/plain": part.refusal })
                : part.type === "input_image"
                ? new ClipboardItem({
                    "image/png": base64ToBlob(part.image_url, "image/png"),
                  })
                : new ClipboardItem({ "text/plain": part.text })
            );
            navigator.clipboard.write(content);
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
    </Stack>
  );
}

export default MessageList;
