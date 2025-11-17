import PushPinIcon from "@mui/icons-material/PushPin";
import {
  Box,
  Divider,
  IconButton,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type AnchorEditorProps = {
  anchored: boolean;
  onChange: (value: boolean) => void;
  confidence?: number;
  onConfidenceChange?: (value: number) => void;
  marks?: Array<{ value: number; label: string }>;
};

function AnchorEditor({
  anchored,
  onChange,
  confidence,
  onConfidenceChange,
  marks,
}: AnchorEditorProps) {
  const [uncontrolledConfidence, setUncontrolledConfidence] = useState(
    anchored ? confidence ?? 0.999 : 0.0
  );

  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    setUncontrolledConfidence(anchored ? confidence ?? 0.999 : 0.0);
  }, [anchored, confidence]);

  return (
    <Stack divider={<Divider />}>
      <Box sx={{ paddingY: 1, paddingRight: 1, paddingLeft: 2 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography id="anchor-button">{t("Anchor")}</Typography>
          <IconButton
            aria-labelledby="anchor-button"
            {...(anchored
              ? { color: "primary", onClick: () => onChange?.(false) }
              : { onClick: () => onChange?.(true) })}
          >
            <PushPinIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ paddingX: 2, paddingY: 1.5 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography id="confidence-slider">{t("Confidence")}</Typography>
          <Typography
            variant="body2"
            sx={{ flexShrink: 0, width: "32px", textAlign: "right" }}
          >
            {uncontrolledConfidence.toFixed(3)}
          </Typography>
        </Stack>
        <Box sx={{ marginTop: 1, paddingX: 1 }}>
          <Slider
            value={uncontrolledConfidence}
            min={0}
            max={1}
            step={0.001}
            marks={marks}
            disabled={!anchored}
            onChangeCommitted={(_, value) => onConfidenceChange?.(value)}
            onChange={(_, value) => setUncontrolledConfidence(value)}
            aria-labelledby="confidence-slider"
          />
        </Box>
      </Box>
    </Stack>
  );
}

export default AnchorEditor;
