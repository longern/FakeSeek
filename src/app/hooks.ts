import { useDispatch, useSelector } from "react-redux";

import store, { AppDispatch, AppState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

store.subscribe(async () => {
  const { apiKey, baseURL, ...rest } = store.getState().provider;

  if (apiKey) window.localStorage.setItem("OPENAI_API_KEY", apiKey);
  else window.localStorage.removeItem("OPENAI_API_KEY");

  if (baseURL) window.localStorage.setItem("OPENAI_BASE_URL", baseURL);
  else window.localStorage.removeItem("OPENAI_BASE_URL");

  window.localStorage.setItem("settings", JSON.stringify(rest));
});
