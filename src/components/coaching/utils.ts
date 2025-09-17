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
  { fallback: React.ReactNode; children: React.ReactNode },
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
