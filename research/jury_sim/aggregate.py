"""Методи агрегації оцінок у рейтинг команд.

Усі функції приймають (teams, jurors, scores, n_teams, n_jurors) і повертають
вектор оцінок команд (n_teams,): більше = краще.

  mean   — те, що робить leaderboard.py зараз: просте середнє оцінок за роботу.
  center — вилучити середнє судді (поправка на зсув), потім середнє по командах.
  zscore — як center, але ще нормування на розкид оцінок судді.
  ls     — адитивна модель «команда + суддя» методом найменших квадратів
           з невеликою регуляризацією (ridge) зсувів суддів.
"""

import numpy as np


def _team_mean(teams, values, n_teams):
    total = np.bincount(teams, weights=values, minlength=n_teams)
    count = np.bincount(teams, minlength=n_teams)
    return total / np.maximum(count, 1)


def mean(teams, jurors, scores, n_teams, n_jurors):
    return _team_mean(teams, scores, n_teams)


def center(teams, jurors, scores, n_teams, n_jurors):
    totals = np.bincount(jurors, weights=scores, minlength=n_jurors)
    counts = np.bincount(jurors, minlength=n_jurors)
    juror_mean = totals / np.maximum(counts, 1)
    return _team_mean(teams, scores - juror_mean[jurors], n_teams)


def zscore(teams, jurors, scores, n_teams, n_jurors, min_n: int = 3):
    totals = np.bincount(jurors, weights=scores, minlength=n_jurors)
    counts = np.bincount(jurors, minlength=n_jurors)
    juror_mean = totals / np.maximum(counts, 1)
    dev = scores - juror_mean[jurors]
    sq = np.bincount(jurors, weights=dev ** 2, minlength=n_jurors)
    sd = np.sqrt(sq / np.maximum(counts - 1, 1))
    # мало оцінок або нульовий розкид — z-оцінка нестабільна, лишаємо просте центрування
    use = (counts >= min_n) & (sd > 1e-9)
    scale = np.where(use, sd, 1.0)
    return _team_mean(teams, dev / scale[jurors], n_teams)


def ls(teams, jurors, scores, n_teams, n_jurors, lam: float = 1.0):
    """min ||s - q[t] - b[j]||^2 + lam * ||b||^2. Ранжуємо за q.
    Регуляризація робить задачу розв'язною, навіть якщо судді не «зв'язані»
    спільними роботами (наприклад, при k = 1)."""
    n_obs = len(scores)
    n_par = n_teams + n_jurors
    a = np.zeros((n_obs + n_jurors, n_par))
    a[np.arange(n_obs), teams] = 1.0
    a[np.arange(n_obs), n_teams + jurors] = 1.0
    a[n_obs + np.arange(n_jurors), n_teams + np.arange(n_jurors)] = np.sqrt(lam)
    y = np.concatenate([scores, np.zeros(n_jurors)])
    sol, *_ = np.linalg.lstsq(a, y, rcond=None)
    return sol[:n_teams]


METHODS = {
    "mean": mean,
    "center": center,
    "zscore": zscore,
    "ls": ls,
}
