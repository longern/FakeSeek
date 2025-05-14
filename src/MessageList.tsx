import { Box, Button, Stack } from "@mui/material";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
} from "openai/resources/responses/responses.mjs";

import { add as addMessage, ChatMessage } from "./app/messages";
import {
  AssistantMessage,
  FunctionCallOutput,
  ReasoningContent,
  UserMessage,
} from "./MessageItem";
import { useAppDispatch } from "./app/hooks";

function MessageList({
  messages,
  onRetry,
}: {
  messages: ChatMessage[];
  onRetry: (message: ChatMessage, options?: { model?: string }) => void;
}) {
  const dispatch = useAppDispatch();

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
              onRetry={(options?: { model?: string }) =>
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
                  const result: ResponseOutputMessage[] = data.output
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
                          content: [
                            { type: "refusal", refusal: data.error ?? "Error" },
                          ],
                        },
                      ];
                  for (const item of result) {
                    dispatch(
                      addMessage({
                        id: message.id,
                        type: "message",
                        role: "assistant",
                        content: item.content,
                        status: "completed",
                      } as ResponseOutputMessage)
                    );
                  }
                }
              }}
            >
              Load Result
            </Button>
          </Box>
        ) : null
      )}
    </Stack>
  );
}

export default MessageList;
