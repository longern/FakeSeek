import { useDispatch, useSelector } from "react-redux";

import store, { AppDispatch, AppState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

store.subscribe(async () => {
  window.localStorage.setItem(
    "presets",
    JSON.stringify(store.getState().presets)
  );
});
