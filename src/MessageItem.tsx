import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Collapse, Typography } from "@mui/material";
import { Image } from "openai/resources.mjs";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses.mjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function ReasoningContent({
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

export function FunctionCallOutput({
  message,
  toolCall,
}: {
  message: ResponseInputItem.FunctionCallOutput;
  toolCall?: ResponseFunctionToolCall;
}) {
  if (!toolCall) return message.output;

  switch (toolCall.name) {
    case "generate_image":
      const data: Array<Image> = JSON.parse(message.output);
      return (
        <Box sx={{ marginRight: "64px" }}>
          {data.map((image, index) => (
            <img
              key={index}
              src={"data:image/png;base64," + image.b64_json!}
              alt={`Generated Image ${index + 1}`}
            />
          ))}
        </Box>
      );
  }
}
