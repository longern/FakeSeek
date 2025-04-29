import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Collapse, Typography } from "@mui/material";
import { Image } from "openai/resources.mjs";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses.mjs";
import { useMemo, useState } from "react";
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

function GenerateImageContent({
  message,
}: {
  message: ResponseInputItem.FunctionCallOutput;
}) {
  const imageURLs = useMemo(() => {
    const data: Array<Image> = JSON.parse(message.output);
    return data.map((image) => {
      const byteCharacters = atob(image.b64_json!);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      return URL.createObjectURL(
        new Blob([byteNumbers], { type: "image/png" })
      );
    });
  }, [message]);

  return (
    <>
      {imageURLs.map((image, index) => (
        <img key={index} src={image} alt={`Generated Image ${index + 1}`} />
      ))}
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
      return (
        <Box sx={{ marginRight: "64px" }}>
          <GenerateImageContent message={message} />
        </Box>
      );
  }
}
