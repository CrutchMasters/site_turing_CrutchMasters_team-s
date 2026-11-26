"""Тести таблиці лідерів: усереднення оцінок журі, сума за раунди, місця."""

import asyncio

import pytest
from fastapi import HTTPException

import src.routers.leaderboard as lb

from tests.fake_supabase import FakeSupabase


DEFAULT_KEYS = ("backend_quality", "database_structure", "frontend_quality", "must_have", "no_bugs")


def full(score):
    """Повна оцінка за 5 критеріями за замовчуванням (ваги по 20 → підсумок = score)."""
    return {k: {"score": score, "comment": ""} for k in DEFAULT_KEYS}


def build(teams=("A", "B"), rounds=("r1",), subs=(), evals=(), captains=True):
    """subs: (id, team, round[, is_draft]);
    evals: (submission_id, jury_id, total_score[, criteria_scores]); без 4-го елемента оцінка повна."""
    store = {
        "tournaments": [{"id": "t1", "name": "Турнір", "status": "ongoing"}],
        "rounds": [{"id": r, "name": r, "number": i + 1, "status": "judging", "tournament_id": "t1"}
                   for i, r in enumerate(rounds)],
        "submissions": [{"id": s[0], "team_id": s[1], "round_id": s[2],
                         "status": "submitted", "is_draft": s[3] if len(s) > 3 else False} for s in subs],
        "jury_evaluations": [{"id": f"e{i}", "submission_id": e[0], "jury_id": e[1],
                              "total_score": e[2],
                              "criteria_scores": e[3] if len(e) > 3 else full(e[2])}
                             for i, e in enumerate(evals)],
        "teams": [{"id": t, "name": f"Команда {t}", "city_school_org": "Київ",
                   "captain_id": f"cap{t}" if captains else None} for t in teams],
        "account": [{"id": f"cap{t}", "username": f"user_{t}"} for t in teams],
    }
    return store


@pytest.fixture
def get(monkeypatch):
    def run(store, tournament_id="t1"):
        monkeypatch.setattr(lb, "supabase", FakeSupabase(store))
        return asyncio.run(lb.get_tournament_leaderboard(tournament_id))
    return run


def by_team(result):
    return {e["team_id"]: e for e in result["leaderboard"]}


def test_round_score_is_the_mean_of_jury_totals(get):
    res = get(build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 80), ("s1", "j2", 90), ("s1", "j3", 70)]))
    entry = by_team(res)["A"]
    assert entry["round_scores"] == {"r1": 80.0}
    assert entry["total_score"] == 80.0
    assert entry["evaluated_rounds"] == 1


def test_total_is_the_sum_of_round_means_and_places_follow_total(get):
    store = build(rounds=("r1", "r2"),
                  subs=[("a1", "A", "r1"), ("a2", "A", "r2"), ("b1", "B", "r1"), ("b2", "B", "r2")],
                  evals=[("a1", "j1", 70), ("a2", "j1", 60), ("b1", "j1", 90), ("b2", "j1", 85)])
    res = get(store)
    assert [e["team_id"] for e in res["leaderboard"]] == ["B", "A"]
    assert [e["place"] for e in res["leaderboard"]] == [1, 2]
    assert by_team(res)["B"]["total_score"] == 175.0
    assert by_team(res)["A"]["total_score"] == 130.0


def test_values_are_rounded_to_two_decimals(get):
    res = get(build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 80), ("s1", "j2", 80), ("s1", "j3", 81)]))
    assert by_team(res)["A"]["round_scores"]["r1"] == 80.33
    assert by_team(res)["A"]["total_score"] == 80.33


def test_drafts_are_ignored_and_a_team_with_only_drafts_is_absent(get):
    store = build(subs=[("s1", "A", "r1"), ("s2", "B", "r1", True)],
                  evals=[("s1", "j1", 50), ("s2", "j1", 100)])
    res = get(store)
    assert list(by_team(res)) == ["A"]


def test_unevaluated_round_is_none_and_adds_nothing(get):
    store = build(rounds=("r1", "r2"),
                  subs=[("a1", "A", "r1"), ("a2", "A", "r2")],
                  evals=[("a1", "j1", 70)])
    entry = by_team(get(store))["A"]
    assert entry["round_scores"] == {"r1": 70.0, "r2": None}
    assert entry["total_score"] == 70.0
    assert entry["evaluated_rounds"] == 1


def test_team_with_no_submission_in_a_round_gets_none_for_it(get):
    store = build(rounds=("r1", "r2"),
                  subs=[("a1", "A", "r1"), ("a2", "A", "r2"), ("b1", "B", "r1")],
                  evals=[("a1", "j1", 70), ("a2", "j1", 70), ("b1", "j1", 70)])
    assert by_team(get(store))["B"]["round_scores"] == {"r1": 70.0, "r2": None}


def test_evaluations_with_null_total_are_skipped(get):
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", None), ("s1", "j2", 60)])
    assert by_team(get(store))["A"]["round_scores"]["r1"] == 60.0
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", None)])
    assert by_team(get(store))["A"]["round_scores"]["r1"] is None


def test_zero_is_a_real_score_not_missing(get):
    entry = by_team(get(build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 0)])))["A"]
    assert entry["round_scores"]["r1"] == 0.0
    assert entry["evaluated_rounds"] == 1


def test_last_submission_in_the_list_is_the_one_that_counts(get):
    store = build(subs=[("old", "A", "r1"), ("new", "A", "r1")],
                  evals=[("old", "j1", 90), ("new", "j1", 40)])
    assert by_team(get(store))["A"]["round_scores"]["r1"] == 40.0


def test_other_teams_evaluations_do_not_leak(get):
    store = build(subs=[("a", "A", "r1"), ("b", "B", "r1")],
                  evals=[("a", "j1", 10), ("b", "j1", 99)])
    res = by_team(get(store))
    assert res["A"]["total_score"] == 10.0 and res["B"]["total_score"] == 99.0


def test_captain_and_team_details(get):
    entry = by_team(get(build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 70)])))["A"]
    assert entry["team_name"] == "Команда A"
    assert entry["city_school_org"] == "Київ"
    assert entry["captain_username"] == "user_A"
    assert get(build(subs=[("s1", "A", "r1")], captains=False))["leaderboard"][0]["captain_username"] is None


def test_rounds_are_returned_in_order(get):
    res = get(build(rounds=("r3", "r1", "r2"), subs=[("s", "A", "r1")]))
    assert [r["number"] for r in res["rounds"]] == [1, 2, 3]


# ---- рейтинг з поправкою на строгість суддів ----

def strict_vs_lenient_store():
    """Роботи A і B однакові за якістю (70), але A оцінюють лише суворі судді, B — лише м'які;
    C і D оцінені змішаними парами й пов'язують суддів між собою."""
    quality = {"A": 70, "B": 70, "C": 60, "D": 80}
    bias = {"s1": -20, "s2": -20, "m1": 20, "m2": 20}
    panels = {"A": ("s1", "s2"), "B": ("m1", "m2"), "C": ("s1", "m1"), "D": ("s2", "m2")}
    evals = [(t.lower(), j, quality[t] + bias[j]) for t, js in panels.items() for j in js]
    return build(teams=tuple(quality), subs=[(t.lower(), t, "r1") for t in quality], evals=evals)


def test_official_ranking_stays_the_plain_mean_but_adjusted_fields_are_added(get):
    res = get(strict_vs_lenient_store())
    teams = by_team(res)
    assert teams["A"]["total_score"] == 50.0 and teams["B"]["total_score"] == 90.0     # просте середнє
    assert [e["team_id"] for e in res["leaderboard"]][0] == "B"
    for e in res["leaderboard"]:
        assert {"adjusted_total_score", "adjusted_round_scores", "adjusted_place"} <= set(e)


def test_adjusted_scores_pull_equally_good_works_closer(get):
    teams = by_team(get(strict_vs_lenient_store()))
    gap_mean = teams["B"]["total_score"] - teams["A"]["total_score"]
    gap_adj = teams["B"]["adjusted_total_score"] - teams["A"]["adjusted_total_score"]
    assert gap_adj < gap_mean                       # поправка зменшує «везіння» з суддями


def test_adjusted_places_can_differ_from_official_places(get):
    """Офіційно (просте середнє): B, D, C, A. З поправкою A (оцінена лише суворими) наздоганяє C,
    а B і D зближуються. Значення λ = 1 звірені з numpy (research/jury_sim/aggregate.py::ls)."""
    res = get(strict_vs_lenient_store())
    official = {e["team_id"]: e["place"] for e in res["leaderboard"]}
    adjusted = {e["team_id"]: e["adjusted_place"] for e in res["leaderboard"]}
    assert official == {"B": 1, "D": 2, "C": 3, "A": 4}
    assert adjusted == {"B": 1, "D": 1, "A": 3, "C": 3}
    totals = {e["team_id"]: e["adjusted_total_score"] for e in res["leaderboard"]}
    assert totals == pytest.approx({"A": 60.0, "B": 80.0, "C": 60.0, "D": 80.0}, abs=1e-6)


def test_adjustment_summary_is_reported_without_juror_identities(get):
    res = get(strict_vs_lenient_store())
    assert res["adjustment"] == {"method": "ridge_least_squares", "lambda": 1.0,
                                 "evaluations": 8, "juror_groups": 1}
    assert "s1" not in str(res) and "m1" not in str(res)       # ідентифікатори суддів не виходять назовні


def test_with_one_juror_per_work_adjusted_equals_official(get):
    store = build(subs=[("a", "A", "r1"), ("b", "B", "r1")], evals=[("a", "j1", 70), ("b", "j2", 90)])
    for e in get(store)["leaderboard"]:
        assert e["adjusted_total_score"] == e["total_score"]
        assert e["adjusted_place"] == e["place"]


def test_partial_evaluations_do_not_enter_the_adjustment(get):
    partial = {"backend_quality": {"score": 5, "comment": ""}}
    store = build(subs=[("a", "A", "r1")], evals=[("a", "j1", 80), ("a", "j2", 1.0, partial)])
    assert get(store)["adjustment"]["evaluations"] == 1


def test_adjusted_round_scores_follow_round_structure(get):
    store = build(rounds=("r1", "r2"), subs=[("a1", "A", "r1"), ("a2", "A", "r2")],
                  evals=[("a1", "j1", 70)])
    entry = by_team(get(store))["A"]
    assert entry["adjusted_round_scores"] == {"r1": 70.0, "r2": None}
    assert entry["adjusted_total_score"] == 70.0


# ---- попередній / остаточний стан таблиці ----

def with_statuses(store, *statuses):
    for r, st in zip(store["rounds"], statuses):
        r["status"] = st
    return store


def test_leaderboard_is_provisional_until_every_round_is_judged(get):
    store = with_statuses(build(rounds=("r1", "r2"), subs=[("a", "A", "r1")], evals=[("a", "j1", 70)]),
                          "judged", "judging")
    res = get(store)
    assert res["is_final"] is False
    assert (res["rounds_judged"], res["rounds_total"]) == (1, 2)


def test_leaderboard_is_final_when_all_rounds_are_judged(get):
    store = with_statuses(build(rounds=("r1", "r2"), subs=[("a", "A", "r1")], evals=[("a", "j1", 70)]),
                          "judged", "judged")
    res = get(store)
    assert res["is_final"] is True
    assert (res["rounds_judged"], res["rounds_total"]) == (2, 2)


def test_progress_is_reported_even_for_empty_boards(get):
    assert get(build(rounds=()))["is_final"] is False                    # немає раундів
    store = with_statuses(build(rounds=("r1",), subs=[]), "judged")
    res = get(store)
    assert res["leaderboard"] == [] and res["is_final"] is True


# ---- порожні й помилкові випадки ----

def test_tournament_without_rounds_or_submissions_returns_empty_board(get):
    assert get(build(rounds=()))["leaderboard"] == []
    assert get(build(subs=[]))["leaderboard"] == []
    assert get(build(subs=[]))["rounds"] != []


def test_unknown_tournament_is_404(get):
    with pytest.raises(HTTPException) as exc:
        get(build(), tournament_id="nope")
    assert exc.value.status_code == 404


def test_missing_database_is_500(monkeypatch):
    monkeypatch.setattr(lb, "supabase", None)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(lb.get_tournament_leaderboard("t1"))
    assert exc.value.status_code == 500


# ---- поточна поведінка, яку варто знати (не обов'язково бажана) ----

def test_tied_teams_share_a_place_and_next_place_is_skipped(get):
    """Рівні підсумки → однакове місце за змагальною нумерацією: 1, 1, 3."""
    store = build(teams=("A", "B", "C"),
                  subs=[("a", "A", "r1"), ("b", "B", "r1"), ("c", "C", "r1")],
                  evals=[("a", "j1", 80), ("b", "j1", 80), ("c", "j1", 60)])
    places = {e["team_id"]: e["place"] for e in get(store)["leaderboard"]}
    assert places == {"A": 1, "B": 1, "C": 3}


def test_tie_in_the_middle_and_at_the_bottom(get):
    store = build(teams=("A", "B", "C", "D", "E"),
                  subs=[(t.lower(), t, "r1") for t in "ABCDE"],
                  evals=[("a", "j1", 90), ("b", "j1", 70), ("c", "j1", 70), ("d", "j1", 50), ("e", "j1", 50)])
    places = {e["team_id"]: e["place"] for e in get(store)["leaderboard"]}
    assert places == {"A": 1, "B": 2, "C": 2, "D": 4, "E": 4}


def test_all_teams_tied_are_all_first(get):
    store = build(subs=[("a", "A", "r1"), ("b", "B", "r1")], evals=[("a", "j1", 70), ("b", "j1", 70)])
    assert [e["place"] for e in get(store)["leaderboard"]] == [1, 1]


def test_order_among_tied_teams_is_stable_by_name(get):
    store = build(teams=("B", "A"), subs=[("a", "A", "r1"), ("b", "B", "r1")],
                  evals=[("a", "j1", 70), ("b", "j1", 70)])
    assert [e["team_name"] for e in get(store)["leaderboard"]] == ["Команда A", "Команда B"]


def test_totals_equal_after_rounding_to_two_decimals_tie(get):
    """80,001 і 80,004 після округлення (як у відповіді) — однакові, отже й місце спільне."""
    store = build(subs=[("a", "A", "r1"), ("b", "B", "r1")],
                  evals=[("a", "j1", 80.001), ("b", "j1", 80.004)])
    assert [e["place"] for e in get(store)["leaderboard"]] == [1, 1]


def test_places_without_ties_are_sequential(get):
    store = build(teams=("A", "B", "C"), subs=[(t.lower(), t, "r1") for t in "ABC"],
                  evals=[("a", "j1", 90), ("b", "j1", 80), ("c", "j1", 70)])
    assert [e["place"] for e in get(store)["leaderboard"]] == [1, 2, 3]


def test_known_missing_round_is_penalised_by_sum(get):
    """Підсумок — сума по раундах, тож команда з одним оціненим раундом (100)
    програє команді з двома оціненими по 60. Доки не всі раунди judged, таблиця
    позначена як попередня (is_final = False), щоб це не виглядало як остаточний результат."""
    store = build(rounds=("r1", "r2"),
                  subs=[("a1", "A", "r1"), ("a2", "A", "r2"), ("b1", "B", "r1"), ("b2", "B", "r2")],
                  evals=[("a1", "j1", 100), ("b1", "j1", 60), ("b2", "j1", 60)])
    assert [e["team_id"] for e in get(store)["leaderboard"]] == ["B", "A"]


def test_partial_evaluations_are_ignored(get):
    """Журі зберегло лише частину критеріїв (у формі це «in_progress»): така оцінка
    не знижує середнє команди й не потрапляє в таблицю."""
    partial = {**full(0), "backend_quality": {"score": 20, "comment": ""},
               "database_structure": {"score": "", "comment": ""}}
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 90), ("s1", "j2", 4.0, partial)])
    assert by_team(get(store))["A"]["round_scores"]["r1"] == 90.0


def test_legacy_evaluations_without_a_breakdown_are_still_counted(get):
    """У реальній базі є оцінки з criteria_scores = NULL (демо/імпорт): довіряємо total_score,
    інакше такий турнір показував би всім нулі."""
    store = build(subs=[("s1", "A", "r1"), ("s2", "B", "r1")],
                  evals=[("s1", "j1", 87, None), ("s2", "j1", 74, None)])
    teams = by_team(get(store))
    assert teams["A"]["total_score"] == 87.0 and teams["B"]["total_score"] == 74.0
    assert teams["A"]["place"] == 1


def test_legacy_and_regular_evaluations_can_be_mixed(get):
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 80, None), ("s1", "j2", 60)])
    assert by_team(get(store))["A"]["round_scores"]["r1"] == 70.0


def test_empty_object_is_not_legacy_it_is_an_unfinished_evaluation(get):
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 0.0, {})])
    assert by_team(get(store))["A"]["round_scores"]["r1"] is None


def test_round_with_only_partial_evaluations_counts_as_not_evaluated(get):
    partial = {"backend_quality": {"score": 50, "comment": ""}}
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 10.0, partial)])
    entry = by_team(get(store))["A"]
    assert entry["round_scores"]["r1"] is None
    assert entry["total_score"] == 0.0 and entry["evaluated_rounds"] == 0


def test_completeness_uses_the_criteria_of_the_round(get):
    """Якщо в раунду свої критерії, повнота перевіряється за ними, а не за стандартними."""
    store = build(subs=[("s1", "A", "r1")], evals=[
        ("s1", "j1", 70.0, {"idea": {"score": 80, "comment": ""}, "ux": {"score": 60, "comment": ""}}),
        ("s1", "j2", 50.0, {"idea": {"score": 100, "comment": ""}}),          # немає ux → неповна
    ])
    store["rounds"][0]["criteria"] = [{"key": "idea", "weight": 50}, {"key": "ux", "weight": 50}]
    entry = by_team(get(store))["A"]
    assert entry["round_scores"]["r1"] == 70.0


def test_round_criteria_are_not_leaked_in_the_response(get):
    store = build(subs=[("s1", "A", "r1")], evals=[("s1", "j1", 70)])
    store["rounds"][0]["criteria"] = [{"key": "a", "weight": 100}]
    assert all("criteria" not in r for r in get(store)["rounds"])


def test_known_scores_are_not_corrected_for_juror_strictness(get):
    """Простий середній (тема дослідження): та сама робота отримує різний бал залежно від
    того, наскільки суворі судді. Це й міряє research/."""
    store = build(subs=[("a", "A", "r1"), ("b", "B", "r1")],
                  evals=[("a", "strict1", 60), ("a", "strict2", 60), ("b", "lenient1", 80), ("b", "lenient2", 80)])
    res = by_team(get(store))
    assert res["B"]["total_score"] - res["A"]["total_score"] == 20.0
