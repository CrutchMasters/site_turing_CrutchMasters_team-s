"""Методи розподілу робіт між журі.

Кожна функція повертає масив (n_teams, k): для кожної команди — k РІЗНИХ суддів.

Перші два методи відтворюють поведінку бекенду (backend/src):
  * greedy_batch  — routers/rounds.py::redistribute_submissions
  * greedy_online — services/assignment.py::auto_assign_submission
Вони лише повторюють алгоритм, код бекенду тут не імпортується (він залежить
від Supabase). Відповідність підтримується вручну — див. research/README.md.
"""

import numpy as np


def random_k(n_teams: int, n_jurors: int, k: int, rng: np.random.Generator) -> np.ndarray:
    """Базова лінія: кожній роботі k випадкових суддів, без обліку навантаження."""
    return np.array([rng.choice(n_jurors, size=k, replace=False) for _ in range(n_teams)])


def greedy_batch(n_teams: int, n_jurors: int, k: int, rng: np.random.Generator) -> np.ndarray:
    """redistribute_submissions: роботи в випадковому порядку, суддя з найменшим
    навантаженням. Порядок суддів перемішується ОДИН раз, далі працює стабільне
    сортування — тож «випадкове розв'язання нічиїх» фіксоване для всього раунду."""
    jury = rng.permutation(n_jurors).tolist()
    load = {j: 0 for j in jury}
    out = np.zeros((n_teams, k), dtype=int)
    for t in rng.permutation(n_teams):
        chosen = sorted(jury, key=lambda j: load[j])[:k]
        for j in chosen:
            load[j] += 1
        out[t] = chosen
    return out


def greedy_online(n_teams: int, n_jurors: int, k: int, rng: np.random.Generator) -> np.ndarray:
    """auto_assign_submission: при кожній подачі кандидати перемішуються заново,
    потім стабільне сортування за навантаженням."""
    load = np.zeros(n_jurors, dtype=int)
    out = np.zeros((n_teams, k), dtype=int)
    for t in rng.permutation(n_teams):
        cands = rng.permutation(n_jurors).tolist()
        cands.sort(key=lambda j: load[j])
        chosen = cands[:k]
        for j in chosen:
            load[j] += 1
        out[t] = chosen
    return out


def balanced_pairs(n_teams: int, n_jurors: int, k: int, rng: np.random.Generator) -> np.ndarray:
    """Кандидат: навантаження рівне, як у greedy, але серед рівних за навантаженням
    обирається суддя, який найменше працював разом з уже вибраними. Це розмішує
    «панелі» суддів, і результати різних суддів краще зв'язуються між собою."""
    load = np.zeros(n_jurors, dtype=int)
    together = np.zeros((n_jurors, n_jurors), dtype=int)
    out = np.zeros((n_teams, k), dtype=int)
    for t in rng.permutation(n_teams):
        chosen: list[int] = []
        for _ in range(k):
            best, best_key = None, None
            for j in range(n_jurors):
                if j in chosen:
                    continue
                key = (load[j], sum(together[j, c] for c in chosen), rng.random())
                if best_key is None or key < best_key:
                    best, best_key = j, key
            chosen.append(best)
        for a in chosen:
            load[a] += 1
            for b in chosen:
                if a != b:
                    together[a, b] += 1
        out[t] = chosen
    return out


METHODS = {
    "random_k": random_k,
    "greedy_online": greedy_online,
    "greedy_batch": greedy_batch,
    "balanced_pairs": balanced_pairs,
}
