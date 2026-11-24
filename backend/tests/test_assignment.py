import asyncio
import contextlib
import io
import random
from collections import Counter

import pytest

import src.routers.rounds as rounds
import src.services.assignment as assignment
from src.schemas import PartialRedistributePayload

from tests.fake_supabase import (FakeSupabase, assignment_pairs, juror_components,
                                 load_spread, make_store)

SEEDS = range(25)
# (робіт, суддів, K): достатньо робіт, щоб судді могли бути пов'язані між собою
CASES = [(30, 10, 2), (12, 6, 3), (30, 6, 2), (40, 8, 4), (30, 10, 3)]


def _quiet(coro):
    with contextlib.redirect_stdout(io.StringIO()):
        return asyncio.run(coro)


@pytest.fixture
def admin(monkeypatch):
    monkeypatch.setattr(rounds, "get_caller", lambda token: {"role": "admin", "username": "t"})


def _setup(monkeypatch, n_subs, n_jurors, k):
    store = make_store(n_subs, n_jurors, k)
    monkeypatch.setattr(rounds, "supabase", FakeSupabase(store))
    return store, [f"j{i}" for i in range(n_jurors)]


# ---------- pick_least_loaded ----------

def test_pick_least_loaded_takes_lowest_load_and_distinct():
    load = {"a": 3, "b": 0, "c": 1, "d": 0, "e": 2}
    chosen = assignment.pick_least_loaded(list(load), load, 3)
    assert len(set(chosen)) == 3
    assert set(chosen) == {"b", "d", "c"}


def test_pick_least_loaded_count_larger_than_pool_returns_all():
    assert sorted(assignment.pick_least_loaded(["a", "b"], {"a": 0, "b": 0}, 5)) == ["a", "b"]


def test_pick_least_loaded_does_not_mutate_inputs():
    candidates = ["a", "b", "c"]
    load = {"a": 0, "b": 0, "c": 0}
    assignment.pick_least_loaded(candidates, load, 2)
    assert candidates == ["a", "b", "c"] and load == {"a": 0, "b": 0, "c": 0}


def test_pick_least_loaded_breaks_ties_differently_on_each_call():
    """Регресія: раніше нічиї розв'язувались одним shuffle на весь раунд."""
    load = {f"j{i}": 0 for i in range(10)}
    rng = random.Random(1)
    firsts = Counter(tuple(assignment.pick_least_loaded(list(load), load, 2, rng)) for _ in range(300))
    assert len(firsts) > 10          # багато різних пар, а не одна й та сама


# ---------- redistribute_submissions ----------

@pytest.mark.parametrize("n_subs,n_jurors,k", CASES)
def test_redistribute_gives_every_submission_k_distinct_jurors(monkeypatch, admin, n_subs, n_jurors, k):
    store, jurors = _setup(monkeypatch, n_subs, n_jurors, k)
    random.seed(0)
    _quiet(rounds.redistribute_submissions("r1", authorization="Bearer x"))
    pairs = assignment_pairs(store)
    assert len(pairs) == n_subs * k and len(set(pairs)) == len(pairs)
    per_sub = Counter(sid for _, sid in pairs)
    assert set(per_sub.values()) == {k}


@pytest.mark.parametrize("n_subs,n_jurors,k", CASES)
def test_redistribute_keeps_load_balanced(monkeypatch, admin, n_subs, n_jurors, k):
    for seed in SEEDS:
        store, jurors = _setup(monkeypatch, n_subs, n_jurors, k)
        random.seed(seed)
        _quiet(rounds.redistribute_submissions("r1", authorization="Bearer x"))
        assert load_spread(assignment_pairs(store), jurors) <= 1


@pytest.mark.parametrize("n_subs,n_jurors,k", CASES)
def test_redistribute_does_not_split_jurors_into_isolated_panels(monkeypatch, admin, n_subs, n_jurors, k):
    """Регресія: при кількості суддів, кратній K, судді ділились на J/K незмінних панелей."""
    for seed in SEEDS:
        store, jurors = _setup(monkeypatch, n_subs, n_jurors, k)
        random.seed(seed)
        _quiet(rounds.redistribute_submissions("r1", authorization="Bearer x"))
        assert juror_components(assignment_pairs(store), jurors) == 1, f"seed={seed}"


# ---------- partial_redistribute_submissions ----------

def _partial(monkeypatch, n_subs, n_jurors, k, locked, seed=0):
    store, jurors = _setup(monkeypatch, n_subs, n_jurors, k)
    random.seed(seed)
    payload = PartialRedistributePayload(locked_assignments=locked)
    _quiet(rounds.partial_redistribute_submissions("r1", payload, authorization="Bearer x"))
    return store, jurors


@pytest.mark.parametrize("n_subs,n_jurors,k", CASES)
def test_partial_redistribute_without_locks_is_balanced_and_connected(monkeypatch, admin, n_subs, n_jurors, k):
    for seed in SEEDS:
        store, jurors = _partial(monkeypatch, n_subs, n_jurors, k, [], seed)
        pairs = assignment_pairs(store)
        assert len(pairs) == n_subs * k and len(set(pairs)) == len(pairs)
        assert load_spread(pairs, jurors) <= 1
        assert juror_components(pairs, jurors) == 1, f"seed={seed}"


def test_partial_redistribute_keeps_locked_pairs_and_fills_up_to_k(monkeypatch, admin):
    locked = [{"jury_id": "j0", "submission_id": "s0"}, {"jury_id": "j1", "submission_id": "s0"},
              {"jury_id": "j2", "submission_id": "s1"}]
    store, _ = _partial(monkeypatch, 12, 6, 3, locked)
    pairs = assignment_pairs(store)
    for item in locked:
        assert (item["jury_id"], item["submission_id"]) in pairs
    assert len(set(pairs)) == len(pairs)
    assert set(Counter(sid for _, sid in pairs).values()) == {3}


# ---------- auto_assign_submission (при подачі роботи) ----------

def test_auto_assign_balances_and_connects_jurors(monkeypatch):
    for seed in SEEDS:
        store = make_store(0, 10, 2)
        monkeypatch.setattr(assignment, "supabase", FakeSupabase(store))
        random.seed(seed)
        with contextlib.redirect_stdout(io.StringIO()):
            for i in range(30):
                assert assignment.auto_assign_submission(f"s{i}", "r1", "t1") == 2
        jurors = [f"j{i}" for i in range(10)]
        pairs = assignment_pairs(store)
        assert load_spread(pairs, jurors) <= 1
        assert juror_components(pairs, jurors) == 1, f"seed={seed}"
