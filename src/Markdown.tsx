import { css } from "@emotion/css";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, IconButton, Link } from "@mui/material";
import "katex/dist/katex.min.css";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Preprocesses LaTeX content by replacing delimiters and escaping certain characters.
 *
 * @param content The input string containing LaTeX expressions.
 * @returns The processed string with replaced delimiters and escaped characters.
 */
export function preprocessLaTeX(content: string): string {
  // Step 1: Protect code blocks
  const codeBlocks: string[] = [];
  content = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (_, code) => {
    codeBlocks.push(code);
    return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
  });

  // Step 2: Protect existing LaTeX expressions
  const latexExpressions: string[] = [];
  content = content.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  // Step 3: Escape dollar signs that are likely currency indicators
  content = content.replace(/\$(?=\d)/g, "\\$");

  // Step 4: Restore LaTeX expressions
  content = content.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index) => latexExpressions[parseInt(index)]
  );

  // Step 5: Restore code blocks
  content = content.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[parseInt(index)]
  );

  // Step 6: Apply additional escaping functions
  content = escapeBrackets(content);
  content = escapeMhchem(content);

  return content;
}

export function escapeBrackets(text: string): string {
  const pattern =
    /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (
      match: string,
      codeBlock: string | undefined,
      squareBracket: string | undefined,
      roundBracket: string | undefined
    ): string => {
      if (codeBlock != null) {
        return codeBlock;
      } else if (squareBracket != null) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket != null) {
        return `$${roundBracket}$`;
      }
      return match;
    }
  );
}

export function escapeMhchem(text: string) {
  return text.replaceAll("$\\ce{", "$\\\\ce{").replaceAll("$\\pu{", "$\\\\pu{");
}

function CopyButton({ text }: { text: string }) {
  const [copiedTimeout, setCopiedTimeout] = useState<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  return (
    <IconButton
      aria-label="Copy"
      size="small"
      onClick={() => {
        navigator.clipboard.writeText(text);
        clearTimeout(copiedTimeout);
        setCopiedTimeout(setTimeout(() => setCopiedTimeout(undefined), 2000));
      }}
    >
      {copiedTimeout ? (
        <CheckIcon color="success" fontSize="small" />
      ) : (
        <ContentCopyIcon fontSize="small" />
      )}
    </IconButton>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className={css`
        & .katex {
          overflow-x: auto;
        }
      `}
      components={{
        a: ({ node, ref, ...props }) => (
          <Link {...props} target="_blank" rel="noopener noreferrer">
            {props.children}
          </Link>
        ),
        pre: ({ node, children, ref, ...props }) => {
          const fallback = <pre {...props}>{children}</pre>;
          const isObject = typeof children === "object" && children !== null;
          if (!isObject || !("type" in children) || children.type !== "code")
            return fallback;
          const match = /language-([\w-]+)/.exec(children.props.className);
          const language = match ? match[1] : "";
          const code = (children.props.children ?? "").replace(/\n$/, "");
          return (
            <Box sx={{ marginY: 1, borderRadius: "0.3em", overflow: "hidden" }}>
              <Box
                sx={{
                  fontSize: "0.8rem",
                  backgroundColor: "#eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box sx={{ paddingLeft: 1.5, userSelect: "none" }}>
                  {language}
                </Box>
                <CopyButton text={code} />
              </Box>
              <SyntaxHighlighter
                {...props}
                children={code}
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: "0.875rem",
                  overflowX: "auto",
                }}
              />
            </Box>
          );
        },
      }}
    >
      {preprocessLaTeX(children)}
    </ReactMarkdown>
  );
}

export default Markdown;
