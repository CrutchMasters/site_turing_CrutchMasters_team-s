"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { X, Loader } from "lucide-react";

// Розміри кропера банера (16:5 ratio — типовий розмір шапки турніру)
const W = 480;
const H = 150;

interface Props {
    /** ID турніру (або іншої сутності) */
    entityId: string;
    /** Поточний banner_url (щоб видалити старий файл після заміни) */
    currentBannerUrl?: string;
    onSave: (url: string) => void;
    onClose: () => void;
    supabase: any;
    /**
     * Якщо передано — завантаження йде через Supabase Storage напряму,
     * і banner_url оновлюється в таблиці `table` по колонці `idColumn`.
     * Якщо не передано — використовується `apiUpload`.
     */
    storageConfig?: {
        bucket: string;      // напр. "banners"
        table: string;       // напр. "tournaments"
        idColumn: string;    // напр. "id"
        urlColumn: string;   // напр. "banner_url"
    };
    /**
     * Якщо storageConfig не передано — використовується цей callback
     * для завантаження через API. Має повертати публічний URL банера.
     */
    apiUpload?: (blob: Blob) => Promise<string>;
}

export default function BannerEditorModal({
    entityId,
    currentBannerUrl,
    onSave,
    onClose,
    supabase,
    storageConfig,
    apiUpload,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(100);
    const [rotate, setRotate] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [uploading, setUploading] = useState(false);

    const draw = useCallback((
        image?: HTMLImageElement | null,
        sc?: number,
        rot?: number,
        off?: { x: number; y: number }
    ) => {
        const canvas = canvasRef.current;
        const i = image ?? img;
        const s = sc ?? scale;
        const r = rot ?? rotate;
        const o = off ?? offset;
        if (!canvas || !i) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.translate(W / 2 + o.x, H / 2 + o.y);
        ctx.rotate((r * Math.PI) / 180);
        ctx.scale(s / 100, s / 100);
        ctx.drawImage(i, -i.width / 2, -i.height / 2);
        ctx.restore();
    }, [img, scale, rotate, offset]);

    useEffect(() => { draw(); }, [draw]);

    const loadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const image = new Image();
            image.onload = () => {
                // Підбираємо масштаб щоб зображення вписалося в кропер
                const fitScale = Math.min(200, Math.max(
                    (W / image.width) * 100,
                    (H / image.height) * 100
                ));
                const rounded = Math.round(fitScale);
                setImg(image);
                setScale(rounded);
                setRotate(0);
                setOffset({ x: 0, y: 0 });
                draw(image, rounded, 0, { x: 0, y: 0 });
            };
            image.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setUploading(true);
        try {
            const blob: Blob = await new Promise(res =>
                canvas.toBlob(b => res(b!), "image/webp", 0.88)
            );

            let finalUrl: string;

            if (storageConfig) {
                // --- Шлях через Supabase Storage напряму ---
                const { bucket, table, idColumn, urlColumn } = storageConfig;
                const timestamp = Date.now();
                const path = `${entityId}/banner_${timestamp}.webp`;

                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(path, blob, { contentType: "image/webp" });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(path);

                finalUrl = `${urlData.publicUrl}?v=${timestamp}`;

                // Оновлюємо БД
                const { error: updateError } = await supabase
                    .from(table)
                    .update({ [urlColumn]: finalUrl })
                    .eq(idColumn, entityId);

                if (updateError) throw updateError;

                // Видаляємо старий банер із Storage
                if (currentBannerUrl) {
                    try {
                        const url = new URL(currentBannerUrl);
                        const parts = url.pathname.split(`/object/public/${bucket}/`);
                        if (parts[1]) {
                            const oldPath = parts[1].split("?")[0];
                            await supabase.storage.from(bucket).remove([oldPath]);
                        }
                    } catch { /* ігноруємо помилку видалення старого */ }
                }
            } else if (apiUpload) {
                // --- Шлях через API (поточний механізм турнірів) ---
                finalUrl = await apiUpload(blob);
            } else {
                throw new Error("Не вказано storageConfig або apiUpload");
            }

            onSave(finalUrl);
            onClose();
        } catch (err: any) {
            console.error("Banner upload error:", err);
            alert(err?.message ?? "Помилка завантаження банера");
        } finally {
            setUploading(false);
        }
    };

    // --- Drag (mouse) ---
    const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const onMouseDown = (e: React.MouseEvent) => {
        dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragRef.current) return;
        const newOff = {
            x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
            y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
        };
        setOffset(newOff);
        draw(undefined, undefined, undefined, newOff);
    };
    const onMouseUp = () => { dragRef.current = null; };

    // --- Drag (touch) ---
    const touchRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchRef.current = { sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y };
    };
    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        if (!touchRef.current) return;
        const t = e.touches[0];
        const newOff = {
            x: touchRef.current.ox + (t.clientX - touchRef.current.sx),
            y: touchRef.current.oy + (t.clientY - touchRef.current.sy),
        };
        setOffset(newOff);
        draw(undefined, undefined, undefined, newOff);
    };
    const onTouchEnd = () => { touchRef.current = null; };

    // --- Zoom (wheel) ---
    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newScale = Math.min(400, Math.max(20, scale - e.deltaY / 8));
        setScale(Math.round(newScale));
        draw(undefined, Math.round(newScale));
    };

    // --- Rotate buttons ---
    const rotateCW  = () => { const v = rotate + 90; setRotate(v); draw(undefined, undefined, v); };
    const rotateCCW = () => { const v = rotate - 90; setRotate(v); draw(undefined, undefined, v); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-(--card) border border-(--brd) rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-(--brd)">
                    <p className="text-sm font-black uppercase tracking-widest text-(--t1)">Редактор банера</p>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full border border-(--brd) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-500/40 transition-all"
                    >
                        <X size={13} />
                    </button>
                </div>

                {!img ? (
                    /* Upload prompt */
                    <label className="flex flex-col items-center justify-center gap-3 m-5 p-10 border-2 border-dashed border-(--brd) rounded-2xl cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/5 transition-all">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-3xl">🖼️</div>
                        <div className="text-center">
                            <p className="text-sm font-black text-(--t1)">Виберіть банер</p>
                            <p className="text-[11px] text-(--t2) mt-1 font-medium">PNG, JPG, WEBP — рекомендований розмір 1200×400</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={loadImage} />
                    </label>
                ) : (
                    <>
                        {/* Canvas — прямокутний кропер */}
                        <div className="flex flex-col items-center pt-5 pb-2 gap-2 px-5">
                            <div
                                className="rounded-xl overflow-hidden border-2 border-purple-500 cursor-grab active:cursor-grabbing select-none w-full"
                                style={{ aspectRatio: `${W}/${H}` }}
                                onMouseDown={onMouseDown}
                                onMouseMove={onMouseMove}
                                onMouseUp={onMouseUp}
                                onMouseLeave={onMouseUp}
                                onWheel={onWheel}
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={W}
                                    height={H}
                                    style={{ width: "100%", height: "100%", display: "block" }}
                                />
                            </div>
                            <p className="text-[10px] text-(--t2) font-bold">Перетягни · Колесо миші = масштаб</p>
                        </div>

                        {/* Controls */}
                        <div className="px-5 space-y-3 pb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Масштаб</span>
                                <input
                                    type="range" min="20" max="400" step="1" value={scale}
                                    className="flex-1"
                                    onChange={e => { const v = +e.target.value; setScale(v); draw(undefined, v); }}
                                />
                                <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{scale}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Поворот</span>
                                <input
                                    type="range" min="-180" max="180" step="1" value={rotate}
                                    className="flex-1"
                                    onChange={e => { const v = +e.target.value; setRotate(v); draw(undefined, undefined, v); }}
                                />
                                <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{rotate}°</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 p-5 pt-3">
                            <button
                                onClick={rotateCCW}
                                className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-purple-500/40 hover:text-purple-500 transition-all active:scale-95"
                            >↺ −90°</button>
                            <button
                                onClick={rotateCW}
                                className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-purple-500/40 hover:text-purple-500 transition-all active:scale-95"
                            >↻ +90°</button>
                            <button
                                onClick={handleSave}
                                disabled={uploading}
                                className="flex-1 h-9 rounded-xl bg-purple-600 text-white text-xs font-black hover:bg-purple-700 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20"
                            >
                                {uploading ? <Loader size={13} className="animate-spin" /> : null}
                                {uploading ? "..." : "Зберегти"}
                            </button>
                        </div>

                        {/* Change image */}
                        <div className="text-center pb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-purple-500 cursor-pointer transition-colors">
                                Змінити фото
                                <input type="file" accept="image/*" className="hidden" onChange={loadImage} />
                            </label>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
