"""Тести автоматичних статусів турнірів і раундів та валідації таймлайну.

Час у тестах заморожується (див. `at`), тож перевіряються й точні межі:
рівно в момент start_at, end_at, judging_deadline тощо.
"""

from datetime import datetime, timedelta, timezone

import pytest

import src.services.scheduler as scheduler
import src.services.statuses as statuses
from src.services.statuses import (recalc_round_status, recalc_tournament_status,
                                   validate_tournament_timeline)

from tests.fake_supabase import FakeSupabase

BASE = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


def day(n: float) -> str:
    """ISO-рядок для «BASE + n днів»."""
    return (BASE + timedelta(days=n)).isoformat()


@pytest.fixture
def at(monkeypatch):
    """at(n) — «зараз» стає BASE + n днів (для statuses.py і scheduler.py)."""
    class Frozen(datetime):
        _now = BASE

        @classmethod
        def now(cls, tz=None):
            return cls._now if tz is None else cls._now.astimezone(tz)

    monkeypatch.setattr(statuses, "datetime", Frozen)
    monkeypatch.setattr(scheduler, "datetime", Frozen)

    def set_now(n: float):
        Frozen._now = BASE + timedelta(days=n)
    return set_now


def use_store(monkeypatch, store):
    fake = FakeSupabase(store)
    monkeypatch.setattr(statuses, "supabase", fake)
    monkeypatch.setattr(scheduler, "supabase", fake)
    return store


def tournament(**kw):
    row = {"id": "t1", "status": "upcoming", "name": "Турнір",
           "registration_from": None, "registration_to": None, "start_at": None, "end_at": None}
    row.update(kw)
    return row


def round_(**kw):
    row = {"id": "r1", "status": "pending", "start_at": None, "end_at": None, "judging_deadline": None}
    row.update(kw)
    return row


def writes(store):
    return store.get("__writes__", [])


# ======================= recalc_tournament_status =======================

WINDOWS = dict(registration_from=day(1), registration_to=day(3), start_at=day(5), end_at=day(8))


@pytest.mark.parametrize("now,expected", [
    (0, "upcoming"),        # до реєстрації
    (1, "registration"),    # рівно registration_from
    (2, "registration"),
    (3, "upcoming"),        # рівно registration_to: реєстрація закрита
    (4, "upcoming"),
    (5, "ongoing"),         # рівно start_at
    (7, "ongoing"),
    (8, "finished"),        # рівно end_at
    (9, "finished"),
])
def test_tournament_status_follows_the_clock(monkeypatch, at, now, expected):
    store = use_store(monkeypatch, {"tournaments": [tournament(**WINDOWS)]})
    at(now)
    assert recalc_tournament_status("t1") == expected
    assert store["tournaments"][0]["status"] == expected


def test_tournament_end_wins_over_everything_else(monkeypatch, at):
    store = use_store(monkeypatch, {"tournaments": [tournament(
        registration_from=day(1), registration_to=day(9), start_at=day(2), end_at=day(3))]})
    at(4)
    assert recalc_tournament_status("t1") == "finished"


def test_tournament_with_start_in_the_past_is_ongoing_even_if_registration_is_open(monkeypatch, at):
    use_store(monkeypatch, {"tournaments": [tournament(
        registration_from=day(1), registration_to=day(9), start_at=day(2))]})
    at(4)
    assert recalc_tournament_status("t1") == "ongoing"


def test_tournament_without_dates_is_upcoming(monkeypatch, at):
    use_store(monkeypatch, {"tournaments": [tournament(status="ongoing")]})
    at(4)
    assert recalc_tournament_status("t1") == "upcoming"


def test_tournament_with_registration_but_no_end_of_registration(monkeypatch, at):
    use_store(monkeypatch, {"tournaments": [tournament(registration_from=day(1), start_at=day(6))]})
    at(4)
    assert recalc_tournament_status("t1") == "registration"


def test_cancelled_tournament_is_never_touched(monkeypatch, at):
    store = use_store(monkeypatch, {"tournaments": [tournament(status="cancelled", **WINDOWS)]})
    for now in (0, 2, 6, 9):
        at(now)
        assert recalc_tournament_status("t1") == "cancelled"
    assert writes(store) == []


def test_unchanged_status_causes_no_database_write(monkeypatch, at):
    store = use_store(monkeypatch, {"tournaments": [tournament(status="registration", **WINDOWS)]})
    at(2)
    assert recalc_tournament_status("t1") == "registration"
    assert writes(store) == []


def test_changed_status_is_written_exactly_once(monkeypatch, at):
    store = use_store(monkeypatch, {"tournaments": [tournament(status="upcoming", **WINDOWS)]})
    at(6)
    recalc_tournament_status("t1")
    assert writes(store) == [("tournaments", {"status": "ongoing"}, 1)]


def test_admin_moving_end_date_forward_reopens_a_finished_tournament(monkeypatch, at):
    """Статус «finished» не остаточний: після зміни дат турнір знову стає ongoing."""
    use_store(monkeypatch, {"tournaments": [tournament(status="finished", **{**WINDOWS, "end_at": day(20)})]})
    at(9)
    assert recalc_tournament_status("t1") == "ongoing"


def test_tournament_unknown_id_or_no_database_or_error_returns_none(monkeypatch, at):
    use_store(monkeypatch, {"tournaments": []})
    assert recalc_tournament_status("missing") is None
    monkeypatch.setattr(statuses, "supabase", None)
    assert recalc_tournament_status("t1") is None
    use_store(monkeypatch, {"tournaments": [tournament(start_at="not-a-date")]})
    assert recalc_tournament_status("t1") is None        # помилка розбору дати не валить сервер


# ========================== recalc_round_status ==========================

ROUND_DATES = dict(start_at=day(1), end_at=day(3), judging_deadline=day(5))


def test_round_lifecycle_over_time(monkeypatch, at):
    """pending → active → judging → judged, і judged уже не змінюється."""
    store = use_store(monkeypatch, {"rounds": [round_(**ROUND_DATES)]})
    seen = []
    for now in (0, 1, 2, 3, 4, 5, 6, 30):
        at(now)
        seen.append(recalc_round_status("r1"))
    assert seen == ["pending", "active", "active", "judging", "judging", "judged", "judged", "judged"]


def test_round_boundaries_are_inclusive_at_the_start_of_the_next_phase(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(**ROUND_DATES)]})
    at(1)
    assert recalc_round_status("r1") == "active"          # рівно start_at
    at(3)
    assert recalc_round_status("r1") == "judging"         # рівно end_at
    at(5)
    assert recalc_round_status("r1") == "judged"          # рівно judging_deadline


def test_judged_round_is_final_whatever_the_dates_say(monkeypatch, at):
    store = use_store(monkeypatch, {"rounds": [round_(status="judged", **ROUND_DATES)]})
    at(0)
    assert recalc_round_status("r1") == "judged"
    assert writes(store) == []


def test_manual_judging_is_kept_until_the_deadline(monkeypatch, at):
    """Адмін відкрив оцінювання вручну: до дедлайну статус judging не чіпають,
    навіть якщо за датами раунд ще не почався."""
    store = use_store(monkeypatch, {"rounds": [round_(status="judging", **ROUND_DATES)]})
    at(0)
    assert recalc_round_status("r1") == "judging"
    assert writes(store) == []


def test_judging_without_deadline_never_closes_by_itself(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(status="judging", start_at=day(1), end_at=day(3))]})
    at(400)
    assert recalc_round_status("r1") == "judging"


def test_reopening_after_the_deadline_is_reverted_by_the_clock(monkeypatch, at):
    """Поведінка, про яку варто знати: judged → judging вручну після дедлайну
    повертається в judged при найближчому перерахунку (кожні 15 с у планувальнику)."""
    use_store(monkeypatch, {"rounds": [round_(status="judging", **ROUND_DATES)]})
    at(10)                                   # дедлайн оцінювання вже минув
    assert recalc_round_status("r1") == "judged"


def test_active_round_goes_back_to_pending_if_start_moves_into_the_future(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(status="active", start_at=day(7), end_at=day(9))]})
    at(2)
    assert recalc_round_status("r1") == "pending"


def test_round_without_dates_or_with_missing_status_is_pending(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(status=None)]})
    at(3)
    assert recalc_round_status("r1") == "pending"


def test_round_with_start_only_becomes_active_and_stays_active(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(start_at=day(1))]})
    at(2)
    assert recalc_round_status("r1") == "active"
    at(300)
    assert recalc_round_status("r1") == "active"


def test_round_with_end_only_stays_pending_until_end_then_judging(monkeypatch, at):
    use_store(monkeypatch, {"rounds": [round_(end_at=day(3))]})
    at(2)
    assert recalc_round_status("r1") == "pending"
    at(3)
    assert recalc_round_status("r1") == "judging"


def test_round_unknown_id_no_database_and_bad_date(monkeypatch, at):
    use_store(monkeypatch, {"rounds": []})
    assert recalc_round_status("missing") is None
    monkeypatch.setattr(statuses, "supabase", None)
    assert recalc_round_status("r1") is None
    use_store(monkeypatch, {"rounds": [round_(start_at="garbage")]})
    assert recalc_round_status("r1") is None


# ===== планувальник і recalc_* повинні давати однаковий результат =====
# update_round_statuses / update_tournament_statuses у scheduler.py дублюють логіку
# recalc_* копіюванням; ці тести ловлять розбіжність, якщо одну з копій змінять окремо.

ROUND_VARIANTS = [
    dict(start_at=day(1), end_at=day(3), judging_deadline=day(5)),
    dict(start_at=day(1), end_at=day(3)),
    dict(start_at=day(1)),
    dict(end_at=day(3)),
    dict(),
]


@pytest.mark.parametrize("variant", ROUND_VARIANTS)
@pytest.mark.parametrize("status", [None, "pending", "active", "judging", "judged"])
def test_scheduler_and_recalc_agree_for_rounds(monkeypatch, at, variant, status):
    for now in (0, 1, 2, 3, 4, 5, 6, 40):
        at(now)
        a = use_store(monkeypatch, {"rounds": [round_(status=status, **variant)]})
        recalc_round_status("r1")
        b = use_store(monkeypatch, {"rounds": [round_(status=status, **variant)]})
        scheduler.update_round_statuses()
        got_recalc = a["rounds"][0]["status"] or "pending"
        got_sched = b["rounds"][0]["status"] or "pending"
        assert got_recalc == got_sched, f"now=day {now}"


TOURNAMENT_VARIANTS = [
    WINDOWS,
    dict(start_at=day(5), end_at=day(8)),
    dict(registration_from=day(1), registration_to=day(3), end_at=day(8)),
    dict(registration_from=day(1), start_at=day(5), end_at=day(8)),
    dict(end_at=day(8)),
]


@pytest.mark.parametrize("variant", TOURNAMENT_VARIANTS)
@pytest.mark.parametrize("status", ["upcoming", "registration", "ongoing", "finished", "cancelled"])
def test_scheduler_and_recalc_agree_for_tournaments_with_end_date(monkeypatch, at, variant, status):
    monkeypatch.setattr(scheduler, "_notify_tournament_start", lambda *a, **k: None)
    for now in range(0, 11):
        at(now)
        a = use_store(monkeypatch, {"tournaments": [tournament(status=status, **variant)], "rounds": []})
        recalc_tournament_status("t1")
        b = use_store(monkeypatch, {"tournaments": [tournament(status=status, **variant)], "rounds": []})
        scheduler.update_tournament_statuses()
        assert a["tournaments"][0]["status"] == b["tournaments"][0]["status"], f"now=day {now}"


def test_known_divergence_scheduler_finishes_open_ended_tournament_when_all_rounds_judged(monkeypatch, at):
    """Задокументована різниця: лише планувальник завершує «ongoing»-турнір без end_at,
    коли всі раунди judged. recalc_tournament_status цього не знає і лишає ongoing."""
    monkeypatch.setattr(scheduler, "_notify_tournament_start", lambda *a, **k: None)
    rounds = [{"id": "r1", "tournament_id": "t1", "status": "judged"},
              {"id": "r2", "tournament_id": "t1", "status": "judged"}]
    at(6)
    a = use_store(monkeypatch, {"tournaments": [tournament(status="ongoing", start_at=day(5))], "rounds": rounds})
    recalc_tournament_status("t1")
    b = use_store(monkeypatch, {"tournaments": [tournament(status="ongoing", start_at=day(5))], "rounds": rounds})
    scheduler.update_tournament_statuses()
    assert a["tournaments"][0]["status"] == "ongoing"
    assert b["tournaments"][0]["status"] == "finished"


def test_scheduler_notifies_only_when_tournament_becomes_ongoing(monkeypatch, at):
    calls = []
    monkeypatch.setattr(scheduler, "_notify_tournament_start", lambda tid, name: calls.append((tid, name)))
    use_store(monkeypatch, {"tournaments": [tournament(status="registration", **WINDOWS)], "rounds": []})
    at(2)
    scheduler.update_tournament_statuses()
    assert calls == []                                  # ще реєстрація
    at(6)
    scheduler.update_tournament_statuses()
    assert calls == [("t1", "Турнір")]                  # перехід у ongoing
    scheduler.update_tournament_statuses()
    assert calls == [("t1", "Турнір")]                  # повторно не сповіщає


# ===================== validate_tournament_timeline =====================

def check(reg_from=None, reg_to=None, start=None, end=None, rounds=None):
    return validate_tournament_timeline(reg_from, reg_to, start, end, rounds)


def rnd(n, start, end, deadline=None):
    r = {"number": n, "start_at": day(start), "end_at": day(end)}
    if deadline is not None:
        r["judging_deadline"] = day(deadline)
    return r


def test_valid_timeline_returns_none():
    assert check(day(0), day(2), day(3), day(20), [rnd(1, 3, 6, 8), rnd(2, 8, 12, 14), rnd(3, 14, 18, 20)]) is None


def test_everything_optional():
    assert check() is None
    assert check(start=day(1)) is None
    assert check(reg_from=day(1), reg_to=day(2)) is None


def test_registration_must_start_before_tournament():
    assert "раніше за старт" in check(reg_from=day(5), start=day(5))
    assert "раніше за старт" in check(reg_from=day(6), start=day(5))


def test_registration_must_end_no_later_than_start():
    assert "не пізніше старту" in check(reg_to=day(6), start=day(5))
    assert check(reg_to=day(5), start=day(5)) is None          # рівність дозволена


def test_registration_start_before_end_and_tournament_start_before_end():
    assert "Початок реєстрації" in check(reg_from=day(3), reg_to=day(3))
    assert "Початок турніру" in check(start=day(5), end=day(5))
    assert "Початок турніру" in check(start=day(6), end=day(5))


def test_round_start_must_precede_its_deadline():
    assert "Раунд 1: початок повинен бути раніше" in check(start=day(0), end=day(20), rounds=[rnd(1, 5, 5)])


def test_round_must_not_start_before_tournament_or_end_after_it():
    assert "не може бути раніше за старт" in check(start=day(5), end=day(20), rounds=[rnd(1, 4, 8)])
    assert "виходити за межі турніру" in check(start=day(0), end=day(10), rounds=[rnd(1, 2, 11)])
    assert check(start=day(0), end=day(10), rounds=[rnd(1, 0, 10)]) is None     # межі включно


def test_judging_deadline_must_be_after_submission_deadline_and_inside_tournament():
    assert "пізніше за дедлайн здачі" in check(start=day(0), end=day(20), rounds=[rnd(1, 1, 5, 5)])
    assert "пізніше за дедлайн здачі" in check(start=day(0), end=day(20), rounds=[rnd(1, 1, 5, 4)])
    assert "за межі турніру" in check(start=day(0), end=day(10), rounds=[rnd(1, 1, 5, 11)])


def test_rounds_must_not_overlap_by_submission_deadline():
    msg = check(start=day(0), end=day(30), rounds=[rnd(1, 1, 6), rnd(2, 5, 9)])
    assert "Раунд 2 починається до завершення раунду 1" in msg and "дедлайн здачі" in msg


def test_rounds_must_not_overlap_by_judging_deadline():
    msg = check(start=day(0), end=day(30), rounds=[rnd(1, 1, 4, 8), rnd(2, 6, 9)])
    assert "Раунд 2 починається до завершення раунду 1" in msg and "дедлайн оцінювання" in msg


def test_next_round_may_start_exactly_when_previous_ends():
    assert check(start=day(0), end=day(30), rounds=[rnd(1, 1, 4, 8), rnd(2, 8, 12)]) is None


def test_rounds_are_sorted_by_number_before_checking():
    assert check(start=day(0), end=day(30), rounds=[rnd(2, 8, 12), rnd(1, 1, 4, 8)]) is None
    assert "Раунд 2 починається до завершення раунду 1" in check(
        start=day(0), end=day(30), rounds=[rnd(2, 5, 9), rnd(1, 1, 6)])


def test_rounds_without_dates_are_ignored():
    rounds = [{"number": 1}, {"number": 2, "start_at": day(3)}, rnd(3, 1, 4)]
    assert check(start=day(0), end=day(30), rounds=rounds) is None


def test_naive_and_aware_datetimes_and_z_suffix_are_handled():
    """Python ≥ 3.11 розуміє суфікс Z (його ставить JS toISOString())."""
    assert check(start="2026-06-01T10:00:00", end="2026-06-02T10:00:00+00:00") is None
    assert "Початок турніру" in check(start="2026-06-02T10:00:00Z", end="2026-06-01T10:00:00Z")


def test_unparseable_dates_are_silently_ignored():
    """Поточна поведінка: некоректний рядок дати трактується як «немає дати»,
    а не як помилка валідації."""
    assert check(reg_from="garbage", start=day(1), end="also garbage") is None
