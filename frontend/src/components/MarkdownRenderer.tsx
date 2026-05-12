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
    className={`rich-preview text-sm text-(--t1) leading-relaxed break-words overflow-hidden min-w-0 ${className}`}
    dangerouslySetInnerHTML={{ __html: content }}
    />
      </>
  );
}

export default MarkdownRenderer;
