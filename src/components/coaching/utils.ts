import { Component } from "react";

function buildByteFallbackMaps() {
  const bs = [];

  // Visible ASCII: '!'..'~'
  for (let i = 33; i <= 126; i++) bs.push(i);
  // Latin-1 supplement ranges excluding 173
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);

  // Start with identity for those; assign extra codepoints for the rest
  const cs = bs.slice();
  let n = 0;
  for (let i = 0; i < 256; i++) {
    if (bs.indexOf(i) === -1) {
      bs.push(i);
      cs.push(256 + n);
      n += 1;
    }
  }

  // b2u: byte (0..255) -> unicode char used in fallback string
  // u2b: unicode char -> original byte
  const b2u: Record<string, string> = {};
  const u2b: Record<string, number> = {};
  for (let i = 0; i < bs.length; i++) {
    const ch = String.fromCharCode(cs[i]);
    b2u[bs[i]] = ch;
    u2b[ch] = bs[i];
  }
  return { b2u: b2u, u2b: u2b };
}

const BYTE_FALLBACK_MAPS = buildByteFallbackMaps();

export function decodeToken(token: string) {
  const u2b = BYTE_FALLBACK_MAPS.u2b;
  const rawBytes: Array<number> = new Array(token.length);
  for (let i = 0; i < token.length; i++) {
    const ch = token.charAt(i);
    const b = u2b[ch];
    if (b === undefined) {
      throw new Error(
        `Unknown fallback char at index ${i} (code ${token.charCodeAt(i)})`
      );
    }
    rawBytes[i] = b;
  }

  return new TextDecoder("utf-8").decode(new Uint8Array(rawBytes));
}

export class ErrorBoundary extends Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}

export function parseCompletion(text: string): {
  role: string;
  content: string;
  thinking?: string;
} {
  if (text.startsWith("<|channel|>")) {
    // OpenAI Harmony format
    const ANALYSIS_PREFIX = "<|channel|>analysis<|message|>";
    const analysisStartIdx = text.indexOf(ANALYSIS_PREFIX);
    if (analysisStartIdx !== 0) {
      return { role: "assistant", content: text };
    }
    const endIdx = text.indexOf(
      "<|end|>",
      analysisStartIdx + ANALYSIS_PREFIX.length
    );
    if (endIdx === -1) {
      return {
        role: "assistant",
        content: "",
        thinking: text.slice(analysisStartIdx + ANALYSIS_PREFIX.length),
      };
    }

    const analysis = text.slice(
      analysisStartIdx + ANALYSIS_PREFIX.length,
      endIdx
    );

    const FINAL_PREFIX = "<|channel|>final<|message|>";
    const finalStartIdx = text.indexOf(FINAL_PREFIX, endIdx + "<|end|>".length);
    if (finalStartIdx === -1) {
      return { role: "assistant", content: "", thinking: analysis };
    }
    const returnIdx = text.indexOf(
      "<|return|>",
      finalStartIdx + FINAL_PREFIX.length
    );
    const final = text.slice(
      finalStartIdx + FINAL_PREFIX.length,
      returnIdx === -1 ? undefined : returnIdx
    );

    return { role: "assistant", content: final, thinking: analysis };
  } else if (text.startsWith("<think>")) {
    // DeepSeek R1 format
    const THINK_PREFIX = "<think>";
    const THINK_SUFFIX = "</think>";
    const thinkStartIdx = text.indexOf(THINK_PREFIX);
    if (thinkStartIdx !== 0) {
      return { role: "assistant", content: text };
    }
    const thinkEndIdx = text.indexOf(
      THINK_SUFFIX,
      thinkStartIdx + THINK_PREFIX.length
    );
    if (thinkEndIdx === -1) {
      return {
        role: "assistant",
        content: "",
        thinking: text.slice(thinkStartIdx + THINK_PREFIX.length),
      };
    }

    const thinking = text.slice(
      thinkStartIdx + THINK_PREFIX.length,
      thinkEndIdx
    );

    const endIdx = text.indexOf(
      "<|im_end|>",
      thinkEndIdx + THINK_SUFFIX.length
    );
    const content = text.slice(
      thinkEndIdx + THINK_SUFFIX.length,
      endIdx === -1 ? undefined : endIdx
    );
    return { role: "assistant", content: content, thinking: thinking };
  } else {
    return { role: "assistant", content: text };
  }
}

export function convertFromHarmony(model: string, messages: any) {
  if (model.startsWith("qwen/")) {
    if (!Array.isArray(messages)) return messages;
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      reasoning_content: msg.thinking,
    }));
  }

  return messages;
}

export function convertToHarmony(model: string, messages: any) {
  if (model.startsWith("qwen/")) {
    if (!Array.isArray(messages)) return messages;
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      thinking: msg.reasoning_content,
    }));
  }

  return messages;
}
