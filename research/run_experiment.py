"""Запуск: python run_experiment.py [--reps 400] [--seed 2026] [--out results]

Пише results/results.csv (усі сценарії і комбінації) і results/summary.md.
"""

import argparse
import csv
import itertools
import os

from jury_sim import aggregate, assignment, experiment, model

BASELINE = ("greedy_batch", "mean")      # так працює платформа зараз
GRID = {
    "n_teams":    (10, 30),
    "n_jurors":   (5, 10),
    "k":          (1, 2, 3),
    "sigma_bias": (0.0, 5.0, 10.0),
}


def scenarios():
    for n_teams, n_jurors, k, sb in itertools.product(*GRID.values()):
        yield model.Scenario(n_teams=n_teams, n_jurors=n_jurors, k=k, sigma_bias=sb)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--reps", type=int, default=400)
    p.add_argument("--seed", type=int, default=2026)
    p.add_argument("--out", default="results")
    args = p.parse_args()
    os.makedirs(args.out, exist_ok=True)

    results = []
    for i, sc in enumerate(scenarios()):
        res = experiment.run(sc, args.reps, seed=args.seed + i)
        results.append(res)
        print(f"[{i + 1}] teams={sc.n_teams} jurors={sc.n_jurors} k={sc.k} bias={sc.sigma_bias}", flush=True)

    with open(os.path.join(args.out, "results.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["n_teams", "n_jurors", "k", "sigma_bias", "assignment", "aggregation",
                    "spearman", "kendall", "top3", "winner", "load_spread", "reps"])
        for res in results:
            sc = res.scenario
            for (a, g), v in res.values.items():
                w.writerow([sc.n_teams, sc.n_jurors, sc.k, sc.sigma_bias, a, g,
                            *(round(float(v[m].mean()), 4) for m in experiment.METRICS),
                            round(float(res.spread[a].mean()), 3), res.reps])

    write_summary(results, os.path.join(args.out, "summary.md"), args)


def write_summary(results, path, args):
    lines = [
        "# Результати симуляції",
        "",
        f"Повторів на сценарій: {args.reps}, seed: {args.seed}. "
        f"Базова лінія (як зараз на платформі): `{BASELINE[0]} + {BASELINE[1]}`.",
        "Метрика — кореляція Спірмена між отриманим і справжнім рейтингом (1 = ідеально).",
        "Різниця — середній виграш відносно базової лінії; `±` — 95% довірчий інтервал (парні повтори).",
        "",
        "## Головне порівняння: лише змінюємо агрегацію (розподіл — як зараз)",
        "",
        "Порівнюються дві наперед обрані комбінації, без добору найкращої за результатами "
        "(добір з 16 варіантів завищував би виграш).",
        "",
        "| команд | суддів | K | зсув судді σ | базова ρ | `greedy_batch + ls` ρ | виграш ls | `greedy_batch + center` ρ | виграш center |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for res in results:
        sc = res.scenario
        base = float(res.values[BASELINE]["spearman"].mean())
        row = [f"| {sc.n_teams} | {sc.n_jurors} | {sc.k} | {sc.sigma_bias:g} | {base:.3f}"]
        for agg in ("ls", "center"):
            combo = ("greedy_batch", agg)
            gain, ci = experiment.paired_diff(res, combo, BASELINE)
            row += [f"{res.values[combo]['spearman'].mean():.3f}", f"{gain:+.3f} ± {ci:.3f}"]
        lines.append(" | ".join(row) + " |")

    lines += ["", "## Окремо: вплив лише агрегації (розподіл — як зараз, `greedy_batch`)", "",
              "| команд | суддів | K | σ | mean | center | zscore | ls |", "|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for res in results:
        sc = res.scenario
        cells = " | ".join(f"{res.values[('greedy_batch', g)]['spearman'].mean():.3f}" for g in aggregate.METHODS)
        lines.append(f"| {sc.n_teams} | {sc.n_jurors} | {sc.k} | {sc.sigma_bias:g} | {cells} |")

    lines += ["", "## Окремо: вплив лише розподілу (агрегація — просте середнє)", "",
              "| команд | суддів | K | σ | " + " | ".join(assignment.METHODS) + " |",
              "|---:|---:|---:|---:|" + "---:|" * len(assignment.METHODS)]
    for res in results:
        sc = res.scenario
        cells = " | ".join(f"{res.values[(a, 'mean')]['spearman'].mean():.3f}" for a in assignment.METHODS)
        lines.append(f"| {sc.n_teams} | {sc.n_jurors} | {sc.k} | {sc.sigma_bias:g} | {cells} |")

    lines += ["", "## Взаємодія: агрегація `ls` при різних способах розподілу", "",
              "Поправка на строгість судді працює лише якщо судді пов'язані спільними роботами. "
              "Порівняйте `greedy_batch` з рештою там, де кількість суддів ділиться на K.", "",
              "| команд | суддів | K | σ | " + " | ".join(assignment.METHODS) + " |",
              "|---:|---:|---:|---:|" + "---:|" * len(assignment.METHODS)]
    for res in results:
        sc = res.scenario
        if sc.sigma_bias != 10.0 or sc.k == 1:
            continue
        cells = " | ".join(f"{res.values[(a, 'ls')]['spearman'].mean():.3f}" for a in assignment.METHODS)
        lines.append(f"| {sc.n_teams} | {sc.n_jurors} | {sc.k} | {sc.sigma_bias:g} | {cells} |")

    lines += ["", "## Властивості розподілу: розкид навантаження та ізольовані групи суддів", "",
              "Розкид = макс − мін робіт на суддю. Групи = скільки наборів суддів, що ніколи не "
              "оцінювали спільних робіт (1 — добре, більше — судді не порівнювані між групами).", "",
              "| команд | суддів | K | " + " | ".join(f"{a}: розкид / групи" for a in assignment.METHODS) + " |",
              "|---:|---:|---:|" + "---:|" * len(assignment.METHODS)]
    seen = set()
    for res in results:
        sc = res.scenario
        key = (sc.n_teams, sc.n_jurors, sc.k)
        if key in seen:
            continue
        seen.add(key)
        cells = " | ".join(f"{res.spread[a].mean():.2f} / {res.components[a].mean():.2f}" for a in assignment.METHODS)
        lines.append(f"| {sc.n_teams} | {sc.n_jurors} | {sc.k} | {cells} |")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Записано: {path}")


if __name__ == "__main__":
    main()
