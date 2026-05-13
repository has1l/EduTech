"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

// Splits text into alternating plain/math segments.
// Handles \(...\) inline and \[...\] / $$...$$ display math.
function parseSegments(text: string) {
  const segments: { content: string; display: boolean; isMath: boolean }[] = [];
  const re = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ content: text.slice(last, m.index), isMath: false, display: false });
    }
    const isDisplay = m[1] !== undefined || m[2] !== undefined;
    const latex = (m[1] ?? m[2] ?? m[3]).trim();
    segments.push({ content: latex, isMath: true, display: isDisplay });
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    segments.push({ content: text.slice(last), isMath: false, display: false });
  }

  return segments;
}

function renderLatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode: display, throwOnError: false });
  } catch {
    return latex;
  }
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = parseSegments(text);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.isMath ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, seg.display) }}
          />
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </span>
  );
}
