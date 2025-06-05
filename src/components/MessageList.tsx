import { Stack } from "@mui/material";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses.mjs";

import { ChatMessage } from "../app/messages";
import { CreateResponseParams } from "../app/thunks";
import { FunctionCallOutput, UserMessage } from "./MessageItem";
import ResponseItem from "./ResponseItem";

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

function MessageList({
  messages,
  onRetry,
}: {
  messages: ChatMessage[];
  onRetry: (message: ChatMessage, options?: CreateResponseParams) => void;
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
      {messages.map((response, index) =>
        response.object === "message" ? (
          <UserMessage key={index} message={response} />
        ) : response.object === "function_call_output" ? (
          <FunctionCallOutput
            key={response.id || `out_${response.call_id}`}
            message={response}
            toolCall={findToolCall(messages, response)}
          />
        ) : response.object === "response" ? (
          <ResponseItem
            key={response.id}
            response={response}
            onRetry={(options?: CreateResponseParams) =>
              onRetry(response, options)
            }
          />
        ) : null
      )}
    </Stack>
  );
}

export default MessageList;
