'use client';
import React, { useState, useCallback, useRef } from 'react';
import {
    ChevronRight, Plus, X, Link2, Upload, FileText,
    Film, Image as ImageIcon, Archive, FileCode, File as FileIcon,
    Clock, CalendarDays, Zap, GripVertical,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════
 *  TYPES
 * ══════════════════════════════════════════════════════════ */
export interface RoundData {
    name:         string;
    description:  string;
    criteria:     string[];
    requirements: string[];
    startDate:    string;
    startTime:    string;
    deadlineDate: string;
    deadlineTime: string;
    links:        string[];
    files:        File[];   // реальні browser File objects
}

interface Props {
    roundCount:     number;
    selectedRound:  number;
    onSelectRound:  (n: number) => void;
    onRoundsChange: (data: Record<number, RoundData>) => void;
}

/* ══════════════════════════════════════════════════════════
 *  HELPERS
 * ══════════════════════════════════════════════════════════ */
function emptyRound(): RoundData {
    return {
        name: '', description: '', criteria: [''], requirements: [''],
        startDate: '', startTime: '', deadlineDate: '', deadlineTime: '',
        links: [''], files: [],
    };
}

function getFileIcon(file: File) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const sz = 14;
    if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext))
        return <ImageIcon size={sz} className="text-purple-400 flex-shrink-0" />;
    if (['mp4','webm','mov','avi','mkv'].includes(ext))
        return <Film size={sz} className="text-pink-400 flex-shrink-0" />;
    if (ext === 'pdf')
        return <FileText size={sz} className="text-red-400 flex-shrink-0" />;
    if (['zip','rar','7z','tar','gz'].includes(ext))
        return <Archive size={sz} className="text-yellow-400 flex-shrink-0" />;
    if (['js','ts','jsx','tsx','py','go','rs','java','c','cpp','cs','html','css','json','yaml','md','sh'].includes(ext))
        return <FileCode size={sz} className="text-blue-400 flex-shrink-0" />;
    return <FileIcon size={sz} className="text-(--t2) flex-shrink-0" />;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidUrl(s: string): boolean {
    try { new URL(s); return true; } catch { return false; }
}

const inp = "w-full px-3 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all placeholder:text-(--t2)/50";

/* ══════════════════════════════════════════════════════════
 *  FILE PREVIEW CHIP
 * ══════════════════════════════════════════════════════════ */
function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [preview, setPreview] = useState<string | null>(null);
    const isImage = file.type.startsWith('image/');

    React.useEffect(() => {
        if (!isImage) return;
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isImage]);

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) group relative overflow-hidden">
        {/* image thumbnail */}
        {isImage && preview ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-(--brd)">
            <img src={preview} alt={file.name} className="w-full h-full object-cover" />
            </div>
        ) : (
            <div className="w-8 h-8 rounded-lg bg-(--card) flex items-center justify-center flex-shrink-0 border border-(--brd)">
            {getFileIcon(file)}
            </div>
        )}
        <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-(--t1) truncate">{file.name}</p>
        <p className="text-[10px] text-(--t2)">{formatBytes(file.size)}</p>
        </div>
        <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center transition-colors flex-shrink-0"
        title="Видалити файл"
        >
        <X size={11} className="text-red-400" />
        </button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
 *  LINK CHIP
 * ══════════════════════════════════════════════════════════ */
function LinkChip({ url, onRemove }: { url: string; onRemove: () => void }) {
    const valid = isValidUrl(url);
    let host = url;
    try { host = new URL(url).hostname.replace('www.', ''); } catch {}

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${valid ? 'border-(--brd) bg-(--bg)' : 'border-red-500/30 bg-red-500/5'} group`}>
        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
        <Link2 size={12} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
        {valid ? (
            <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-blue-400 hover:underline truncate block"
            title={url}
            >
            {host}
            </a>
        ) : (
            <p className="text-xs font-semibold text-red-400 truncate">{url || '—'}</p>
        )}
        <p className="text-[10px] text-(--t2) truncate">{url}</p>
        </div>
        <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center transition-colors flex-shrink-0"
        title="Видалити посилання"
        >
        <X size={11} className="text-red-400" />
        </button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
 *  DROP ZONE
 * ══════════════════════════════════════════════════════════ */
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handle = (fileList: FileList | null) => {
        if (!fileList) return;
        onFiles(Array.from(fileList));
    };

    return (
        <div
        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`
            relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none
            ${dragging
                ? 'border-blue-500 bg-blue-500/8 scale-[1.01]'
                : 'border-(--brd) hover:border-blue-500/50 hover:bg-blue-500/4'
            }
            `}
            >
            <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handle(e.target.files)}
            />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-500/15' : 'bg-(--card)'}`}>
            <Upload size={18} className={dragging ? 'text-blue-400' : 'text-(--t2)'} />
            </div>
            <div className="text-center">
            <p className="text-xs font-bold text-(--t1)">
            {dragging ? 'Відпустіть файли' : 'Перетягніть файли або натисніть'}
            </p>
            <p className="text-[10px] text-(--t2) mt-0.5">Будь-який формат • Кілька файлів одночасно</p>
            </div>
            </div>
    );
}

/* ══════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════ */
export default function RoundSettingsPanel({
    roundCount,
    selectedRound,
    onSelectRound,
    onRoundsChange,
}: Props) {
    const [rounds, setRounds] = useState<Record<number, RoundData>>({});
    // Track new link input per round
    const [linkInputs, setLinkInputs] = useState<Record<number, string>>({});

    const getRound = (n: number): RoundData => rounds[n] ?? emptyRound();

    const update = useCallback((n: number, patch: Partial<RoundData>) => {
        setRounds(prev => {
            const next = { ...prev, [n]: { ...(prev[n] ?? emptyRound()), ...patch } };
            onRoundsChange(next);
            return next;
        });
    }, [onRoundsChange]);

    const rd = getRound(selectedRound);

    /* ── link helpers ── */
    const currentLinkInput = linkInputs[selectedRound] ?? '';
    const setLinkInput = (v: string) => setLinkInputs(p => ({ ...p, [selectedRound]: v }));

    const addLink = () => {
        const url = currentLinkInput.trim();
        if (!url) return;
        const existing = rd.links.filter(Boolean);
        update(selectedRound, { links: [...existing, url] });
        setLinkInput('');
    };

    const removeLink = (idx: number) => {
        const next = rd.links.filter((_, i) => i !== idx);
        update(selectedRound, { links: next.length ? next : [] });
    };

    /* ── file helpers ── */
    const addFiles = (files: File[]) => {
        const existing = (rd.files ?? []).filter(f => f instanceof File);
        // deduplicate by name+size
        const deduped = files.filter(
            f => !existing.some(e => e.name === f.name && e.size === f.size)
        );
        update(selectedRound, { files: [...existing, ...deduped] });
    };

    const removeFile = (idx: number) => {
        const next = (rd.files ?? []).filter((_, i) => i !== idx);
        update(selectedRound, { files: next });
    };

    /* ── criteria / requirements ── */
    const updateList = (field: 'criteria' | 'requirements', idx: number, val: string) => {
        const arr = [...(rd[field] ?? [''])];
        arr[idx] = val;
        update(selectedRound, { [field]: arr });
    };
    const addListItem = (field: 'criteria' | 'requirements') => {
        update(selectedRound, { [field]: [...(rd[field] ?? []), ''] });
    };
    const removeListItem = (field: 'criteria' | 'requirements', idx: number) => {
        const arr = (rd[field] ?? []).filter((_, i) => i !== idx);
        update(selectedRound, { [field]: arr.length ? arr : [''] });
    };

    const visibleLinks = rd.links.filter(Boolean);
    const visibleFiles = (rd.files ?? []).filter(f => f instanceof File);

    return (
        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden flex flex-col">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0">
        <ChevronRight size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">Налаштування раундів</span>
        </div>

        {/* ── ROUND TABS ── */}
        {roundCount > 1 && (
            <div className="flex gap-1.5 px-5 pt-4 flex-wrap">
            {Array.from({ length: roundCount }, (_, i) => i + 1).map(n => (
                <button
                key={n}
                type="button"
                onClick={() => onSelectRound(n)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all active:scale-90 ${
                    n === selectedRound
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-500/50 hover:text-blue-500'
                }`}
                >
                Раунд {n}
                </button>
            ))}
            </div>
        )}

        {/* ── FORM BODY ── */}
        <div className="p-5 flex flex-col gap-5 overflow-y-auto">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Назва раунду</label>
        <input
        type="text"
        value={rd.name}
        onChange={e => update(selectedRound, { name: e.target.value })}
        placeholder={`Раунд ${selectedRound}`}
        className={inp}
        />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Опис</label>
        <textarea
        value={rd.description}
        onChange={e => update(selectedRound, { description: e.target.value })}
        placeholder="Опис завдання раунду..."
        rows={3}
        className={inp + " resize-y"}
        />
        </div>

        {/* Criteria */}
        <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Критерії оцінювання</label>
        <button type="button" onClick={() => addListItem('criteria')}
        className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors">
        <Plus size={11} /> Додати
        </button>
        </div>
        {(rd.criteria ?? ['']).map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
            <GripVertical size={14} className="text-(--t2)/30 flex-shrink-0" />
            <input
            type="text"
            value={c}
            onChange={e => updateList('criteria', i, e.target.value)}
            placeholder={`Критерій ${i + 1}`}
            className={inp}
            />
            {(rd.criteria ?? []).length > 1 && (
                <button type="button" onClick={() => removeListItem('criteria', i)}
                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <X size={12} className="text-red-400" />
                </button>
            )}
            </div>
        ))}
        </div>

        {/* Requirements / Technologies */}
        <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Технології / Вимоги</label>
        <button type="button" onClick={() => addListItem('requirements')}
        className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors">
        <Plus size={11} /> Додати
        </button>
        </div>
        {(rd.requirements ?? ['']).map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
            <GripVertical size={14} className="text-(--t2)/30 flex-shrink-0" />
            <input
            type="text"
            value={r}
            onChange={e => updateList('requirements', i, e.target.value)}
            placeholder={`Наприклад: React, Python...`}
            className={inp}
            />
            {(rd.requirements ?? []).length > 1 && (
                <button type="button" onClick={() => removeListItem('requirements', i)}
                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <X size={12} className="text-red-400" />
                </button>
            )}
            </div>
        ))}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex items-center gap-1">
        <CalendarDays size={10} /> Старт
        </label>
        <input type="date" value={rd.startDate}
        onChange={e => update(selectedRound, { startDate: e.target.value })}
        className={inp} style={{ colorScheme: 'dark' }} />
        <input type="time" value={rd.startTime}
        onChange={e => update(selectedRound, { startTime: e.target.value })}
        className={inp} style={{ colorScheme: 'dark' }} />
        </div>
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex items-center gap-1">
        <Clock size={10} /> Дедлайн <span className="text-red-500 flex items-center"><Zap size={9} className="fill-red-500" /></span>
        </label>
        <input type="date" value={rd.deadlineDate}
        onChange={e => update(selectedRound, { deadlineDate: e.target.value })}
        className={inp} style={{ colorScheme: 'dark' }} />
        <input type="time" value={rd.deadlineTime}
        onChange={e => update(selectedRound, { deadlineTime: e.target.value })}
        className={inp} style={{ colorScheme: 'dark' }} />
        </div>
        </div>

        {/* ══════════════════════════════════════════
            ATTACHMENTS SECTION
            ══════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-(--brd)">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Link2 size={11} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
            Вкладення
            </span>
            {(visibleLinks.length + visibleFiles.length) > 0 && (
                <span className="ml-auto text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {visibleLinks.length + visibleFiles.length}
                </span>
            )}
            </div>

            {/* ── Link input ── */}
            <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Додати посилання</label>
            <div className="flex gap-2">
            <input
            type="url"
            value={currentLinkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="https://example.com"
            className={inp + " flex-1"}
            />
            <button
            type="button"
            onClick={addLink}
            disabled={!currentLinkInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
            >
            <Plus size={13} /> Додати
            </button>
            </div>
            </div>

            {/* ── Link chips preview ── */}
            {visibleLinks.length > 0 && (
                <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
                Посилання ({visibleLinks.length})
                </p>
                <div className="flex flex-col gap-1.5">
                {visibleLinks.map((url, i) => (
                    <LinkChip key={i} url={url} onRemove={() => removeLink(i)} />
                ))}
                </div>
                </div>
            )}

            {/* ── File dropzone ── */}
            <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Прикріпити файли</label>
            <DropZone onFiles={addFiles} />
            </div>

            {/* ── File chips preview ── */}
            {visibleFiles.length > 0 && (
                <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
                Файли ({visibleFiles.length})
                </p>
                <div className="flex flex-col gap-1.5">
                {visibleFiles.map((file, i) => (
                    <FileChip key={`${file.name}-${file.size}-${i}`} file={file} onRemove={() => removeFile(i)} />
                ))}
                </div>
                </div>
            )}

            {/* Empty state */}
            {visibleLinks.length === 0 && visibleFiles.length === 0 && (
                <p className="text-center text-[11px] text-(--t2) py-2 italic">
                Поки що немає вкладень
                </p>
            )}
            </div>

            </div>
            {/* end form body */}
            </div>
    );
}
