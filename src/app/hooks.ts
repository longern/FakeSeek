import { useDispatch, useSelector } from "react-redux";

import { MODEL_PROVIDER_PRESET_KEY } from "./presets";
import store, { AppDispatch, AppState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

store.subscribe(async () => {
  window.localStorage.setItem(
    MODEL_PROVIDER_PRESET_KEY,
    JSON.stringify(store.getState().presets)
  );
});
