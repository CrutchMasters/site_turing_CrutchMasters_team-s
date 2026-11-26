"""Серверний підрахунок підсумкової оцінки за критеріями раунду.

Раніше `total_score` рахував клієнт і сервер зберігав його як є, тож журі могло
надіслати будь-яке число незалежно від балів за критеріями. Тепер підсумок рахується
тут за `rounds.criteria` (ваги) і `criteria_scores` (бали). Формула повторює
`computeTotal` у frontend/src/app/jury/rounds/[id]/evaluate/page.tsx:

    total = Σ (бал_i × вага_i / 100), порожні бали пропускаються,
    округлення до 0,1 «половина вгору» (як Math.round у JavaScript).
"""

import math

MIN_SCORE = 0
MAX_SCORE = 100

# Як на клієнті: використовується, якщо в раунду не задано критеріїв
DEFAULT_CRITERIA_KEYS = (
    "backend_quality",
    "database_structure",
    "frontend_quality",
    "must_have",
    "no_bugs",
)


class ScoringError(ValueError):
    """Некоректні бали: невідомий критерій, число поза діапазоном тощо."""


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def resolve_criteria(round_criteria) -> list[dict]:
    """Список {key, weight} у порядку раунду; значення за замовчуванням — як на клієнті."""
    if isinstance(round_criteria, list) and round_criteria:
        default_weight = 100 // len(round_criteria)
        resolved = []
        for idx, item in enumerate(round_criteria):
            item = item if isinstance(item, dict) else {}
            key = item.get("key")
            weight = item.get("weight")
            resolved.append({
                "key": key if key is not None else f"criterion_{idx}",
                "weight": weight if _is_number(weight) else default_weight,
            })
        return resolved
    return [{"key": key, "weight": 20} for key in DEFAULT_CRITERIA_KEYS]


def is_complete(criteria_scores, round_criteria) -> bool:
    """True, якщо бали виставлено за КОЖЕН критерій раунду.

    Журі може зберегти оцінку частково (у формі це статус «in_progress»): тоді
    `total_score` — лише сума виставлених балів, і порівнювати її з повними оцінками
    некоректно. Таблиця лідерів враховує тільки повні оцінки.
    """
    if not isinstance(criteria_scores, dict):
        return False
    for criterion in resolve_criteria(round_criteria):
        entry = criteria_scores.get(criterion["key"])
        raw = entry.get("score") if isinstance(entry, dict) else None
        if not _is_number(raw) or not math.isfinite(raw):
            return False
    return True


def counts_as_final(criteria_scores, round_criteria) -> bool:
    """Чи враховувати оцінку в таблиці лідерів.

    * Є розбивка за критеріями — оцінка завершена, лише якщо бали виставлено за ВСІ критерії
      раунду (журі може зберегти оцінку частково — у формі це статус «in_progress»; тоді
      `total_score` — лише сума виставлених балів, і порівнювати її з повними некоректно).
    * `criteria_scores` порожнє (NULL) — «старий» запис без розбивки (наприклад, імпортовані
      чи демо-дані): повноту перевірити неможливо, тож довіряємо `total_score`.
    """
    if criteria_scores is None:
        return True
    return is_complete(criteria_scores, round_criteria)


def compute_total(criteria_scores, round_criteria) -> float:
    """Підсумкова оцінка. Кидає ScoringError, якщо бали некоректні."""
    if not isinstance(criteria_scores, dict):
        raise ScoringError("criteria_scores має бути об'єктом {критерій: {score, comment}}")

    criteria = resolve_criteria(round_criteria)
    known = {c["key"] for c in criteria}
    for key in criteria_scores:
        if key not in known:
            raise ScoringError(f"Невідомий критерій: «{key}»")

    total = 0.0
    for criterion in criteria:                      # порядок критеріїв, як у клієнта
        entry = criteria_scores.get(criterion["key"])
        if entry is None:
            continue
        if not isinstance(entry, dict):
            raise ScoringError(f"Некоректний запис для критерію «{criterion['key']}»")
        raw = entry.get("score")
        if raw is None or raw == "":
            continue                                 # бал ще не виставлено
        if not _is_number(raw) or not math.isfinite(raw) or not MIN_SCORE <= raw <= MAX_SCORE:
            raise ScoringError(
                f"Бал за критерієм «{criterion['key']}» має бути числом від {MIN_SCORE} до {MAX_SCORE}")
        total += raw * criterion["weight"] / 100

    return math.floor(total * 10 + 0.5) / 10
