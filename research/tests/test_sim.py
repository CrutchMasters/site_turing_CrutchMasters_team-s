import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from jury_sim import aggregate, assignment, experiment, metrics, model  # noqa: E402

CASES = [(10, 5, 1), (10, 5, 2), (30, 10, 3), (7, 4, 4), (20, 6, 2)]


@pytest.mark.parametrize("method", list(assignment.METHODS))
@pytest.mark.parametrize("n_teams,n_jurors,k", CASES)
def test_assignment_gives_k_distinct_jurors_to_every_team(method, n_teams, n_jurors, k):
    a = assignment.METHODS[method](n_teams, n_jurors, k, np.random.default_rng(1))
    assert a.shape == (n_teams, k)
    assert a.min() >= 0 and a.max() < n_jurors
    for row in a:
        assert len(set(row.tolist())) == k


@pytest.mark.parametrize("method", ["greedy_batch", "greedy_online", "balanced_pairs"])
@pytest.mark.parametrize("n_teams,n_jurors,k", CASES)
def test_load_balanced_methods_keep_spread_at_most_one(method, n_teams, n_jurors, k):
    for seed in range(20):
        a = assignment.METHODS[method](n_teams, n_jurors, k, np.random.default_rng(seed))
        assert metrics.load_spread(a, n_jurors) <= 1


def test_random_k_is_not_load_balanced_in_general():
    spreads = [metrics.load_spread(assignment.random_k(30, 10, 2, np.random.default_rng(s)), 10)
               for s in range(30)]
    assert max(spreads) > 1


@pytest.mark.parametrize("agg", list(aggregate.METHODS))
def test_all_aggregations_rank_perfectly_without_bias_and_noise(agg):
    sc = model.Scenario(n_teams=12, n_jurors=5, k=3, sigma_bias=0.0, sigma_noise=0.0)
    rng = np.random.default_rng(3)
    d = model.draw(sc, rng)
    a = assignment.greedy_batch(sc.n_teams, sc.n_jurors, sc.k, rng)
    teams, jurors, scores = model.score(d, a)
    est = aggregate.METHODS[agg](teams, jurors, scores, sc.n_teams, sc.n_jurors)
    assert metrics.spearman(d.quality, est) > 0.999


def test_mean_is_fooled_by_a_strict_juror_but_ls_is_not():
    """Команда 0 і 1 однакової якості, але команду 0 оцінюють лише суворі судді."""
    # 4 команди, 4 судді; судді 0,1 суворі (-20), судді 2,3 м'які (+20)
    quality = np.array([70.0, 70.0, 60.0, 80.0])
    bias = np.array([-20.0, -20.0, 20.0, 20.0])
    pairs = {0: (0, 1), 1: (2, 3), 2: (0, 2), 3: (1, 3)}
    teams, jurors, scores = [], [], []
    for t, js in pairs.items():
        for j in js:
            teams.append(t); jurors.append(j); scores.append(quality[t] + bias[j])
    teams, jurors, scores = map(np.array, (teams, jurors, scores))
    est_mean = aggregate.mean(teams, jurors, scores, 4, 4)
    est_ls = aggregate.ls(teams, jurors, scores, 4, 4, lam=0.01)
    assert est_mean[0] < est_mean[1] - 30                  # середнє «топить» команду 0
    assert abs(est_ls[0] - est_ls[1]) < 2                  # LS бачить, що вони рівні


def test_spearman_and_kendall_basic_properties():
    x = np.arange(10, dtype=float)
    assert metrics.spearman(x, x) == pytest.approx(1.0)
    assert metrics.spearman(x, -x) == pytest.approx(-1.0)
    assert metrics.kendall(x, x) == pytest.approx(1.0)
    assert metrics.kendall(x, -x) == pytest.approx(-1.0)


def test_experiment_is_reproducible():
    sc = model.Scenario(n_teams=10, n_jurors=5, k=2, sigma_bias=5.0)
    r1 = experiment.run(sc, reps=5, seed=7)
    r2 = experiment.run(sc, reps=5, seed=7)
    for key in r1.values:
        assert np.array_equal(r1.values[key]["spearman"], r2.values[key]["spearman"])


def test_greedy_batch_splits_jurors_into_isolated_panels_when_k_divides_j():
    """Відомий дефект поточного розподілу: при J кратному K судді діляться на J/K
    незмінних панелей, що ніколи не перетинаються (див. research/README.md)."""
    for seed in range(10):
        a = assignment.greedy_batch(30, 10, 2, np.random.default_rng(seed))
        assert metrics.juror_components(a, 10) == 5
        a = assignment.greedy_batch(12, 6, 3, np.random.default_rng(seed))
        assert metrics.juror_components(a, 6) == 2


def test_other_methods_connect_jurors_with_enough_teams():
    for method in ("greedy_online", "balanced_pairs", "random_k"):
        comps = [metrics.juror_components(assignment.METHODS[method](30, 10, 2, np.random.default_rng(s)), 10)
                 for s in range(20)]
        assert np.mean(comps) < 1.2
