"use client";
import type { ReactNode } from "react";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string };

const HEADING = /^#{1,6}\s+/;
const BULLET = /^[-*•]\s+/;
const NUMBERED = /^\d+[.)]\s+/;
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={key} className="rounded-[4px] bg-muted px-1 py-0.5 font-mono text-[0.88em] text-foreground">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={key} className="italic text-foreground/90">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={key}>{part}</span>;
    });
}

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    // Keep intentional line breaks from the model. `white-space: pre-line` below
    // preserves them while still collapsing accidental runs of spaces.
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ kind: "paragraph", text: joined });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (code) {
      if (line.startsWith("```")) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        code.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (HEADING.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: line.replace(HEADING, "") });
      continue;
    }

    if (BULLET.test(line)) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.replace(BULLET, ""));
      continue;
    }

    if (NUMBERED.test(line)) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(line.replace(NUMBERED, ""));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (code && code.length) blocks.push({ kind: "code", text: code.join("\n") });
  flushParagraph();
  flushList();
  return blocks;
}

export default function TeleprompterStream({
  answer,
  fontSize,
  streaming = false,
}: {
  answer: string;
  fontSize: number;
  streaming?: boolean;
}) {
  const blocks = parse(answer);

  return (
    <div
      className="w-full min-w-0 break-words text-left font-medium text-foreground [overflow-wrap:anywhere] [word-break:normal] [text-size-adjust:100%]"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.62, whiteSpace: "pre-line" }}
      aria-live="polite"
    >
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        if (block.kind === "heading") {
          return (
            <p key={key} className={`min-w-0 break-words font-semibold tracking-tight text-foreground ${index ? "mt-4" : ""}`}>
              {inline(block.text, key)}
            </p>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={key} className={`min-w-0 space-y-1.5 ${index ? "mt-3" : ""}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="w-4 shrink-0 select-none text-right font-medium text-muted-foreground/70"
                  >
                    {block.ordered ? `${itemIndex + 1}.` : "•"}
                  </span>
                  <span className="min-w-0 flex-1 break-words [overflow-wrap:break-word]">{inline(item, `${key}-${itemIndex}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "code") {
          return (
            <pre
              key={key}
              className={`max-w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[0.82em] leading-6 text-foreground ${index ? "mt-3" : ""}`}
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        return (
          <p key={key} className={`min-w-0 break-words [overflow-wrap:break-word] ${index ? "mt-3" : ""} text-foreground/95`}>
            {inline(block.text, key)}
          </p>
        );
      })}
      {streaming ? (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse rounded-full bg-primary align-[-0.15em]"
        />
      ) : null}
    </div>
  );
}
