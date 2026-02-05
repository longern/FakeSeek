import { useDispatch, useSelector } from "react-redux";

import { MODEL_PROVIDER_PRESET_KEY } from "./presets";
import store, { AppDispatch, AppState } from "./store";
import { SETTINGS_KEY } from "./settings";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

store.subscribe(async () => {
  window.localStorage.setItem(
    MODEL_PROVIDER_PRESET_KEY,
    JSON.stringify(store.getState().presets)
  );
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(store.getState().settings)
  );
});
