import { createContext, useContext } from "react";

export const PresetsDialogContext = createContext(() => {});

export function useShowPresetsDialog() {
  return useContext(PresetsDialogContext);
}
