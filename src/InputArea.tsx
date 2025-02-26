import {
  ArrowUpward as ArrowUpwardIcon,
  Search as SearchIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { Box, Chip, IconButton, InputBase, Stack } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

function urlBase64ToUint8Array(base64String: string) {
  return new Uint8Array(
    atob(base64String.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

function InputArea({
  stopController,
  onResearch,
  onSearch,
  onChat,
}: {
  stopController?: AbortController;
  onResearch: (task: string) => void;
  onSearch: (query: string) => void;
  onChat: (message: string) => void;
}) {
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableResearch, setEnableResearch] = useState(false);
  const [message, setMessage] = useState("");

  const { t } = useTranslation();

  const handleSend = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage("");
      if (enableSearch) {
        onSearch(message);
      } else if (enableResearch) {
        onResearch(message);
      } else {
        onChat(message);
      }
    },
    [enableSearch, enableResearch, message]
  );

  return (
    <Stack
      component="form"
      onSubmit={handleSend}
      sx={{ width: "100%", padding: 1 }}
    >
      <InputBase
        multiline
        placeholder={t("Send message...")}
        required
        value={message}
        sx={{
          minHeight: "48px",
          borderRadius: "24px",
          backgroundColor: "whitesmoke",
          padding: "0.5rem 1rem",
        }}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const form = e.currentTarget.form!;
            if (form.checkValidity()) form.requestSubmit();
          }
        }}
      />
      <Stack direction="row" alignItems="center" gap={1} sx={{ paddingY: 1 }}>
        <Chip
          label={t("Research")}
          color={enableResearch ? "primary" : "default"}
          onClick={() => {
            if (!enableResearch) Notification.requestPermission();
            navigator.serviceWorker
              .getRegistration()
              .then(async (registration) => {
                if (!registration) return;
                const subscription =
                  await registration.pushManager.getSubscription();
                if (subscription) return;
                const SERVER_PUBLIC_KEY =
                  "BGQRGebCwAzQGNxKag65PqQdQSE4wOlPLN36wpyVIMFzXKg58AgsoSVFiBi9IJrRNqHBxsftMNvwAN5Ki5AOe8A";
                await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    urlBase64ToUint8Array(SERVER_PUBLIC_KEY),
                });
              });
            setEnableResearch(!enableResearch);
            setEnableSearch(false);
            navigator.vibrate?.(1);
          }}
        />
        <Chip
          label={t("Search")}
          color={enableSearch ? "primary" : "default"}
          icon={<SearchIcon />}
          onClick={() => {
            setEnableSearch(!enableSearch);
            setEnableResearch(false);
            navigator.vibrate?.(1);
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        {stopController ? (
          <IconButton
            aria-label={t("Stop")}
            size="small"
            sx={{
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
            }}
            onClick={() => stopController.abort("User manually stopped")}
          >
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            type="submit"
            aria-label={t("Send")}
            size="small"
            color="primary"
            disabled={!message}
            sx={{
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
              "&:disabled": {
                backgroundColor: "action.disabled",
                color: "primary.contrastText",
              },
            }}
          >
            <ArrowUpwardIcon />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
}

export default InputArea;
