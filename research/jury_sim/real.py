"""Оцінка за реальними даними: наскільки судді відрізняються за суворістю.

Модель та сама, що в симуляції: оцінка = якість роботи + зсув судді + шум.
Тут ми, навпаки, маємо оцінки й хочемо визначити два числа:

  tau   — розкид суворості суддів (σ у симуляції): на скільки балів «типовий» суддя
          суворіший чи м'якший за середнього;
  sigma — шум однієї оцінки (випадкова похибка одного судді щодо однієї роботи).

Метод — REML для лінійної змішаної моделі: якість роботи — фіксований ефект (прибираємо
центруванням усередині роботи), зсув судді — випадковий ефект. Потрібні роботи, яких
оцінили щонайменше двоє суддів (K ≥ 2); інакше зсув судді не відокремити від якості.
"""

from dataclasses import dataclass

import numpy as np


@dataclass
class Components:
    tau: float          # розкид суворості суддів (бали)
    sigma: float        # шум однієї оцінки (бали)
    n_obs: int
    n_works: int
    n_jurors: int
    df: int             # скільки «порівнянь усередині робіт» доступно (n_obs − n_works)


def _onehot(idx: np.ndarray, size: int) -> np.ndarray:
    m = np.zeros((len(idx), size))
    m[np.arange(len(idx)), idx] = 1.0
    return m


def variance_components(works, jurors, scores, grid: int = 160):
    """REML-оцінка (tau, sigma). Повертає None, якщо даних недостатньо (df ≤ 0)."""
    works = np.asarray(works)
    jurors = np.asarray(jurors)
    y = np.asarray(scores, dtype=float)
    _, wi = np.unique(works, return_inverse=True)
    _, ji = np.unique(jurors, return_inverse=True)
    n, m, n_j = len(y), wi.max() + 1, ji.max() + 1
    df = n - m
    if df <= 0 or n_j < 2:
        return None

    x = _onehot(wi, m)
    z = _onehot(ji, n_j)
    proj = x @ np.linalg.pinv(x.T @ x) @ x.T
    u, _, _ = np.linalg.svd(np.eye(n) - proj)
    q = u[:, :df]                                    # базис простору «усередині робіт»
    b = q.T @ z
    lam, vec = np.linalg.eigh(b @ b.T)
    lam = np.clip(lam, 0.0, None)
    r = vec.T @ (q.T @ y)

    best = None
    for delta in np.concatenate([[0.0], np.logspace(-4, 3, grid)]):   # delta = tau² / sigma²
        w = 1.0 + delta * lam
        s2 = float(np.mean(r ** 2 / w))
        if s2 <= 0:
            continue
        ll = -0.5 * (np.sum(np.log(w)) + df * np.log(s2))
        if best is None or ll > best[0]:
            best = (ll, delta, s2)
    _, delta, s2 = best
    return Components(tau=float(np.sqrt(delta * s2)), sigma=float(np.sqrt(s2)),
                      n_obs=n, n_works=int(m), n_jurors=int(n_j), df=int(df))
