"""Мінімальна in-memory підміна supabase-клієнта для тестів ендпоінтів."""


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, store, name):
        self.store, self.name = store, name
        self.filters, self.mode, self.rows, self.lim = [], "select", None, None

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

    def upsert(self, row, on_conflict=""):
        self.mode, self.rows, self.conflict = "upsert", row, [c.strip() for c in on_conflict.split(",") if c.strip()]
        return self

    def execute(self):
        table = self.store.setdefault(self.name, [])
        match = lambda row: all(row.get(k) == v for k, v in self.filters)
        if self.mode == "delete":
            self.store[self.name] = [r for r in table if not match(r)]
            return Result([])
        if self.mode == "insert":
            table.extend(self.rows if isinstance(self.rows, list) else [self.rows])
            return Result(self.rows)
        if self.mode == "upsert":
            for existing in table:
                if all(existing.get(c) == self.rows.get(c) for c in self.conflict):
                    existing.update(self.rows)
                    return Result([existing])
            table.append(dict(self.rows))
            return Result([self.rows])
        out = [r for r in table if match(r)]
        return Result(out[: self.lim] if self.lim else out)


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return Query(self.store, name)


def make_store(n_subs: int, n_jurors: int, k: int) -> dict:
    return {
        "rounds": [{"id": "r1", "tournament_id": "t1", "status": "judging"}],
        "tournaments": [{"id": "t1", "jury_per_submission": k}],
        "jury_tournament_invitations": [
            {"tournament_id": "t1", "jury_id": f"j{i}", "status": "accepted"} for i in range(n_jurors)],
        "submissions": [{"id": f"s{i}", "round_id": "r1", "is_draft": False} for i in range(n_subs)],
        "jury_submission_assignments": [],
    }


def assignment_pairs(store) -> list[tuple[str, str]]:
    return [(r["jury_id"], r["submission_id"]) for r in store["jury_submission_assignments"]]


def juror_components(pairs, jurors) -> int:
    """Кількість груп суддів, що ніколи не оцінювали спільних робіт."""
    parent = {j: j for j in jurors}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_sub: dict[str, list[str]] = {}
    for jury_id, sub_id in pairs:
        by_sub.setdefault(sub_id, []).append(jury_id)
    for group in by_sub.values():
        for j in group[1:]:
            parent[find(j)] = find(group[0])
    return len({find(j) for j in jurors})


def load_spread(pairs, jurors) -> int:
    loads = {j: 0 for j in jurors}
    for jury_id, _ in pairs:
        loads[jury_id] += 1
    return max(loads.values()) - min(loads.values())
