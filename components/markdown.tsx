import React from "react";

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  // Simple, safe client-side parsing of basic markdown patterns (headers, bold, lists, code blocks)
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLanguage = "";

  const renderedElements = lines.map((line, idx) => {
    // Handle code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        const codeText = codeContent.join("\n");
        codeContent = [];
        return (
          <pre key={idx} className="my-4 overflow-x-auto p-4 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono text-sm">
            <code>{codeText}</code>
          </pre>
        );
      } else {
        inCodeBlock = true;
        codeLanguage = line.trim().substring(3) || "text";
        return null;
      }
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return null;
    }

    // Handle headers
    if (line.startsWith("# ")) {
      return <h1 key={idx} className="text-2xl font-bold mt-6 mb-3 text-white border-b border-slate-800 pb-2">{parseInline(line.substring(2))}</h1>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={idx} className="text-xl font-bold mt-5 mb-2 text-white">{parseInline(line.substring(3))}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={idx} className="text-lg font-bold mt-4 mb-2 text-slate-100">{parseInline(line.substring(4))}</h3>;
    }

    // Handle bullet points
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      return (
        <li key={idx} className="ml-6 list-disc mb-1 text-slate-300">
          {parseInline(line.trim().substring(2))}
        </li>
      );
    }

    // Handle numbered lists
    const numMatch = line.trim().match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return (
        <li key={idx} className="ml-6 list-decimal mb-1 text-slate-300">
          {parseInline(numMatch[2])}
        </li>
      );
    }

    // Handle blockquotes
    if (line.trim().startsWith(">")) {
      return (
        <blockquote key={idx} className="border-l-4 border-cyan-500 pl-4 py-1 my-3 bg-slate-900/50 rounded-r text-slate-300 italic">
          {parseInline(line.trim().substring(1).trim())}
        </blockquote>
      );
    }

    // Default paragraph
    if (line.trim() === "") {
      return <div key={idx} className="h-2" />;
    }

    return (
      <p key={idx} className="mb-3 text-slate-300 leading-relaxed">
        {parseInline(line)}
      </p>
    );
  });

  return <div className="markdown-body">{renderedElements}</div>;
}

// Simple inline parser for bold, italic, and inline code
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let index = 0;

  // Regex patterns
  const boldPattern = /\*\*(.*?)\*\*/g;
  const codePattern = /`(.*?)`/g;

  // Combine patterns and scan from left to right
  let match;
  let matches: { start: number; end: number; type: "bold" | "code"; text: string }[] = [];

  // Find all bold matches
  let boldRegex = new RegExp(boldPattern);
  while ((match = boldRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: boldRegex.lastIndex,
      type: "bold",
      text: match[1]
    });
  }

  // Find all inline code matches
  let codeRegex = new RegExp(codePattern);
  while ((match = codeRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: codeRegex.lastIndex,
      type: "code",
      text: match[1]
    });
  }

  // Sort matches by start index
  matches.sort((a, b) => a.start - b.start);

  // Reconstruct text with React elements
  let lastIndex = 0;
  for (const m of matches) {
    // If overlap, skip
    if (m.start < lastIndex) continue;

    // Add preceding text
    if (m.start > lastIndex) {
      parts.push(text.substring(lastIndex, m.start));
    }

    // Add formatted component
    if (m.type === "bold") {
      parts.push(<strong key={m.start} className="font-bold text-white">{m.text}</strong>);
    } else if (m.type === "code") {
      parts.push(<code key={m.start} className="bg-slate-900 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-sm">{m.text}</code>);
    }

    lastIndex = m.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
