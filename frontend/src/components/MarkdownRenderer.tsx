"use client";

import React from "react";

// ── Component ─────────────────────────────────────────────────────────────────
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;
  return (
    <>
    <div
    className={`rich-preview text-sm text-(--t1) leading-relaxed ${className}`}
    dangerouslySetInnerHTML={{ __html: content }}
    />
    <style jsx global>{`
      .rich-preview h1 { font-size: 1.35em; font-weight: 900; margin: 0.6em 0 0.3em; letter-spacing: -0.02em; }
      .rich-preview h2 { font-size: 1.15em; font-weight: 800; margin: 0.5em 0 0.25em; }
      .rich-preview h3 { font-size: 1.05em; font-weight: 700; margin: 0.4em 0 0.2em; }
      .rich-preview p  { margin: 0.35em 0; line-height: 1.65; }
      .rich-preview ul { margin: 0.4em 0; padding-left: 1.4em; list-style: disc; }
      .rich-preview li { margin: 0.2em 0; line-height: 1.55; }
      .rich-preview blockquote {
        border-left: 3px solid rgb(59 130 246 / 0.5);
        padding: 0.25em 0.8em;
        margin: 0.5em 0;
        color: var(--t2);
        font-style: italic;
        background: rgb(59 130 246 / 0.05);
        border-radius: 0 0.5rem 0.5rem 0;
      }
      .rich-preview code {
        background: var(--bg);
        border: 1px solid var(--brd);
        border-radius: 0.35em;
        padding: 0.1em 0.4em;
        font-family: ui-monospace, monospace;
        font-size: 0.85em;
      }
      .rich-preview strong, .rich-preview b { font-weight: 800; }
      .rich-preview em, .rich-preview i    { font-style: italic; }
      .rich-preview u  { text-decoration: underline; text-underline-offset: 3px; }
      .rich-preview s  { text-decoration: line-through; opacity: 0.7; }
      .rich-preview a  { color: rgb(59 130 246); text-decoration: underline; }
      `}</style>
      </>
  );
}

export default MarkdownRenderer;
