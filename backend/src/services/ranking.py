"""Оцінка якості робіт із поправкою на строгість суддів.

Модель (та сама, що в `research/jury_sim/aggregate.py::ls`):

    оцінка(робота i, суддя j) = якість[i] + зсув[j] + шум

«Зсув» — наскільки суддя суворіший (<0) або м'якший (>0) за середнього. Якість робіт і
зсуви суддів підбираються методом найменших квадратів з невеликою регуляризацією
зсувів (λ·Σ зсув²): без неї зсув неможливо відокремити від якості, коли суддя оцінив
мало робіт. Поправка працює лише там, де судді «зв'язані» спільними роботами; якщо кожну
роботу оцінює один суддя (K = 1), результат збігається зі звичайним середнім.

Це чиста математика без бази даних і без зовнішніх бібліотек: систему розв'язано
виключенням якостей, тож лишається невелика (J × J) задача для зсувів суддів.
"""

from collections import defaultdict

DEFAULT_LAMBDA = 1.0


def _solve(matrix: list[list[float]], rhs: list[float]) -> list[float]:
    """Розв'язок СЛАР методом Гауса з вибором головного елемента (матриця додатно визначена)."""
    n = len(rhs)
    a = [row[:] + [rhs[i]] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        a[col], a[pivot] = a[pivot], a[col]
        for r in range(col + 1, n):
            factor = a[r][col] / a[col][col]
            if factor:
                for c in range(col, n + 1):
                    a[r][c] -= factor * a[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (a[r][n] - sum(a[r][c] * x[c] for c in range(r + 1, n))) / a[r][r]
    return x


def juror_groups(observations) -> int:
    """Скільки груп суддів, що ніколи не оцінювали спільних робіт (1 — усі зв'язані)."""
    parent: dict = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_item = defaultdict(list)
    for item, juror, _ in observations:
        by_item[item].append(juror)
        find(juror)
    for group in by_item.values():
        for j in group[1:]:
            parent[find(j)] = find(group[0])
    return len({find(j) for j in parent})


def adjusted_quality(observations, lam: float = DEFAULT_LAMBDA):
    """observations: [(item, juror, score)]. Повертає ({item: якість}, {juror: зсув}).

    Якість — на тій самій шкалі балів, що й оцінки (середній зсув суддів ≈ 0).
    Кожен суддя має оцінити роботу не більше одного разу (дубль береться останнім).
    """
    latest: dict = {}
    for item, juror, score in observations:
        latest[(item, juror)] = float(score)
    by_item: dict = defaultdict(dict)
    for (item, juror), score in latest.items():
        by_item[item][juror] = score
    jurors = sorted({j for raters in by_item.values() for j in raters}, key=str)
    index = {j: k for k, j in enumerate(jurors)}
    size = len(jurors)

    # (XᵀX + λI) b = Xᵀỹ, де X — індикатори суддів, відцентровані всередині роботи
    matrix = [[0.0] * size for _ in range(size)]
    rhs = [0.0] * size
    for raters in by_item.values():
        n_i = len(raters)
        mean_i = sum(raters.values()) / n_i
        idx = [index[j] for j in raters]
        for j, score in raters.items():
            rhs[index[j]] += score - mean_i
        for a in idx:
            matrix[a][a] += 1.0
            for b in idx:
                matrix[a][b] -= 1.0 / n_i
    for k in range(size):
        matrix[k][k] += lam

    bias = _solve(matrix, rhs) if size else []
    quality = {item: sum(score - bias[index[j]] for j, score in raters.items()) / len(raters)
               for item, raters in by_item.items()}
    return quality, {j: bias[index[j]] for j in jurors}
