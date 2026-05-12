"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
    Bold, Italic, Underline, Strikethrough, Code,
    Heading1, Heading2, Type, List, Quote,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface RichTextEditorProps {
    /** HTML string — what you store in state/DB */
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    rows?: number;
}

// ── Component ──────────────────────────────────────────────────────────────
export function RichTextEditor({
    value,
    onChange,
    placeholder = "Введіть текст...",
    rows = 6,
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);

    const [active, setActive] = useState({
        bold: false, italic: false, underline: false,
        strike: false, code: false,
        h1: false, h2: false, h3: false,
        ul: false, blockquote: false,
    });

    // ── Sync value → DOM only from outside (avoids cursor jump) ──────────
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        // Не перезаписуємо DOM поки користувач редагує — інакше курсор скидається
        if (document.activeElement === el) return;
        if (el.innerHTML !== value) {
            el.innerHTML = value;
        }
    }, [value]);

    // ── Detect active formats at cursor ───────────────────────────────────
    const refreshActive = useCallback(() => {
        const next = {
            bold:       document.queryCommandState("bold"),
                                      italic:     document.queryCommandState("italic"),
                                      underline:  document.queryCommandState("underline"),
                                      strike:     document.queryCommandState("strikeThrough"),
                                      code: false, h1: false, h2: false, h3: false, blockquote: false,
                                      ul:         document.queryCommandState("insertUnorderedList"),
        };
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            let node: Node | null = sel.anchorNode;
            while (node && node !== editorRef.current) {
                const tag = (node as HTMLElement).tagName?.toLowerCase();
                if (tag === "code")       next.code = true;
                if (tag === "h1")         next.h1 = true;
                if (tag === "h2")         next.h2 = true;
                if (tag === "h3")         next.h3 = true;
                if (tag === "blockquote") next.blockquote = true;
                node = node.parentNode;
            }
        }
        setActive(next);
    }, []);

    // ── Save selection before toolbar steals focus ────────────────────────
    const saveRange = useCallback(() => {
        const sel = window.getSelection();
        if (sel?.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
    }, []);

        // ── Emit HTML on every edit ───────────────────────────────────────────
        const handleInput = useCallback(() => {
            const el = editorRef.current;
            if (!el) return;
            onChange(el.innerHTML);
        }, [onChange]);

        // ── Restore selection into editor ─────────────────────────────────────
        const restoreSelection = useCallback(() => {
            const el = editorRef.current;
            if (!el) return;
            el.focus();
            const sel = window.getSelection();
            if (savedRange.current) {
                sel?.removeAllRanges();
                sel?.addRange(savedRange.current);
            }
        }, []);

        // ── Inline formats are mutually exclusive ────────────────────────────
        const INLINE_FORMATS = ["bold", "italic", "underline", "strikeThrough"];

        // ── execCommand-based formatting ──────────────────────────────────────
        // Inline formats (bold/italic/underline/strike): activating one turns off all others
        const cmd = useCallback((command: string) => {
            restoreSelection();

            if (INLINE_FORMATS.includes(command)) {
                const isCurrentlyOn = document.queryCommandState(command);
                // Turn off every other active inline format
                INLINE_FORMATS.forEach(f => {
                    if (f !== command && document.queryCommandState(f)) {
                        document.execCommand(f, false, undefined);
                    }
                });
                // Apply the chosen format (only if it wasn't already on — acts as toggle off)
                if (!isCurrentlyOn) {
                    document.execCommand(command, false, undefined);
                }
            } else {
                document.execCommand(command, false, undefined);
            }

            handleInput();
            requestAnimationFrame(refreshActive);
        }, [restoreSelection, handleInput, refreshActive]);

        // ── Inline <code> toggle ──────────────────────────────────────────────
        const wrapCode = useCallback(() => {
            restoreSelection();
            const el = editorRef.current;
            const sel = window.getSelection();
            if (!el || !sel?.rangeCount) return;

            // Unwrap if cursor is inside <code>
            let node: Node | null = sel.anchorNode;
            while (node && node !== el) {
                if ((node as HTMLElement).tagName?.toLowerCase() === "code") {
                    const parent = node.parentNode!;
                    while ((node as HTMLElement).firstChild)
                        parent.insertBefore((node as HTMLElement).firstChild!, node);
                    parent.removeChild(node);
                    handleInput();
                    return;
                }
                node = node.parentNode;
            }

            const range = sel.getRangeAt(0);
            const code = document.createElement("code");
            if (range.collapsed) {
                code.textContent = "код";
                range.insertNode(code);
                range.selectNodeContents(code);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                code.appendChild(range.extractContents());
                range.insertNode(code);
            }
            handleInput();
            requestAnimationFrame(refreshActive);
        }, [restoreSelection, handleInput, refreshActive]);

        // ── Block-level toggle (h1/h2/h3/blockquote) ─────────────────────────
        const toggleBlock = useCallback((tag: string) => {
            restoreSelection();
            const el = editorRef.current;
            const sel = window.getSelection();
            if (!el || !sel?.rangeCount) return;

            let target: Node | null = sel.anchorNode;
            while (target && target !== el) {
                const t = (target as HTMLElement).tagName?.toLowerCase();
                if (["p", "div", "h1", "h2", "h3", "blockquote", "li"].includes(t)) break;
                target = target.parentNode;
            }
            if (!target || target === el) return;

            const currentTag = (target as HTMLElement).tagName.toLowerCase();
            const newTag = currentTag === tag ? "p" : tag;
            const newEl = document.createElement(newTag);
            newEl.innerHTML = (target as HTMLElement).innerHTML;
            (target as HTMLElement).replaceWith(newEl);

            const range = document.createRange();
            range.selectNodeContents(newEl);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);

            handleInput();
            requestAnimationFrame(refreshActive);
        }, [restoreSelection, handleInput, refreshActive]);

        // ── Keyboard shortcuts ────────────────────────────────────────────────
        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === "b") { e.preventDefault(); cmd("bold"); }
                if (e.key === "i") { e.preventDefault(); cmd("italic"); }
                if (e.key === "u") { e.preventDefault(); cmd("underline"); }
            }
        };

        // ── Toolbar config ────────────────────────────────────────────────────
        const tools = [
            { icon: Bold,          label: "Жирний",      on: active.bold,       action: () => cmd("bold") },
            { icon: Italic,        label: "Курсив",       on: active.italic,     action: () => cmd("italic") },
            { icon: Underline,     label: "Підкреслення", on: active.underline,  action: () => cmd("underline") },
            { icon: Strikethrough, label: "Закреслення",  on: active.strike,     action: () => cmd("strikeThrough") },
            { icon: Code,          label: "Код",          on: active.code,       action: wrapCode },
            null,
            { icon: Heading1,      label: "H1",           on: active.h1,         action: () => toggleBlock("h1") },
            { icon: Heading2,      label: "H2",           on: active.h2,         action: () => toggleBlock("h2") },
            { icon: Type,          label: "H3",           on: active.h3,         action: () => toggleBlock("h3") },
            null,
            { icon: List,          label: "Список",       on: active.ul,         action: () => cmd("insertUnorderedList") },
            { icon: Quote,         label: "Цитата",       on: active.blockquote, action: () => toggleBlock("blockquote") },
        ];

        return (
            <div className="border border-(--brd) rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-600 transition-all bg-(--card)">

            {/* Toolbar */}
            <div className="px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
            {tools.map((t, i) =>
                t === null
                ? <div key={i} className="w-px h-4 bg-(--brd) mx-1 flex-shrink-0" />
                : (
                    <button
                    key={t.label}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); t.action(); }}
                    title={t.label}
                    className={`relative w-7 h-7 flex items-center justify-center rounded-lg transition-colors group ${
                        t.on
                        ? "bg-blue-600/20 text-blue-500"
                        : "text-(--t2) hover:bg-blue-600/10 hover:text-blue-500"
                    }`}
                    >
                    <t.icon className="w-3.5 h-3.5" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-md bg-(--t1) text-(--bg) text-[9px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {t.label}
                    </span>
                    </button>
                )
            )}
            </div>

            {/* Divider */}
            <div className="h-px bg-(--brd) mx-3" />

            {/* Editor */}
            <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={() => { refreshActive(); saveRange(); }}
            onMouseUp={() => { refreshActive(); saveRange(); }}
            onFocus={() => { refreshActive(); saveRange(); }}
            onSelect={() => saveRange()}
            data-placeholder={placeholder}
            className="wysiwyg w-full px-5 py-4 outline-none text-sm text-(--t1) leading-relaxed"
            style={{ minHeight: `${rows * 1.75}rem` }}
            />
                </div>
        );
}

export default RichTextEditor;
