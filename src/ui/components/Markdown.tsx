// Requirement IDs: DP-UI · visual_identity_plan.md §7.11
//
// A deliberately small Markdown block renderer — enough for the product story
// in design_documents/real-life-usecase-opsflow.md and nothing more.
//
// Why not a library: the story is one document with a known vocabulary
// (headings, blockquote, rules, bullets, bold/italic/code, paragraphs), and the
// cold-load budget is 1.5 s to five registered tools (NFR-10). A parser plus a
// sanitiser would cost more bundle than the document it renders. No raw HTML is
// ever produced — every node below is a React element, so there is no injection
// surface even though the source is a file in the repository.

import * as React from "react";

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

/** `code`, **bold**, *italic* — everything else is literal text. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const parts = text.split(INLINE);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      out.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith("**") && part.endsWith("**")) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else {
      out.push(<React.Fragment key={key}>{part}</React.Fragment>);
    }
  });
  return out;
}

/**
 * Render Markdown source as React nodes.
 *
 * `headingOffset` demotes every heading by N levels. The story's `#` title would
 * otherwise become a second <h1>, and the console already has exactly one
 * (visual_identity_plan.md §11.1).
 */
export function Markdown({ source, headingOffset = 1 }: { source: string; headingOffset?: number }): JSX.Element {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let n = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const key = `b${n++}`;

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={key} />);
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1]!.length + headingOffset);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key}>{inline(heading[2]!, key)}</Tag>);
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("> ")) {
        buf.push((lines[i] ?? "").slice(2));
        i += 1;
      }
      blocks.push(<blockquote key={key}>{inline(buf.join(" "), key)}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key}>
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`}>{inline(item, `${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !/^(#{1,6}\s|>\s|[-*]\s|---+\s*$)/.test(lines[i] ?? "")) {
      buf.push((lines[i] ?? "").trim());
      i += 1;
    }
    blocks.push(<p key={key}>{inline(buf.join(" "), key)}</p>);
  }

  return <div className="of-md">{blocks}</div>;
}
