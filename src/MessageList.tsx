import { Box, Stack, Typography } from "@mui/material";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses.mjs";
import { Search } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { ChatMessage } from "./app/messages";
import {
  AssistantMessage,
  FunctionCallOutput,
  GenerateImageContent,
  ReasoningContent,
  UserMessage,
} from "./MessageItem";
import { CreateResponseParams } from "./app/thunks";

function MessageList({
  messages,
  onRetry,
}: {
  messages: ChatMessage[];
  onRetry: (message: ChatMessage, options?: CreateResponseParams) => void;
}) {
  const { t } = useTranslation();

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
      {messages.map((message, index) =>
        message.type === "message" ? (
          message.role === "user" ? (
            <UserMessage
              key={index}
              message={message as ResponseInputItem.Message}
            />
          ) : message.role === "assistant" ? (
            <AssistantMessage
              key={message?.id}
              message={message}
              onRetry={(options?: CreateResponseParams) =>
                onRetry(message, options)
              }
            />
          ) : null
        ) : message.type === "reasoning" ? (
          <Box key={message.id} sx={{ marginBottom: -1 }}>
            <ReasoningContent
              key={message.id}
              content={message.summary}
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
        ) : message.type === "image_generation_call" ? (
          <Box key={message.id} sx={{ marginRight: 4 }}>
            <GenerateImageContent message={message} />
          </Box>
        ) : message.type === "web_search_call" ? (
          <Box key={message.id} sx={{ marginRight: 4, marginBottom: -1 }}>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", userSelect: "none" }}
            >
              <Stack direction="row" gap={0.5} sx={{ alignItems: "center" }}>
                <Search />
                {message.status === "completed"
                  ? t("Search completed")
                  : t("Searching...")}
              </Stack>
            </Typography>
          </Box>
        ) : null
      )}
    </Stack>
  );
}

export default MessageList;
