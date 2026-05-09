'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    X, Plus, Upload, Link2, Trash2, AlertTriangle,
} from 'lucide-react';
import { DatePicker, TimePicker } from '@/components/DateTimePicker';
import { RichTextEditor } from '@/components/RichTextEditor';

// ── Types ──────────────────────────────────────────────────────────────────

/** Один критерій оцінювання раунду */
export interface Criterion {
    key: string;
    label: string;
    weight: number; // 0–100, сума всіх повинна = 100
}

export interface RoundData {
    name: string;
    description: string;
    startDate: string;
    startTime: string;
    deadlineDate: string;
    deadlineTime: string;
    evalStartDate: string;
    evalStartTime: string;
    evalEndDate: string;
    evalEndTime: string;
    requirements: string[];
    /** Критерії оцінювання з вагами — обов'язкові */
    criteria: Criterion[];
    links: string[];
    files: FileItem[];
}

export interface FileItem {
    file: File;
    name: string;
    size: number;
    type: string;
}

export interface RoundPanelLabels {
    header?: string;
    round?: string;
    taskName?: string;
    taskNamePlaceholder?: string;
    taskDesc?: string;
    taskDescPlaceholder?: string;
    start?: string;
    startDate?: string;
    deadline?: string;
    deadlineDate?: string;
    requirements?: string;
    requirementsPlaceholder?: string;
    criteria?: string;
    criteriaPlaceholder?: string;
    links?: string;
    addLink?: string;
    files?: string;
    uploadFiles?: string;
    savedInCloud?: string;
    noItems?: string;
    add?: string;
}

interface Props {
    roundCount: number;
    selectedRound: number;
    onSelectRound: (n: number) => void;
    onRoundsChange?: (rounds: Record<number, RoundData>) => void;
    initialData?: Record<number, Partial<RoundData>>;
    labels?: RoundPanelLabels;
}

// ── Validation (exported for parent to block save) ──────────────────────────
export function validateRoundsData(
    rounds: Record<number, RoundData>,
    roundCount: number,
): string | null {
    for (let n = 1; n <= roundCount; n++) {
        const rd = rounds[n];
        if (!rd || rd.criteria.length === 0)
            return `Раунд ${n}: додайте хоча б один критерій оцінювання`;
        if (rd.criteria.some(c => !c.label.trim()))
            return `Раунд ${n}: заповніть назви всіх критеріїв`;
        const total = rd.criteria.reduce((s, c) => s + c.weight, 0);
        if (total !== 100)
            return `Раунд ${n}: сума ваг критеріїв = ${total}%, має бути 100%`;
    }
    return null;
}

// ── Shared styles ──────────────────────────────────────────────────────────
const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";
const label10 = "block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1.5";
const addBtn = "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors mt-2 active:scale-95";

const defaultRound = (): RoundData => ({
    name: '', description: '',
    startDate: '', startTime: '',
    deadlineDate: '', deadlineTime: '',
    evalStartDate: '', evalStartTime: '',
    evalEndDate: '', evalEndTime: '',
    requirements: [], criteria: [], links: [], files: [],
});

// ── DateTimeField ──────────────────────────────────────────────────────────
function DateTimeField({
    label, dateVal, onDate, timeVal, onTime,
}: { label: string; dateVal: string; onDate: (v: string) => void; timeVal: string; onTime: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-1.5">
        <span className={label10}>{label}</span>
        <div className="flex gap-2">
        <div className="flex-1 min-w-0"><DatePicker value={dateVal} onChange={onDate} /></div>
        <div className="flex-1 min-w-0"><TimePicker value={timeVal} onChange={onTime} /></div>
        </div>
        </div>
    );
}

// ── ListField — requirements (plain strings) ───────────────────────────────
function ListField({
    label, items, onChange, placeholder, addLabel, noItemsLabel,
}: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string; addLabel?: string; noItemsLabel?: string }) {
    const addItem = () => onChange([...items, '']);
    const updateItem = (i: number, val: string) => {
        const next = [...items]; next[i] = val; onChange(next);
    };
    const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="flex flex-col">
        <span className={label10}>{label}</span>
        <div className="border border-(--brd) rounded-2xl bg-(--bg) divide-y divide-(--brd) overflow-hidden">
        {items.length === 0 && (
            <p className="text-xs text-(--t2)/50 px-3 py-3 italic">{noItemsLabel ?? 'Ще немає пунктів'}</p>
        )}
        {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 group hover:bg-(--card)/50 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
            <input type="text" value={item} onChange={e => updateItem(i, e.target.value)}
            placeholder={placeholder ?? 'Пункт...'}
            className="flex-1 bg-transparent outline-none text-sm text-(--t1) placeholder:text-(--t2)/40" />
            <button type="button" onClick={() => removeItem(i)}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-lg flex items-center justify-center text-(--t2) hover:text-red-500 transition-all">
            <X size={10} />
            </button>
            </div>
        ))}
        </div>
        <button type="button" onClick={addItem} className={addBtn}>
        <Plus size={10} /> {addLabel ?? 'Додати'}
        </button>
        </div>
    );
}

// ── LinksField ────────────────────────────────────────────────────────────
function LinksField({ links, onChange, labelText, addLinkLabel }: { links: string[]; onChange: (l: string[]) => void; labelText?: string; addLinkLabel?: string }) {
    const addLink = () => onChange([...links, '']);
    const update  = (i: number, v: string) => { const n = [...links]; n[i] = v; onChange(n); };
    const remove  = (i: number) => onChange(links.filter((_, idx) => idx !== i));

    return (
        <div className="flex flex-col">
        <span className={label10}>{labelText ?? 'Посилання'}</span>
        <div className="flex flex-col gap-2">
        {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
            <div className="flex-1 relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--t2)" />
            <input type="url" value={link} onChange={e => update(i, e.target.value)}
            placeholder="https://..." className={inp + " pl-9"} />
            </div>
            <button type="button" onClick={() => remove(i)}
            className="w-9 h-9 rounded-xl border border-(--brd) bg-(--bg) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-400/40 transition-all flex-shrink-0">
            <X size={13} />
            </button>
            </div>
        ))}
        </div>
        <button type="button" onClick={addLink} className={addBtn}>
        <Plus size={10} /> {addLinkLabel ?? 'Додати посилання'}
        </button>
        </div>
    );
}

// ── FilesField ────────────────────────────────────────────────────────────
function FilesField({ files, onChange, labelText, uploadLabel, savedInCloudLabel }: { files: FileItem[]; onChange: (f: FileItem[]) => void; labelText?: string; uploadLabel?: string; savedInCloudLabel?: string }) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []).map(f => ({ file: f, name: f.name, size: f.size, type: f.type }));
        onChange([...files, ...picked]);
        if (inputRef.current) inputRef.current.value = '';
    };

        const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));
        const fmt    = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
        const icon   = (f: FileItem & { existing?: boolean }) => {
            if ((f as any).existing)          return '☁️';
            if (f.type.startsWith('image/'))  return '🖼️';
            if (f.type === 'application/pdf') return '📄';
            if (f.type.includes('zip'))       return '📦';
            return '📎';
        };

        return (
            <div className="flex flex-col gap-2">
            <span className={label10}>{labelText ?? 'Файли'}</span>
            {files.length > 0 && (
                <div className="border border-(--brd) rounded-2xl overflow-hidden bg-(--bg) divide-y divide-(--brd)">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 group hover:bg-(--card)/50 transition-colors">
                    <span className="text-base">{icon(f as any)}</span>
                    <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-(--t1) truncate">{f.name}</p>
                    <p className="text-[10px] text-(--t2)">{(f as any).existing ? (savedInCloudLabel ?? 'Збережено в хмарі') : fmt(f.size)}</p>
                    </div>
                    <button type="button" onClick={() => remove(i)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-(--t2) hover:text-red-500 transition-all">
                    <Trash2 size={11} />
                    </button>
                    </div>
                ))}
                </div>
            )}
            <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFiles} />
            <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-(--brd) text-(--t2) text-xs font-bold hover:border-blue-500/50 hover:text-blue-500 hover:bg-blue-500/5 transition-all active:scale-98"
            >
            <Upload size={14} />
            {uploadLabel ?? 'Завантажити файли'}
            </button>
            </div>
        );
}

// ── RoundSettingsPanel (main export) ──────────────────────────────────────
export default function RoundSettingsPanel({ roundCount, selectedRound, onSelectRound, onRoundsChange, initialData, labels }: Props) {
    const [rounds, setRounds] = useState<Record<number, RoundData>>({});
    const [seeded, setSeeded] = useState(false);

    useEffect(() => {
        if (!initialData || seeded) return;
        if (!Object.keys(initialData).length) return;
        const seeded_: Record<number, RoundData> = {};
        for (const [key, val] of Object.entries(initialData))
            seeded_[Number(key)] = { ...defaultRound(), ...val };
        setRounds(seeded_);
        setSeeded(true);
    }, [initialData, seeded]);

    useEffect(() => { onRoundsChange?.(rounds); }, [rounds]);

    const getRound = (n: number): RoundData => rounds[n] ?? defaultRound();

    const update = useCallback(<K extends keyof RoundData>(n: number, key: K, val: RoundData[K]) => {
        setRounds(prev => {
            const cur = prev[n] ?? defaultRound();
            return { ...prev, [n]: { ...cur, [key]: val } };
        });
    }, []);

    const rd = getRound(selectedRound);
    const hasData = (n: number) => !!(rounds[n]?.name || rounds[n]?.description);

    // Per-round criteria validity indicator on tab
    const criteriaValid = (n: number) => {
        const r = rounds[n];
        if (!r || r.criteria.length === 0) return false;
        if (r.criteria.some(c => !c.label.trim())) return false;
        return r.criteria.reduce((s, c) => s + c.weight, 0) === 100;
    };

    return (
        <div className="sirIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--brd) bg-(--bg)/50 gap-3">
        <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-0.5">{labels?.header ?? 'Параметри раунду'}</p>
        <p className="text-xs font-bold text-(--t1)">{labels?.round ?? 'Раунд'} {selectedRound}</p>
        </div>

        {/* Round tabs */}
        <div className="flex gap-1.5 flex-wrap justify-end flex-1 mx-2">
        {Array.from({ length: roundCount }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => onSelectRound(n)}
            className={`w-7 h-7 rounded-lg font-black text-xs border transition-all active:scale-90 relative ${
                selectedRound === n
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/40 hover:text-blue-500'
            }`}>
            {n}
            {/* green dot = has content; red dot = criteria invalid */}
            {hasData(n) && criteriaValid(n) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 border border-(--card)" />
            )}
            {rounds[n] && !criteriaValid(n) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-(--card)" />
            )}
            </button>
        ))}
        </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">

        {/* 1. Назва */}
        <div>
        <label className={label10}>{labels?.taskName ?? 'Назва завдання'}</label>
        <input
        type="text"
        value={rd.name}
        onChange={e => update(selectedRound, 'name', e.target.value)}
        placeholder={labels?.taskNamePlaceholder ?? 'Назва завдання...'}
        className={inp}
        />
        </div>

        {/* 2. Опис */}
        <div>
        <label className={label10}>{labels?.taskDesc ?? 'Опис того, що треба реалізувати'}</label>
        <RichTextEditor
        value={rd.description}
        onChange={v => update(selectedRound, 'description', v)}
        placeholder={labels?.taskDescPlaceholder ?? 'Детально опишіть завдання...'}
        />
        </div>

        {/* 3. Дедлайни */}
        <div className="grid grid-cols-2 gap-4">
        <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        {labels?.start ?? 'Початок'}
        </p>
        <DateTimeField
        label={labels?.startDate ?? 'Дата старту'}
        dateVal={rd.startDate}
        onDate={v => update(selectedRound, 'startDate', v)}
        timeVal={rd.startTime}
        onTime={v => update(selectedRound, 'startTime', v)}
        />
        </div>
        <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        {labels?.deadline ?? 'Дедлайн'}
        </p>
        <DateTimeField
        label={labels?.deadlineDate ?? 'Дата здачі'}
        dateVal={rd.deadlineDate}
        onDate={v => update(selectedRound, 'deadlineDate', v)}
        timeVal={rd.deadlineTime}
        onTime={v => update(selectedRound, 'deadlineTime', v)}
        />
        </div>
        </div>

        {/* 4. Вимоги + Критерії — 2 колонки */}
        <div className="grid grid-cols-2 gap-4">
        <ListField
        label={labels?.requirements ?? 'Вимоги до технологій'}
        items={rd.requirements}
        onChange={v => update(selectedRound, 'requirements', v)}
        placeholder={labels?.requirementsPlaceholder ?? 'Наприклад: React, TypeScript...'}
        addLabel={labels?.add}
        noItemsLabel={labels?.noItems}
        />
        <ListField
        label={labels?.criteria ?? 'Критерії "must have"'}
        items={rd.criteria}
        onChange={v => update(selectedRound, 'criteria', v)}
        placeholder={labels?.criteriaPlaceholder ?? 'Наприклад: авторизація...'}
        addLabel={labels?.add}
        noItemsLabel={labels?.noItems}
        />
        </div>

        {/* 5. Посилання + Файли — 2 колонки */}
        <div className="grid grid-cols-2 gap-4">
        <LinksField
        links={rd.links}
        onChange={v => update(selectedRound, 'links', v)}
        labelText={labels?.links}
        addLinkLabel={labels?.addLink}
        />
        <FilesField
        files={rd.files}
        onChange={v => update(selectedRound, 'files', v)}
        labelText={labels?.files}
        uploadLabel={labels?.uploadFiles}
        savedInCloudLabel={labels?.savedInCloud}
        />
    </div>

    </div>

    </div>
    );
}
