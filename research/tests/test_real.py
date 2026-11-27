import csv
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import analyze_real_data as ard  # noqa: E402
from jury_sim import assignment, model  # noqa: E402
from jury_sim.real import variance_components  # noqa: E402


def simulate(n_teams, n_jurors, k, tau, sigma=5.0, seed=0):
    rng = np.random.default_rng(seed)
    sc = model.Scenario(n_teams=n_teams, n_jurors=n_jurors, k=k, sigma_bias=tau, sigma_noise=sigma)
    d = model.draw(sc, rng)
    t, j, s = model.score(d, assignment.greedy_online(n_teams, n_jurors, k, rng))
    return t, j, s, d


def rows_from(t, j, s):
    return [{"tournament": "T1", "round": "1", "work": f"W{a}", "team": f"C{a}", "juror": f"J{b}", "score": float(c)}
            for a, b, c in zip(t, j, s)]


def test_noise_is_recovered_when_there_is_no_juror_bias():
    est = [variance_components(*simulate(30, 8, 3, 0.0, seed=s)[:3]) for s in range(40)]
    assert np.mean([c.sigma for c in est]) == pytest.approx(5.0, abs=0.4)
    assert np.mean([c.tau for c in est]) < 1.5


def test_juror_spread_is_recovered_with_many_jurors():
    est = [variance_components(*simulate(60, 20, 3, 8.0, seed=s)[:3]) for s in range(30)]
    assert np.mean([c.tau for c in est]) == pytest.approx(8.0, abs=1.5)
    assert np.mean([c.sigma for c in est]) == pytest.approx(5.0, abs=0.5)


def test_bigger_bias_gives_bigger_estimate():
    small = np.mean([variance_components(*simulate(30, 8, 3, 2.0, seed=s)[:3]).tau for s in range(30)])
    large = np.mean([variance_components(*simulate(30, 8, 3, 12.0, seed=s)[:3]).tau for s in range(30)])
    assert large > small + 4


def test_not_enough_data_returns_none():
    assert variance_components(["a", "b", "c"], ["j1", "j1", "j2"], [70, 60, 80]) is None      # по одному судді на роботу
    assert variance_components(["a", "a"], ["j1", "j1"], [70, 60]) is None                      # один суддя


def test_estimate_does_not_depend_on_labels_or_order():
    t, j, s, _ = simulate(20, 5, 3, 6.0, seed=4)
    a = variance_components(t, j, s)
    order = np.random.default_rng(1).permutation(len(s))
    b = variance_components([f"w{x}" for x in t[order]], [f"суддя{x}" for x in j[order]], s[order])
    assert a.tau == pytest.approx(b.tau, abs=1e-6) and a.sigma == pytest.approx(b.sigma, abs=1e-6)


def test_adding_a_constant_to_all_scores_changes_nothing():
    t, j, s, _ = simulate(20, 5, 3, 6.0, seed=5)
    a, b = variance_components(t, j, s), variance_components(t, j, s + 25)
    assert a.tau == pytest.approx(b.tau, abs=1e-6) and a.sigma == pytest.approx(b.sigma, abs=1e-6)


# ---------- скрипт аналізу ----------

def test_analysis_refuses_when_every_work_has_one_juror():
    rows = [{"work": f"W{i}", "team": f"C{i}", "juror": "J1", "score": 70.0 + i} for i in range(4)]
    report = ard.analyze(rows, boot=0)
    assert report["enough"] is False and "недостатньо" in ard.verdict(report)
    assert "Даних недостатньо" in ard.render(report)


def test_analysis_on_simulated_pilot_produces_a_full_report():
    t, j, s, _ = simulate(15, 5, 3, 8.0, seed=11)
    report = ard.analyze(rows_from(t, j, s), boot=40, seed=1)
    assert report["enough"] and report["n_works"] == 15 and report["n_jurors"] == 5
    assert report["k_counts"] == {3: 15} and report["juror_groups"] == 1
    assert len(report["teams"]) == 15 and 0.8 < report["spearman"] <= 1.0
    text = ard.render(report)
    for part in ("# Аналіз реальних оцінок журі", "## Висновок", "розкид суворості суддів (tau)", "## Рейтинг команд"):
        assert part in text


def test_adjusted_places_can_differ_from_mean_places():
    """Явний приклад: A оцінили лише суворі судді, B — лише м'які, але вони однакові за якістю."""
    quality = {"A": 70, "B": 70, "C": 60, "D": 80}
    bias = {"s1": -20, "s2": -20, "m1": 20, "m2": 20}
    panels = {"A": ("s1", "s2"), "B": ("m1", "m2"), "C": ("s1", "m1"), "D": ("s2", "m2")}
    rows = [{"work": f"W{t}", "team": t, "juror": j, "score": float(quality[t] + bias[j])}
            for t, js in panels.items() for j in js]
    report = ard.analyze(rows, boot=0)
    teams = {x["team"]: x for x in report["teams"]}
    assert teams["A"]["place_mean"] == 4 and teams["A"]["place_adjusted"] == 3
    assert teams["B"]["place_mean"] == 1 and teams["D"]["place_mean"] == 2


def test_places_use_competition_numbering():
    assert ard.places([90, 80, 80, 60]) == [1, 2, 2, 4]
    assert ard.places([70, 70, 70]) == [1, 1, 1]


def test_isolated_juror_groups_are_detected():
    rows = [{"work": "W1", "juror": "a"}, {"work": "W1", "juror": "b"},
            {"work": "W2", "juror": "c"}, {"work": "W2", "juror": "d"}]
    assert ard.components_of_jurors(rows) == 2
    rows.append({"work": "W3", "juror": "b"}); rows.append({"work": "W3", "juror": "c"})
    assert ard.components_of_jurors(rows) == 1


@pytest.mark.parametrize("ci,expected", [((0.2, 1.5), "невеликий"), ((3.0, 9.0), "помітно відрізняються"),
                                         ((0.5, 8.0), "широкий"), (None, "інтервал недоступний")])
def test_verdict_wording_depends_on_the_interval(ci, expected):
    comp = variance_components(*simulate(15, 5, 3, 5.0, seed=2)[:3])
    report = {"enough": True, "components": comp, "tau_ci": ci, "juror_groups": 1}
    assert expected in ard.verdict(report)


def test_read_rows_accepts_excel_csv_with_bom_and_checks_columns(tmp_path):
    good = tmp_path / "e.csv"
    good.write_text("tournament,round,work,team,juror,score\nT1,1,W1,C1,J1,80\n", encoding="utf-8-sig")
    assert ard.read_rows(str(good))[0]["score"] == 80.0
    bad = tmp_path / "b.csv"
    bad.write_text("work,juror\nW1,J1\n", encoding="utf-8")
    with pytest.raises(SystemExit):
        ard.read_rows(str(bad))


def test_sql_export_is_anonymous_and_has_the_columns_the_script_needs():
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "export_evaluations.sql")
    sql = open(path, encoding="utf-8").read().lower()
    for col in ("tournament", "round", "work", "team", "juror", "score"):
        assert f" as {col}" in sql
    select_part = sql[sql.rindex("select 't'"):]
    assert not any(w in select_part for w in ("username", "email", "full_name", "t.name", "team_name"))
