"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { X, Loader } from "lucide-react";

interface TableConfig {
    table: string;
    idColumn: string;
}

interface Props {
    userId: string;
    onSave: (url: string) => void;
    onClose: () => void;
    supabase: any;
    // Какую таблицу обновлять: по умолчанию "account" / "id"
    // Для команд передавай: tableConfig={{ table: "teams", idColumn: "id" }}
    tableConfig?: TableConfig;
}

export default function AvatarEditorModal({ userId, onSave, onClose, supabase, tableConfig }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(100);
    const [rotate, setRotate] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [uploading, setUploading] = useState(false);
    const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

    // Резолвим таблицу и колонку — берём из пропса или дефолт "account"/"id"
    const dbTable   = tableConfig?.table    ?? "account";
    const dbIdCol   = tableConfig?.idColumn ?? "id";

    const SIZE = 260;

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
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.translate(SIZE / 2 + o.x, SIZE / 2 + o.y);
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
                const fitScale = Math.min(100, (SIZE / Math.max(image.width, image.height)) * 100);
                setImg(image);
                setScale(Math.round(fitScale));
                setRotate(0);
                setOffset({ x: 0, y: 0 });
                draw(image, Math.round(fitScale), 0, { x: 0, y: 0 });
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
            const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), "image/webp", 0.85));
            const timestamp = Date.now();
            const path = `${userId}/avatar_${timestamp}.webp`;

            // 1. Загружаем новый файл в bucket
            const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, blob, { contentType: "image/webp" });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
            const finalUrl = `${urlData.publicUrl}?v=${timestamp}`;

            // 2. Получаем старый avatar_url из нужной таблицы (account ИЛИ teams)
            //    .maybeSingle() — не падает с 406 если строки нет
            const { data: existingRow } = await supabase
            .from(dbTable)
            .select("avatar_url")
            .eq(dbIdCol, userId)
            .maybeSingle();

            // 3. Обновляем avatar_url в нужной таблице
            const { error: updateError } = await supabase
            .from(dbTable)
            .update({ avatar_url: finalUrl })
            .eq(dbIdCol, userId);

            if (updateError) throw updateError;

            // 4. Удаляем старый файл из storage если был
            if (existingRow?.avatar_url) {
                try {
                    const url = new URL(existingRow.avatar_url);
                    const pathParts = url.pathname.split("/object/public/avatars/");
                    if (pathParts[1]) {
                        const oldPath = pathParts[1].split("?")[0];
                        await supabase.storage.from("avatars").remove([oldPath]);
                    }
                } catch { /* игнорируем ошибку удаления старого файла */ }
            }

            onSave(finalUrl);
            onClose();
        } catch (err: any) {
            console.error("Avatar upload error:", err);
            alert(err?.message ?? "Помилка завантаження аватара");
        } finally {
            setUploading(false);
        }
    };

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

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newScale = Math.min(300, Math.max(20, scale - e.deltaY / 8));
        setScale(Math.round(newScale));
        draw(undefined, Math.round(newScale));
    };

    const rotateCW  = () => { const v = rotate + 90; setRotate(v); draw(undefined, undefined, v); };
    const rotateCCW = () => { const v = rotate - 90; setRotate(v); draw(undefined, undefined, v); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-(--card) border border-(--brd) rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--brd)">
        <p className="text-sm font-black uppercase tracking-widest text-(--t1)">Редактор аватара</p>
        <button onClick={onClose}
        className="w-7 h-7 rounded-full border border-(--brd) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-500/40 transition-all">
        <X size={13} />
        </button>
        </div>

        {!img ? (
            <label className="flex flex-col items-center justify-center gap-3 m-5 p-10 border-2 border-dashed border-(--brd) rounded-2xl cursor-pointer hover:border-blue-600/40 hover:bg-blue-600/5 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-3xl">🖼️</div>
            <div className="text-center">
            <p className="text-sm font-black text-(--t1)">Виберіть фото</p>
            <p className="text-[11px] text-(--t2) mt-1 font-medium">PNG, JPG, WEBP — до 5MB</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={loadImage} />
            </label>
        ) : (
            <>
            <div className="flex flex-col items-center pt-5 pb-2 gap-2">
            <div
            className="rounded-full overflow-hidden border-2 border-blue-600 cursor-grab active:cursor-grabbing select-none"
            style={{ width: SIZE, height: SIZE }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, display: "block" }} />
            </div>
            <p className="text-[10px] text-(--t2) font-bold">Перетягни · Колесо миші = масштаб</p>
            </div>

            <div className="px-5 space-y-3 pb-2">
            <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Масштаб</span>
            <input type="range" min="20" max="300" step="1" value={scale} className="flex-1"
            onChange={e => { const v = +e.target.value; setScale(v); draw(undefined, v); }} />
            <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{scale}%</span>
            </div>
            <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Поворот</span>
            <input type="range" min="-180" max="180" step="1" value={rotate} className="flex-1"
            onChange={e => { const v = +e.target.value; setRotate(v); draw(undefined, undefined, v); }} />
            <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{rotate}°</span>
            </div>
            </div>

            <div className="flex gap-2 p-5 pt-3">
            <button onClick={rotateCCW} className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95">↺ −90°</button>
            <button onClick={rotateCW} className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95">↻ +90°</button>
            <button onClick={handleSave} disabled={uploading}
            className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20">
            {uploading ? <Loader size={13} className="animate-spin" /> : null}
            {uploading ? "..." : "Зберегти"}
            </button>
            </div>

            <div className="text-center pb-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 cursor-pointer transition-colors">
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
