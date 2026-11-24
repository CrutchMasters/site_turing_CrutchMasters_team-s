"""Перевірка, що симуляція відповідає РЕАЛЬНОМУ коду бекенду.

Викликає справжню функцію backend/src/routers/rounds.py::redistribute_submissions
з підміненою in-memory базою і рахує групи суддів, що ніколи не оцінювали
спільних робіт. Запуск (з оточення бекенду, де встановлено fastapi/supabase):

    cd backend && python ../research/verify_against_backend.py
"""

import asyncio
import contextlib
import io
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
for key in ("SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY"):
    os.environ.pop(key, None)

with contextlib.redirect_stdout(io.StringIO()):
    import src.routers.rounds as rounds


class Res:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, store, name):
        self.store, self.name, self.filters, self.mode, self.rows, self.lim = store, name, [], "select", None, None

    def select(self, *_):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, n):
        self.lim = n
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def insert(self, rows):
        self.mode, self.rows = "insert", rows
        return self

    def execute(self):
        table = self.store.setdefault(self.name, [])
        match = lambda r: all(r.get(k) == v for k, v in self.filters)
        if self.mode == "delete":
            self.store[self.name] = [r for r in table if not match(r)]
            return Res([])
        if self.mode == "insert":
            table.extend(self.rows)
            return Res(self.rows)
        out = [r for r in table if match(r)]
        return Res(out[: self.lim] if self.lim else out)


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return Query(self.store, name)


def components(pairs, jurors):
    parent = {j: j for j in jurors}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_sub = {}
    for jury_id, sub_id in pairs:
        by_sub.setdefault(sub_id, []).append(jury_id)
    for js in by_sub.values():
        for j in js[1:]:
            parent[find(j)] = find(js[0])
    return len({find(j) for j in jurors})


def run(n_teams, n_jurors, k, seed):
    random.seed(seed)
    jurors = [f"j{i}" for i in range(n_jurors)]
    store = {
        "rounds": [{"id": "r1", "tournament_id": "t1", "status": "judging"}],
        "tournaments": [{"id": "t1", "jury_per_submission": k}],
        "jury_tournament_invitations": [
            {"tournament_id": "t1", "jury_id": j, "status": "accepted"} for j in jurors],
        "submissions": [{"id": f"s{i}", "round_id": "r1", "is_draft": False} for i in range(n_teams)],
        "jury_submission_assignments": [],
    }
    rounds.supabase = FakeSupabase(store)
    rounds.get_caller = lambda token: {"role": "admin", "username": "verify"}
    with contextlib.redirect_stdout(io.StringIO()):
        asyncio.run(rounds.redistribute_submissions("r1", authorization="Bearer x"))
    pairs = [(r["jury_id"], r["submission_id"]) for r in store["jury_submission_assignments"]]
    return components(pairs, jurors)


if __name__ == "__main__":
    cases = [(10, 10, 2, 5), (30, 10, 2, 5), (12, 6, 3, 2), (12, 6, 2, 3), (30, 10, 3, 1), (10, 5, 2, 1)]
    ok = True
    for teams, jurors, k, expected in cases:
        got = {run(teams, jurors, k, s) for s in range(30)}
        status = "OK " if got == {expected} else "ERR"
        ok &= got == {expected}
        print(f"{status} teams={teams} jurors={jurors} K={k}: групи суддів = {sorted(got)} (очікувалось {expected})")
    sys.exit(0 if ok else 1)
