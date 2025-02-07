import { useEffect, useState } from "react";
import {
  Box,
  Container,
  IconButton,
  InputBase,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

interface SearchResults {
  items: Array<{
    title: string;
    htmlTitle: string;
    link: string;
    formattedUrl: string;
    htmlFormattedUrl: string;
    snippet: string;
  }>;
}

function SearchResults({
  query,
  onBack,
}: {
  query: string;
  onBack: () => void;
}) {
  const [results, setResults] = useState<SearchResults["items"]>([]);

  useEffect(() => {
    fetch(`/api/search?${new URLSearchParams({ q: query })}`)
      .then((response) => response.json() as Promise<SearchResults>)
      .then((data) => setResults(data.items));
  }, [query]);

  return (
    <>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          padding: "8px",
          backgroundColor: "background.paper",
          borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            padding: 0,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <IconButton aria-label="Back" size="large" onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>
          <InputBase
            sx={{
              marginLeft: "4px",
              width: "100%",
              borderRadius: 9999,
              backgroundColor: "whitesmoke",
              padding: "0.5rem 1rem",
            }}
            value={query}
          />
        </Container>
      </Box>
      <Container
        maxWidth="md"
        sx={{
          padding: 2,
        }}
      >
        <Stack gap={3.5}>
          {results.map((result, index) => (
            <Box key={index}>
              <Link
                href={result.link}
                underline="hover"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Typography variant="h6" component="h3">
                  {result.title}
                </Typography>
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{
                      display: "inline-block",
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {result.link}
                  </Typography>
                </Box>
              </Link>
              <Box sx={{ overflowWrap: "break-word" }}>{result.snippet}</Box>
            </Box>
          ))}
        </Stack>
      </Container>
    </>
  );
}

export default SearchResults;
