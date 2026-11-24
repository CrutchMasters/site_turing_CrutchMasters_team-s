"""Метрики якості рейтингу відносно «справжнього» (за прихованою якістю команд)."""

import numpy as np


def _ranks(x: np.ndarray) -> np.ndarray:
    order = np.argsort(x, kind="mergesort")
    r = np.empty(len(x))
    r[order] = np.arange(len(x))
    # усереднені ранги для однакових значень
    for v in np.unique(x):
        idx = np.where(x == v)[0]
        if len(idx) > 1:
            r[idx] = r[idx].mean()
    return r


def spearman(true: np.ndarray, est: np.ndarray) -> float:
    a, b = _ranks(true), _ranks(est)
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def kendall(true: np.ndarray, est: np.ndarray) -> float:
    dt = np.sign(true[:, None] - true[None, :])
    de = np.sign(est[:, None] - est[None, :])
    iu = np.triu_indices(len(true), k=1)
    return float(np.mean(dt[iu] * de[iu]))


def top_k_overlap(true: np.ndarray, est: np.ndarray, k: int = 3) -> float:
    k = min(k, len(true))
    t = set(np.argsort(-true)[:k].tolist())
    e = set(np.argsort(-est)[:k].tolist())
    return len(t & e) / k


def winner_correct(true: np.ndarray, est: np.ndarray) -> float:
    return float(np.argmax(true) == np.argmax(est))


def load_spread(assignment: np.ndarray, n_jurors: int) -> int:
    """Різниця між найбільш і найменш завантаженим суддею (кількість робіт)."""
    loads = np.bincount(assignment.reshape(-1), minlength=n_jurors)
    return int(loads.max() - loads.min())


def juror_components(assignment: np.ndarray, n_jurors: int) -> int:
    """Скільки груп суддів, які ніколи не оцінювали спільних робіт (зв'язність).
    1 = усі судді пов'язані ланцюжками спільних робіт, і строгість можна порівняти;
    більше 1 = ізольовані «панелі», між якими поправка на строгість неможлива."""
    parent = list(range(n_jurors))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for row in assignment:
        for j in row[1:]:
            parent[find(int(j))] = find(int(row[0]))
    return len({find(j) for j in range(n_jurors)})
