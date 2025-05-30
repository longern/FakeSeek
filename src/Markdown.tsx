import { css } from "@emotion/css";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { Box, IconButton, Link } from "@mui/material";
import "katex/dist/katex.min.css";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

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

export function CodeBox({
  language,
  children,
  ...props
}: {
  language: string;
  children: string;
  [key: string]: any;
}) {
  return (
    <Box sx={{ borderRadius: "0.3em", overflow: "hidden" }}>
      <Box
        sx={{
          fontSize: "0.8rem",
          backgroundColor: "#eee",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ paddingLeft: 1.5, userSelect: "none" }}>{language}</Box>
        <Box sx={{ flexGrow: 1 }} />
        <CopyButton text={children} />
        {language === "html" && (
          <IconButton
            aria-label="Run"
            onClick={() => {
              const blob = new Blob([children], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
            }}
          >
            <PlayCircleIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <SyntaxHighlighter
        {...props}
        children={children}
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
}

const Markdown = memo(({ children }: { children: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className={css`
        & .katex-display {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          padding-top: 0.5em;
          padding-bottom: 0.5em;
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
            <Box sx={{ marginY: 1 }}>
              <CodeBox language={language} {...props}>
                {code}
              </CodeBox>
            </Box>
          );
        },
      }}
    >
      {preprocessLaTeX(children)}
    </ReactMarkdown>
  );
});

function useDebounce<T>(value: T) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const valueToUpdate = useRef(value);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (!timeoutRef.current) return;
      cancelAnimationFrame(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    valueToUpdate.current = value;
    if (timeoutRef.current) return;
    timeoutRef.current = requestAnimationFrame(() => {
      setDebouncedValue(valueToUpdate.current);
      timeoutRef.current = null;
    });
  }, [value]);

  return debouncedValue;
}

function ChunkedMarkdown({ children: bouncingChildren }: { children: string }) {
  const children = useDebounce(bouncingChildren);

  const chunks = useMemo(() => {
    const ast = unified().use(remarkParse).parse(children);
    return ast.children.map((child) =>
      children.slice(child.position!.start.offset, child.position!.end.offset)
    );
  }, [children]);

  return (
    <>
      {chunks.map((chunk, index) => (
        <Markdown key={index}>{chunk}</Markdown>
      ))}
    </>
  );
}

export default ChunkedMarkdown;
