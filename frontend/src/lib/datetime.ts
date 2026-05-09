/**
 * datetime.ts — утиліти для роботи з датами і часовими поясами.
 *
 * Стратегія:
 *  - У БД зберігаємо завжди UTC (ISO 8601, нульовий пояс).
 *  - У picker показуємо LOCAL час користувача.
 *  - На сторінках відображаємо LOCAL час із явним зазначенням часового поясу,
 *    щоб користувач бачив саме свій час.
 */

// ─── Для пікера (date + time string ↔ ISO UTC) ────────────────────────────────

/**
 * Перетворює ISO UTC рядок у локальну дату "YYYY-MM-DD" для DatePicker.
 * Використовує локальний час браузера, а НЕ UTC — щоб пікер показував правильний день.
 */
export function isoToLocalDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Перетворює ISO UTC рядок у локальний час "HH:mm" для TimePicker.
 */
export function isoToLocalTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/**
 * Збирає дату "YYYY-MM-DD" + час "HH:mm" (локальні) → ISO UTC рядок для БД.
 * new Date("YYYY-MM-DDTHH:mm:ss") парсить як LOCAL, .toISOString() повертає UTC.
 */
export function localToIso(date: string, time: string): string | null {
  if (!date) return null;
  const localStr = `${date}T${time || "00:00"}:00`;
  return new Date(localStr).toISOString();
}

// ─── Для відображення ─────────────────────────────────────────────────────────

/**
 * Форматує ISO UTC рядок у локальну дату + час з позначкою часового поясу.
 * Автоматично адаптується під браузерний TZ.
 */
export function fmtDateTime(
  iso?: string,
  locale: string = "uk-UA"
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Форматує ISO UTC рядок у локальну дату (без часу).
 */
export function fmtDate(
  iso?: string,
  locale: string = "uk-UA"
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Форматує ISO UTC рядок у відносний час або повну дату (для нотифікацій тощо).
 */
export function fmtRelativeOrDate(iso?: string, locale: string = "uk-UA"): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "щойно";
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
