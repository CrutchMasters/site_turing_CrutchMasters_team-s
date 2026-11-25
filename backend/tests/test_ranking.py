"""Тести оцінки якості робіт із поправкою на строгість суддів (services/ranking.py)."""

import random

import pytest

from src.services.ranking import adjusted_quality, juror_groups

# 4 роботи, 4 судді: судді 0 і 1 суворі (−20), судді 2 і 3 м'які (+20).
# Справжня якість: 70, 70, 60, 80. Роботу 0 оцінюють лише суворі, роботу 1 — лише м'які.
QUALITY = [70, 70, 60, 80]
BIAS = [-20, -20, 20, 20]
PAIRS = {0: (0, 1), 1: (2, 3), 2: (0, 2), 3: (1, 3)}
OBS = [(i, j, QUALITY[i] + BIAS[j]) for i, js in PAIRS.items() for j in js]


def simple_mean(obs):
    sums: dict = {}
    for item, _, score in obs:
        sums.setdefault(item, []).append(score)
    return {i: sum(v) / len(v) for i, v in sums.items()}


def test_simple_mean_is_fooled_by_strict_and_lenient_jurors():
    mean = simple_mean(OBS)
    assert mean[0] == 50 and mean[1] == 90          # хоча якість обох — 70


def test_adjustment_recovers_equal_quality_with_small_regularisation():
    quality, bias = adjusted_quality(OBS, lam=0.01)
    assert abs(quality[0] - quality[1]) < 2
    assert bias[0] < -15 and bias[2] > 15           # суворість і м'якість визначено правильно


def test_values_match_numpy_reference_for_default_lambda():
    """Еталон: research/jury_sim/aggregate.py::ls (numpy lstsq), λ = 1."""
    quality, _ = adjusted_quality(OBS, lam=1.0)
    assert [round(quality[i], 6) for i in range(4)] == pytest.approx([60.0, 80.0, 60.0, 80.0], abs=1e-6)


def test_without_bias_quality_equals_the_plain_mean():
    rnd = random.Random(1)
    truth = {i: rnd.uniform(40, 90) for i in range(8)}
    obs = [(i, j, truth[i]) for i in truth for j in rnd.sample(range(5), 3)]
    quality, bias = adjusted_quality(obs)
    assert all(abs(b) < 1e-9 for b in bias.values())
    for item, value in simple_mean(obs).items():
        assert quality[item] == pytest.approx(value)


def test_single_juror_per_work_changes_nothing():
    """K = 1: зсув судді не відокремити від якості, тож результат = звичайні оцінки."""
    obs = [(0, "a", 80), (1, "b", 60), (2, "a", 50)]
    quality, bias = adjusted_quality(obs)
    assert quality == pytest.approx({0: 80, 1: 60, 2: 50})
    assert all(abs(b) < 1e-9 for b in bias.values())


def test_adding_a_constant_to_every_score_shifts_quality_by_that_constant():
    q1, _ = adjusted_quality(OBS)
    q2, _ = adjusted_quality([(i, j, s + 10) for i, j, s in OBS])
    for item in q1:
        assert q2[item] - q1[item] == pytest.approx(10, abs=1e-9)


def test_order_of_observations_and_juror_labels_do_not_matter():
    shuffled = OBS[:]
    random.Random(3).shuffle(shuffled)
    renamed = [(i, f"суддя-{j}", s) for i, j, s in shuffled]
    q1, _ = adjusted_quality(OBS)
    q2, _ = adjusted_quality(renamed)
    for item in q1:
        assert q1[item] == pytest.approx(q2[item])


def test_duplicate_juror_scores_use_the_last_one():
    with_duplicate = adjusted_quality(OBS + [(0, 0, 999)])[0]
    replaced = adjusted_quality([(i, j, 999 if (i, j) == (0, 0) else sc) for i, j, sc in OBS])[0]
    for item in replaced:
        assert with_duplicate[item] == pytest.approx(replaced[item])


def test_empty_input():
    assert adjusted_quality([]) == ({}, {})


def test_a_lone_work_with_one_rating():
    quality, bias = adjusted_quality([("w", "j", 77)])
    assert quality == {"w": 77.0} and bias == {"j": 0.0}


def test_larger_random_problem_is_solved_and_biases_are_centred_on_truth():
    rnd = random.Random(7)
    n_items, n_jurors = 60, 12
    truth = [rnd.gauss(70, 10) for _ in range(n_items)]
    bias_true = [rnd.gauss(0, 8) for _ in range(n_jurors)]
    obs = [(i, j, truth[i] + bias_true[j] + rnd.gauss(0, 2))
           for i in range(n_items) for j in rnd.sample(range(n_jurors), 3)]
    quality, bias = adjusted_quality(obs)
    err_adj = sum(abs(quality[i] - truth[i]) for i in range(n_items)) / n_items
    mean = simple_mean(obs)
    err_mean = sum(abs(mean[i] - truth[i]) for i in range(n_items)) / n_items
    assert err_adj < err_mean                       # поправка наближає оцінки до істини


def test_juror_groups_counts_isolated_panels():
    isolated = [("w1", "a", 1), ("w1", "b", 1), ("w2", "c", 1), ("w2", "d", 1)]
    assert juror_groups(isolated) == 2
    connected = isolated + [("w3", "b", 1), ("w3", "c", 1)]
    assert juror_groups(connected) == 1
    assert juror_groups([]) == 0
    assert juror_groups([("w", "a", 1)]) == 1
