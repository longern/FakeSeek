import { produce } from "immer";
import {
  Response,
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";

export interface FunctionCallOutputCompletedEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.function_call_output.completed";
}

export interface FunctionCallOutputIncompleteEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.function_call_output.incomplete";
}

function responseReducer(
  state: Response,
  event:
    | ResponseStreamEvent
    | FunctionCallOutputCompletedEvent
    | FunctionCallOutputIncompleteEvent
) {
  if (event.type === "response.created") return event.response;

  return produce(state, (response) => {
    switch (event.type) {
      case "response.completed":
        response.status = "completed";
        break;

      case "response.output_item.added":
        response.output.push(event.item);
        break;

      case "response.output_item.done":
        // Hardcord for vLLM
        const outputIndex = Math.min(
          event.output_index,
          response.output.length - 1
        );

        const item = structuredClone(event.item);

        if (!item.id && response.output[outputIndex]?.id)
          item.id = response.output[outputIndex].id;
        if (item.type === "reasoning") item.status ??= "completed";

        response.output[outputIndex] = item;
        break;

      case "response.content_part.added": {
        const message = response.output[event.output_index];
        switch (message?.type) {
          case "message":
            if (!message.content) message.content = [];
            message.content.push(event.part as any);
            break;
          case "reasoning":
            if (!message.content) message.content = [];
            const part =
              event.part as unknown as (typeof message.content)[number];
            message.content.push(part);
            break;
          default:
            return;
        }
        break;
      }

      case "response.content_part.done": {
        const outputIndex = Math.min(
          event.output_index,
          response.output.length - 1
        );
        const doneMessage = response.output[outputIndex];
        if (doneMessage.type !== "message") return;
        doneMessage.content[event.content_index] = event.part as any;
        break;
      }

      case "response.output_text.delta":
        const outMessage = response.output[event.output_index];
        if (outMessage?.type !== "message" || outMessage.role !== "assistant")
          return;
        const outPart = outMessage.content[event.content_index];
        if (outPart?.type !== "output_text") return;
        outPart.text += event.delta;
        break;

      case "response.reasoning_text.delta":
        const reasoningMessage = response.output[event.output_index];
        if (reasoningMessage.type !== "reasoning") return;
        const reasoningPart = reasoningMessage.content?.[event.content_index];
        if (!reasoningPart) return;
        reasoningPart.text += event.delta;
        break;

      case "response.reasoning_summary_part.added": {
        const resp = response.output[event.output_index];
        if (resp.type !== "reasoning") return;
        resp.summary.push(event.part);
        break;
      }

      case "response.reasoning_summary_text.delta": {
        const message = response.output[event.output_index];
        if (message.type !== "reasoning") return;
        const part = message.summary[event.summary_index];
        if (!part) return;
        part.text += event.delta;
        break;
      }

      case "response.function_call_arguments.delta":
        const fcArgsMessage = response.output[event.output_index];
        if (fcArgsMessage?.type !== "function_call") return;
        fcArgsMessage.arguments += event.delta;
        break;

      case "response.mcp_call_arguments.delta":
        const mcpArgsMessage = response.output[event.output_index];
        if (mcpArgsMessage?.type !== "mcp_call") return;
        mcpArgsMessage.arguments += event.delta;
        break;

      case "response.code_interpreter_call_code.delta":
        const ciCodeMessage = response.output[event.output_index];
        if (ciCodeMessage?.type !== "code_interpreter_call") return;
        ciCodeMessage.code += event.delta;
        break;
    }
  });
}

export default responseReducer;
