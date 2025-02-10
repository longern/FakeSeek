import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
