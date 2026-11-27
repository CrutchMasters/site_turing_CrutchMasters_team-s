"""Аналіз реальних оцінок журі: чи відрізняються судді за суворістю і чи міняє це рейтинг.

Запуск:
    python analyze_real_data.py evaluations.csv [--boot 300] [--out report.md]

Вхід — CSV з export_evaluations.sql (колонки: tournament, round, work, team, juror, score).
Скрипт нічого не змінює в базі й не потребує ключів: працює лише з файлом.
"""

import argparse
import csv
import sys
from collections import defaultdict

import numpy as np

from jury_sim import aggregate, metrics
from jury_sim.real import variance_components

REQUIRED = ("work", "team", "juror", "score")


def read_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"У файлі немає колонок: {', '.join(missing)}")
        return [{**r, "score": float(r["score"])} for r in reader if r.get("score") not in (None, "")]


def components_of_jurors(rows):
    """Скільки груп суддів, що ніколи не оцінювали спільних робіт."""
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_work = defaultdict(list)
    for r in rows:
        by_work[r["work"]].append(r["juror"])
        find(r["juror"])
    for group in by_work.values():
        for j in group[1:]:
            parent[find(j)] = find(group[0])
    return len({find(j) for j in parent})


def places(values):
    """Змагальна нумерація: 1, 1, 3 (більше значення — краще місце)."""
    order = sorted(range(len(values)), key=lambda i: -round(values[i], 2))
    out, prev, prev_place = [0] * len(values), None, 0
    for pos, i in enumerate(order, start=1):
        v = round(values[i], 2)
        if v != prev:
            prev, prev_place = v, pos
        out[i] = prev_place
    return out


def bootstrap_tau(rows, reps, seed):
    """Інтервал для tau: перевибірка робіт із поверненням (95%)."""
    rng = np.random.default_rng(seed)
    works = sorted({r["work"] for r in rows})
    by_work = defaultdict(list)
    for r in rows:
        by_work[r["work"]].append(r)
    taus = []
    for _ in range(reps):
        w_idx, j_lab, sc = [], [], []
        for k, w in enumerate(rng.choice(len(works), size=len(works), replace=True)):
            for r in by_work[works[w]]:
                w_idx.append(k); j_lab.append(r["juror"]); sc.append(r["score"])
        c = variance_components(w_idx, j_lab, sc)
        if c is not None:
            taus.append(c.tau)
    if len(taus) < max(20, reps // 4):
        return None
    return float(np.percentile(taus, 2.5)), float(np.percentile(taus, 97.5))


def analyze(rows, boot=300, seed=2026):
    works = sorted({r["work"] for r in rows})
    jurors = sorted({r["juror"] for r in rows})
    teams = sorted({r["team"] for r in rows})
    per_work = defaultdict(set)
    for r in rows:
        per_work[r["work"]].add(r["juror"])
    k_counts = defaultdict(int)
    for w, js in per_work.items():
        k_counts[len(js)] += 1
    multi = [w for w, js in per_work.items() if len(js) >= 2]

    report = {
        "n_obs": len(rows), "n_works": len(works), "n_jurors": len(jurors), "n_teams": len(teams),
        "k_counts": dict(sorted(k_counts.items())), "n_multi": len(multi),
        "juror_groups": components_of_jurors(rows) if rows else 0,
        "jurors": [], "components": None, "tau_ci": None, "teams": [], "spearman": None, "enough": False,
    }
    for j in jurors:
        s = np.array([r["score"] for r in rows if r["juror"] == j])
        report["jurors"].append({"juror": j, "n": len(s), "mean": float(s.mean()),
                                 "sd": float(s.std(ddof=1)) if len(s) > 1 else None})

    comp = variance_components([r["work"] for r in rows], [r["juror"] for r in rows], [r["score"] for r in rows])
    report["components"] = comp
    report["enough"] = comp is not None and len(multi) >= 3
    if not report["enough"]:
        return report
    report["tau_ci"] = bootstrap_tau(rows, boot, seed) if boot > 0 else None

    # Рейтинг команд: середнє за роботу (як на платформі) і з поправкою; підсумок команди — сума за її роботами
    w_ix = {w: i for i, w in enumerate(works)}
    j_ix = {j: i for i, j in enumerate(jurors)}
    wi = np.array([w_ix[r["work"]] for r in rows]); ji = np.array([j_ix[r["juror"]] for r in rows])
    sc = np.array([r["score"] for r in rows])
    q_mean = aggregate.mean(wi, ji, sc, len(works), len(jurors))
    q_adj = aggregate.ls(wi, ji, sc, len(works), len(jurors), lam=1.0)
    team_of = {r["work"]: r["team"] for r in rows}
    tot_mean, tot_adj = defaultdict(float), defaultdict(float)
    for w in works:
        tot_mean[team_of[w]] += q_mean[w_ix[w]]
        tot_adj[team_of[w]] += q_adj[w_ix[w]]
    m = [tot_mean[t] for t in teams]; a = [tot_adj[t] for t in teams]
    pm, pa = places(m), places(a)
    report["teams"] = sorted(
        ({"team": t, "mean": m[i], "adjusted": a[i], "place_mean": pm[i], "place_adjusted": pa[i]}
         for i, t in enumerate(teams)), key=lambda x: x["place_mean"])
    if len(teams) >= 3:
        report["spearman"] = float(metrics.spearman(np.array(m), np.array(a)))
    return report


def verdict(report):
    comp, ci = report["components"], report["tau_ci"]
    if not report["enough"]:
        return ("Даних недостатньо для висновку: потрібно щонайменше 3 роботи, кожну з яких оцінили двоє і більше суддів "
                "(щоб порівняти суддів між собою).")
    notes = []
    if report["juror_groups"] > 1:
        notes.append(f"Судді поділені на {report['juror_groups']} групи без спільних робіт: між групами строгість порівняти неможливо.")
    if ci is None:
        notes.append(f"Оцінка розкиду суворості суддів: {comp.tau:.1f} бала (інтервал недоступний — мало даних).")
    elif ci[1] < 2.0:
        notes.append(f"Розкид суворості суддів невеликий: ≈{comp.tau:.1f} бала (95% інтервал {ci[0]:.1f}–{ci[1]:.1f}). "
                     "Поправка на суворість майже нічого не змінює.")
    elif ci[0] > 2.0:
        notes.append(f"Судді помітно відрізняються за суворістю: ≈{comp.tau:.1f} бала (95% інтервал {ci[0]:.1f}–{ci[1]:.1f}). "
                     "Поправка має сенс.")
    else:
        notes.append(f"Розкид суворості суддів ≈{comp.tau:.1f} бала, але 95% інтервал широкий ({ci[0]:.1f}–{ci[1]:.1f}): "
                     "даних замало, щоб стверджувати, відрізняються судді чи ні.")
    return " ".join(notes)


def render(report):
    L = ["# Аналіз реальних оцінок журі", ""]
    L += [f"Оцінок: **{report['n_obs']}**, робіт: **{report['n_works']}**, команд: **{report['n_teams']}**, суддів: **{report['n_jurors']}**.",
          "Скільки суддів оцінило кожну роботу (K → кількість робіт): "
          + ", ".join(f"{k} → {v}" for k, v in report["k_counts"].items()) + ".", ""]
    L += ["## Висновок", "", verdict(report), ""]
    comp = report["components"]
    if comp is not None:
        L += ["## Оцінка параметрів моделі", "",
              "| параметр | значення | що це |", "|---|---:|---|",
              f"| розкид суворості суддів (tau) | {comp.tau:.2f} | на скільки балів типовий суддя суворіший чи м'якший за середнього |",
              f"| шум однієї оцінки (sigma) | {comp.sigma:.2f} | випадкова похибка одного судді щодо однієї роботи |", ""]
        if report["tau_ci"]:
            L += [f"95% інтервал для tau (перевибірка робіт): {report['tau_ci'][0]:.2f}–{report['tau_ci'][1]:.2f}.", ""]
    L += ["## Судді", "", "| суддя | оцінок | середня | розкид |", "|---|---:|---:|---:|"]
    for j in report["jurors"]:
        sd = f"{j['sd']:.1f}" if j["sd"] is not None else "—"
        L.append(f"| {j['juror']} | {j['n']} | {j['mean']:.1f} | {sd} |")
    L.append("")
    if report["teams"]:
        L += ["## Рейтинг команд: середнє і з поправкою", "",
              "| команда | сума (середнє) | місце | сума (з поправкою) | місце |", "|---|---:|---:|---:|---:|"]
        for t in report["teams"]:
            L.append(f"| {t['team']} | {t['mean']:.1f} | {t['place_mean']} | {t['adjusted']:.1f} | {t['place_adjusted']} |")
        moved = sum(1 for t in report["teams"] if t["place_mean"] != t["place_adjusted"])
        L += ["", f"Місце змінилося в {moved} з {len(report['teams'])} команд."]
        if report["spearman"] is not None:
            L.append(f"Кореляція Спірмена між двома рейтингами: {report['spearman']:.3f} (1 — рейтинги однакові).")
        L.append("")
    L += ["> Це оцінка за невеликою вибіркою; інтервал показує, наскільки їй можна довіряти. "
          "Імена в таблиці замінено мітками (T, W, C, J).", ""]
    return "\n".join(L)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("csv")
    p.add_argument("--boot", type=int, default=300, help="кількість перевибірок для інтервалу (0 — без інтервалу)")
    p.add_argument("--out", help="зберегти звіт у цей файл (інакше — на екран)")
    args = p.parse_args()
    text = render(analyze(read_rows(args.csv), boot=args.boot))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Звіт записано: {args.out}")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
