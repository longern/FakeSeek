import { styled } from "@mui/material/styles";
import { ToggleButtonGroup, toggleButtonGroupClasses } from "@mui/material";

const TextToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  [`& .${toggleButtonGroupClasses.grouped}`]: {
    paddingLeft: theme.spacing(1.3),
    paddingRight: theme.spacing(1.3),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
  },
}));

export default TextToggleButtonGroup;
