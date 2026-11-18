import { useState } from 'react';
import { pick } from '../state/util';

/** 案内役のひとこと。触れるたびに違うセリフが出る */
export function useSpeech(lines: string[]) {
  const [line, setLine] = useState<{ text: string; key: number } | null>(null);
  const say = () => {
    const others = lines.filter((l) => l !== line?.text);
    const next = { text: pick(others.length ? others : lines), key: Date.now() };
    setLine(next);
    window.setTimeout(() => setLine((cur) => (cur?.key === next.key ? null : cur)), 4200);
  };
  return { line: line?.text ?? null, lineKey: line?.key, say };
}
