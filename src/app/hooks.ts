import {
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  addContentPart,
  add as addMessage,
  addReasoningSummaryPart,
  contentPartDelta,
  reasoningSummaryTextDelta,
  update as updateMessage,
} from "./messages";
import store, { AppDispatch, AppState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

interface FunctionCallOutputCompletedEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.completed";
}

interface FunctionCallOutputIncompleteEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.incomplete";
}

export function useMessageDispatch() {
  const dispatch = useAppDispatch();

  const messageDispatch = useCallback(
    (
      event:
        | ResponseStreamEvent
        | FunctionCallOutputCompletedEvent
        | FunctionCallOutputIncompleteEvent
    ) => {
      switch (event.type) {
        case "response.output_item.added":
          dispatch(addMessage(event.item));
          break;

        case "response.output_item.done": {
          const eventStatus = event.item.status as
            | "completed"
            | "in_progress"
            | "incomplete"
            | undefined;
          const isReasoningCompleted =
            event.item.type === "reasoning" && eventStatus === undefined;
          const status = isReasoningCompleted ? "completed" : eventStatus;
          dispatch(updateMessage({ id: event.item.id!, patch: { status } }));
          break;
        }

        case "response.content_part.added": {
          dispatch(addContentPart(event));
          break;
        }

        case "response.output_text.delta": {
          dispatch(contentPartDelta(event));
          break;
        }

        case "response.reasoning_summary_part.added": {
          dispatch(addReasoningSummaryPart(event));
          break;
        }

        case "response.reasoning_summary_text.delta": {
          dispatch(reasoningSummaryTextDelta(event));
          break;
        }

        case "response.functioin_call_output.completed": {
          dispatch(
            updateMessage({
              id: event.item.id!,
              patch: { status: "completed", output: event.item.output },
            })
          );
          break;
        }

        case "response.functioin_call_output.incomplete": {
          dispatch(
            updateMessage({
              id: event.item.id!,
              patch: { status: "incomplete", output: event.item.output },
            })
          );
          break;
        }
      }
    },
    [dispatch]
  );

  return messageDispatch;
}

store.subscribe(async () => {
  const { apiKey, baseURL, ...rest } = store.getState().provider;

  if (apiKey) window.localStorage.setItem("OPENAI_API_KEY", apiKey);
  else window.localStorage.removeItem("OPENAI_API_KEY");

  if (baseURL) window.localStorage.setItem("OPENAI_BASE_URL", baseURL);
  else window.localStorage.removeItem("OPENAI_BASE_URL");

  window.localStorage.setItem("settings", JSON.stringify(rest));
});
