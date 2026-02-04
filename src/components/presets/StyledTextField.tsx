import {
  FormControl,
  FormHelperText,
  FormLabel,
  InputBase,
  SlotProps,
  Stack,
  SxProps,
  TextFieldOwnerState,
  Theme,
} from "@mui/material";
import React, { HTMLInputTypeAttribute } from "react";

function StyledTextField({
  type,
  id,
  label,
  value,
  error,
  helperText,
  sx,
  onChange,
  inputRef,
  slotProps,
}: {
  type?: HTMLInputTypeAttribute;
  id?: string;
  label?: React.ReactNode;
  value?: unknown;
  error?: boolean;
  helperText?: React.ReactNode;
  sx?: SxProps<Theme>;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<any>;
  slotProps?: {
    input?: SlotProps<React.ElementType<any>, {}, TextFieldOwnerState>;
    htmlInput?: React.HTMLAttributes<HTMLInputElement>;
  };
}) {
  return (
    <FormControl error={error} fullWidth sx={sx}>
      <Stack
        gap={1}
        sx={{ flexDirection: "row", alignItems: "center", width: "100%" }}
      >
        <FormLabel htmlFor={id} sx={{ flexShrink: 0 }}>
          {label}
        </FormLabel>
        <InputBase
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          slotProps={{ input: slotProps?.htmlInput }}
          inputRef={inputRef}
          fullWidth
          {...slotProps?.input}
        ></InputBase>
      </Stack>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}

export default StyledTextField;
