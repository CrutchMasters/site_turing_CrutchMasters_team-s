"""Модель оцінювання: оцінка = якість команди + зсув судді + шум.

    score(команда t, суддя j) = quality[t] + bias[j] + noise[t, j]

Шум генерується один раз для кожної пари (команда, суддя), тому всі методи
в одному повторі бачать однакові випадкові числа (common random numbers):
різниця між методами — це різниця методів, а не удачі.
"""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Scenario:
    n_teams: int
    n_jurors: int
    k: int                          # скільки суддів оцінює кожну роботу
    sigma_bias: float               # розкид «суворості» суддів
    sigma_noise: float = 5.0        # випадковий шум однієї оцінки
    sigma_quality: float = 10.0     # розкид справжньої якості команд
    mean: float = 70.0

    def __post_init__(self):
        if not 1 <= self.k <= self.n_jurors:
            raise ValueError("потрібно 1 <= k <= n_jurors")


@dataclass(frozen=True)
class Draw:
    quality: np.ndarray             # (n_teams,)
    bias: np.ndarray                # (n_jurors,)
    noise: np.ndarray               # (n_teams, n_jurors)


def draw(sc: Scenario, rng: np.random.Generator) -> Draw:
    return Draw(
        quality=rng.normal(sc.mean, sc.sigma_quality, sc.n_teams),
        bias=rng.normal(0.0, sc.sigma_bias, sc.n_jurors),
        noise=rng.normal(0.0, sc.sigma_noise, (sc.n_teams, sc.n_jurors)),
    )


def score(d: Draw, assignment: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """assignment: (n_teams, k) індекси суддів. Повертає (team_idx, juror_idx, scores).

    Оцінки обрізаються до [0, 100], як на реальній шкалі.
    """
    n_teams, k = assignment.shape
    teams = np.repeat(np.arange(n_teams), k)
    jurors = assignment.reshape(-1)
    raw = d.quality[teams] + d.bias[jurors] + d.noise[teams, jurors]
    return teams, jurors, np.clip(raw, 0.0, 100.0)
