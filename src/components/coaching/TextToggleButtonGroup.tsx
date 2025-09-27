import { styled } from "@mui/material/styles";
import { ToggleButtonGroup, toggleButtonGroupClasses } from "@mui/material";

const TextToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  gap: theme.spacing(0.5),
  [`& .${toggleButtonGroupClasses.grouped}`]: {
    paddingLeft: theme.spacing(1.3),
    paddingRight: theme.spacing(1.3),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    border: 0,
    borderRadius: theme.shape.borderRadius,
    [`&.${toggleButtonGroupClasses.disabled}`]: {
      border: 0,
    },
  },
}));

export default TextToggleButtonGroup;
