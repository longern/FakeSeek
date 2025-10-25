import { useAppSelector } from "../../app/hooks";

export function useCurrentPreset() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  return currentPreset;
}
