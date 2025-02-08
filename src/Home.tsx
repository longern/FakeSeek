import { Container, GlobalStyles } from "@mui/material";

function Home({ inputArea }: { inputArea: React.ReactNode }) {
  return (
    <Container
      maxWidth="md"
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      <GlobalStyles
        styles={{
          "html, body, #root": {
            height: "100%",
          },
        }}
      ></GlobalStyles>
      {inputArea}
    </Container>
  );
}

export default Home;
