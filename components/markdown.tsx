import React from "react";

interface MarkdownProps {
  content: string;
}

/**
 * Minimal, dependency-free markdown renderer for LLM output.
 * Supports headers, code blocks, lists, blockquotes, bold, and inline code.
 * Styled via the `.markdown-body` rules in globals.css.
 */
export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = i;

    if (line.trim().startsWith("```")) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      elements.push(
        <pre key={key}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      if (i < lines.length) i += 1; // consume closing fence
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={key}>{parseInline(line.substring(2))}</h1>);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={key}>{parseInline(line.substring(3))}</h2>);
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={key}>{parseInline(line.substring(4))}</h3>);
      i += 1;
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <li key={key} className="unordered">
          {parseInline(line.trim().substring(2))}
        </li>
      );
      i += 1;
      continue;
    }

    const numMatch = line.trim().match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      elements.push(
        <li key={key} className="ordered">
          {parseInline(numMatch[2])}
        </li>
      );
      i += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      elements.push(
        <blockquote key={key}>{parseInline(line.trim().substring(1).trim())}</blockquote>
      );
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={key} className="paragraph-gap" />);
      i += 1;
      continue;
    }

    elements.push(<p key={key}>{parseInline(line)}</p>);
    i += 1;
  }

  return <div className="markdown-body">{elements}</div>;
}

interface InlineMatch {
  start: number;
  end: number;
  type: "bold" | "code";
  text: string;
}

function parseInline(text: string): React.ReactNode[] {
  const matches: InlineMatch[] = [];

  for (const match of text.matchAll(/\*\*(.*?)\*\*/g)) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "bold",
      text: match[1]
    });
  }

  for (const match of text.matchAll(/`(.*?)`/g)) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "code",
      text: match[1]
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const m of matches) {
    if (m.start < lastIndex) continue;

    if (m.start > lastIndex) {
      parts.push(text.substring(lastIndex, m.start));
    }

    if (m.type === "bold") {
      parts.push(<strong key={m.start}>{m.text}</strong>);
    } else {
      parts.push(<code key={m.start}>{m.text}</code>);
    }

    lastIndex = m.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
