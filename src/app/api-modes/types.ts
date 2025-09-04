import { Tool } from "openai/resources/responses/responses.mjs";

export type CreateResponseParams = {
  model?: string;
  instructions?: string;
  tools?: Tool[];
  temperature?: number | null;
};
