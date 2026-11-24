"""Монте-Карло: для кожного сценарію повторюємо турнір reps разів і міряємо
якість рейтингу для кожної пари (розподіл × агрегація)."""

from dataclasses import dataclass

import numpy as np

from . import aggregate, assignment, metrics, model

METRICS = ("spearman", "kendall", "top3", "winner")


@dataclass
class Result:
    scenario: model.Scenario
    reps: int
    # (assign, agg) -> {metric: array(reps)}
    values: dict
    # assign -> array(reps) різниця навантажень між суддями
    spread: dict
    # assign -> array(reps) число ізольованих груп суддів
    components: dict


def run(sc: model.Scenario, reps: int, seed: int) -> Result:
    rng = np.random.default_rng(seed)
    values = {
        (a, g): {m: np.zeros(reps) for m in METRICS}
        for a in assignment.METHODS for g in aggregate.METHODS
    }
    spread = {a: np.zeros(reps) for a in assignment.METHODS}
    components = {a: np.zeros(reps) for a in assignment.METHODS}

    for r in range(reps):
        d = model.draw(sc, rng)
        for a_name, a_fn in assignment.METHODS.items():
            assign = a_fn(sc.n_teams, sc.n_jurors, sc.k, rng)
            spread[a_name][r] = metrics.load_spread(assign, sc.n_jurors)
            components[a_name][r] = metrics.juror_components(assign, sc.n_jurors)
            teams, jurors, scores = model.score(d, assign)
            for g_name, g_fn in aggregate.METHODS.items():
                est = g_fn(teams, jurors, scores, sc.n_teams, sc.n_jurors)
                v = values[(a_name, g_name)]
                v["spearman"][r] = metrics.spearman(d.quality, est)
                v["kendall"][r] = metrics.kendall(d.quality, est)
                v["top3"][r] = metrics.top_k_overlap(d.quality, est, 3)
                v["winner"][r] = metrics.winner_correct(d.quality, est)
    return Result(sc, reps, values, spread, components)


def paired_diff(res: Result, combo: tuple, base: tuple, metric: str = "spearman"):
    """Середня різниця combo − base і 95% довірчий інтервал (парні повтори)."""
    diff = res.values[combo][metric] - res.values[base][metric]
    se = diff.std(ddof=1) / np.sqrt(len(diff))
    return float(diff.mean()), float(1.96 * se)
