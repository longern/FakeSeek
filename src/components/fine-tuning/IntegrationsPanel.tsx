import {
  Box,
  Card,
  Container,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import StyledTextField from "../presets/StyledTextField";
import { useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { patch as patchSettings } from "@/app/settings";

async function readFromClipboard({
  accountId,
  apiKey,
}: {
  accountId: string;
  apiKey: string;
}) {
  const clipboardText = await navigator.clipboard.readText();
  const match = clipboardText.match(
    /.*\/gateways\/([^/]+)\/.*log_id=([^&\s]+)/
  );
  if (!match) throw new Error("Invalid clipboard content");
  const [, gatewayId, logId] = match;

  const [requestResp, responseResp] = await Promise.all([
    fetch(
      `/logs/${logId}/request?accountId=${accountId}&gatewayId=${gatewayId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    ),
    fetch(
      `/logs/${logId}/response?accountId=${accountId}&gatewayId=${gatewayId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    ),
  ]);

  if (!requestResp.ok || !responseResp.ok) {
    throw new Error("Failed to fetch log data from Cloudflare");
  }

  return {
    request: await requestResp.json(),
    response: await responseResp.json(),
  };
}

function CloudflareAIGatewayIntegration() {
  const settings = useAppSelector((state) => state.settings);
  const [cloudflareAccountId, setCloudflareAccountId] = useState(
    settings.cloudflareAccountId ?? ""
  );
  const [cloudflareApiKey, setCloudflareApiKey] = useState(
    settings.cloudflareApiToken ?? ""
  );
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      patchSettings({
        settings: { cloudflareAccountId: cloudflareAccountId || undefined },
      })
    );
  }, [cloudflareAccountId, dispatch]);

  useEffect(() => {
    dispatch(
      patchSettings({
        settings: { cloudflareApiToken: cloudflareApiKey || undefined },
      })
    );
  }, [cloudflareApiKey, dispatch]);

  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        Cloudflare AI Gateway
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <List disablePadding>
          <ListItem>
            <StyledTextField
              id="cloudflare-account-id"
              label="Account ID"
              value={cloudflareAccountId}
              onChange={(e) => setCloudflareAccountId(e.target.value)}
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
          <ListItem>
            <StyledTextField
              type="password"
              id="cloudflare-api-key"
              label="API Key"
              value={cloudflareApiKey}
              onChange={(e) => setCloudflareApiKey(e.target.value)}
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              onClick={async () => {
                const data = await readFromClipboard({
                  accountId: cloudflareAccountId,
                  apiKey: cloudflareApiKey,
                });
                console.log("Read from clipboard:", data);
              }}
            >
              <ListItemText primary="Read from clipboard" />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>
    </Box>
  );
}

function LangfuseIntegration() {
  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        Langfuse
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <List disablePadding>
          <ListItem>
            <StyledTextField
              id="langfuse-base-url"
              label="Base URL"
              value=""
              placeholder="https://cloud.langfuse.com"
              onChange={() => {}}
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
          <ListItem>
            <StyledTextField
              id="langfuse-public-key"
              label="Public Key"
              value=""
              placeholder="pk-lf-..."
              onChange={() => {}}
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
          <ListItem>
            <StyledTextField
              id="langfuse-secret-key"
              label="Secret Key"
              value=""
              placeholder="sk-lf-..."
              onChange={() => {}}
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
        </List>
      </Card>
    </Box>
  );
}

function IntegrationsPanel() {
  return (
    <Paper
      elevation={0}
      sx={{ height: "100%", overflowY: "auto", borderRadius: 0 }}
    >
      <Container maxWidth="md" sx={{ paddingY: 2 }}>
        <Stack spacing={2}>
          <LangfuseIntegration />
          <CloudflareAIGatewayIntegration />
        </Stack>
      </Container>
    </Paper>
  );
}

export default IntegrationsPanel;
