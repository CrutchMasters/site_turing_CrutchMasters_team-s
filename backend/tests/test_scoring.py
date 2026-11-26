import asyncio
import contextlib
import io
import math

import pytest
from fastapi import HTTPException

import src.routers.evaluation as evaluation
from src.schemas import JuryEvaluationPayload
from src.services.scoring import ScoringError, compute_total, resolve_criteria

from tests.fake_supabase import FakeSupabase

CRITERIA = [
    {"key": "code", "label": "Код", "weight": 50},
    {"key": "ux", "label": "UX", "weight": 30},
    {"key": "docs", "label": "Документація", "weight": 20},
]


def scores(**kw):
    return {k: {"score": v, "comment": ""} for k, v in kw.items()}


# ---------- compute_total ----------

def test_weighted_sum():
    assert compute_total(scores(code=80, ux=60, docs=100), CRITERIA) == 78.0   # 40 + 18 + 20


def test_empty_and_missing_scores_are_skipped():
    assert compute_total(scores(code=80, ux="", docs=None), CRITERIA) == 40.0
    assert compute_total({}, CRITERIA) == 0.0


def test_rounding_is_half_up_like_javascript_math_round():
    # 0.05 → 0.5 після ×10; JS Math.round(0.5) = 1 → 0,1; round() у Python дав би 0,0
    assert compute_total(scores(only=0.05), [{"key": "only", "weight": 100}]) == 0.1


def test_default_criteria_when_round_has_none():
    keys = ["backend_quality", "database_structure", "frontend_quality", "must_have", "no_bugs"]
    full = {k: {"score": 100, "comment": ""} for k in keys}
    for empty in (None, [], "oops"):
        assert compute_total(full, empty) == 100.0
    assert [c["weight"] for c in resolve_criteria(None)] == [20] * 5


def test_missing_weight_defaults_to_equal_share_and_missing_key_to_index():
    crit = [{"label": "a"}, {"label": "b", "weight": 70}, {"label": "c"}]
    assert [c["key"] for c in resolve_criteria(crit)] == ["criterion_0", "criterion_1", "criterion_2"]
    assert [c["weight"] for c in resolve_criteria(crit)] == [33, 70, 33]


@pytest.mark.parametrize("bad", [-1, 100.5, 101, "85", True, float("nan"), float("inf"), [], {}])
def test_invalid_score_is_rejected(bad):
    with pytest.raises(ScoringError):
        compute_total(scores(code=bad), CRITERIA)


def test_unknown_criterion_and_bad_shapes_are_rejected():
    with pytest.raises(ScoringError):
        compute_total(scores(code=50, hacked=100), CRITERIA)
    with pytest.raises(ScoringError):
        compute_total({"code": 90}, CRITERIA)           # запис має бути {score, comment}
    with pytest.raises(ScoringError):
        compute_total([("code", 90)], CRITERIA)


def test_boundaries_are_allowed():
    assert compute_total(scores(code=0, ux=0, docs=0), CRITERIA) == 0.0
    assert compute_total(scores(code=100, ux=100, docs=100), CRITERIA) == 100.0


# ---------- ендпоінт POST /api/rounds/{id}/evaluate ----------

def _store(criteria=CRITERIA):
    return {
        "rounds": [{"id": "r1", "tournament_id": "t1", "status": "judging", "criteria": criteria}],
        "jury_tournament_invitations": [{"tournament_id": "t1", "jury_id": "j0", "status": "accepted"}],
        "jury_assignments": [{"jury_id": "j0", "round_id": "r1"}],
        "jury_submission_assignments": [{"jury_id": "j0", "submission_id": "s1", "round_id": "r1"}],
        "jury_evaluations": [],
        "submissions": [{"id": "s1", "team_id": "team1"}],
        "teams": [{"id": "team1", "name": "T", "captain_id": "u1", "members_ids": []}],
        "tournaments": [{"id": "t1", "name": "Турнір"}],
        "notifications": [],
    }


def _call(monkeypatch, store, payload, role="jury"):
    monkeypatch.setattr(evaluation, "supabase", FakeSupabase(store))
    monkeypatch.setattr(evaluation, "get_caller", lambda token: {"role": role, "id": "j0", "username": "judge"})
    monkeypatch.setattr(evaluation, "send_notification_email", lambda *a, **k: None)
    monkeypatch.setattr(evaluation, "get_user_email", lambda uid: None)
    with contextlib.redirect_stdout(io.StringIO()):
        return asyncio.run(evaluation.save_jury_evaluation("r1", payload, authorization="Bearer x"))


def _payload(sc, total=None):
    return JuryEvaluationPayload(submission_id="s1", criteria_scores=sc, general_comment="ok", total_score=total)


def test_endpoint_ignores_inflated_client_total(monkeypatch):
    store = _store()
    out = _call(monkeypatch, store, _payload(scores(code=10, ux=10, docs=10), total=100))
    assert out["evaluation"]["total_score"] == 10.0
    assert store["jury_evaluations"][0]["total_score"] == 10.0
    assert store["notifications"][0]["meta"]["total_score"] == 10.0
    assert "10.0" in store["notifications"][0]["message"]


def test_endpoint_works_without_client_total(monkeypatch):
    store = _store()
    out = _call(monkeypatch, store, _payload(scores(code=80, ux=60, docs=100)))
    assert out["evaluation"]["total_score"] == 78.0


def test_endpoint_upsert_replaces_previous_evaluation(monkeypatch):
    store = _store()
    _call(monkeypatch, store, _payload(scores(code=10, ux=10, docs=10)))
    _call(monkeypatch, store, _payload(scores(code=100, ux=100, docs=100)))
    assert len(store["jury_evaluations"]) == 1
    assert store["jury_evaluations"][0]["total_score"] == 100.0


@pytest.mark.parametrize("bad", [scores(code=500), scores(code=50, hacked=1), {"code": 90}])
def test_endpoint_rejects_invalid_scores_with_400(monkeypatch, bad):
    store = _store()
    with pytest.raises(HTTPException) as err:
        _call(monkeypatch, store, _payload(bad, total=100))
    assert err.value.status_code == 400
    assert store["jury_evaluations"] == []


def test_endpoint_uses_round_weights_and_default_criteria(monkeypatch):
    store = _store(criteria=None)
    keys = ["backend_quality", "database_structure", "frontend_quality", "must_have", "no_bugs"]
    out = _call(monkeypatch, store, _payload({k: {"score": 50, "comment": ""} for k in keys}))
    assert out["evaluation"]["total_score"] == 50.0


def test_permissions_are_still_checked_before_scores(monkeypatch):
    store = _store()
    store["jury_submission_assignments"] = [{"jury_id": "other", "submission_id": "s1", "round_id": "r1"}]
    with pytest.raises(HTTPException) as err:
        _call(monkeypatch, store, _payload(scores(code=500)))
    assert err.value.status_code == 403


# ---------------- is_complete ----------------

from src.services.scoring import is_complete  # noqa: E402


def _all(score, keys=("backend_quality", "database_structure", "frontend_quality", "must_have", "no_bugs")):
    return {k: {"score": score, "comment": ""} for k in keys}


def test_is_complete_requires_every_default_criterion():
    assert is_complete(_all(70), None)
    partial = _all(70)
    partial["no_bugs"]["score"] = ""
    assert not is_complete(partial, None)
    del partial["no_bugs"]
    assert not is_complete(partial, None)


def test_is_complete_zero_counts_but_none_and_garbage_do_not():
    assert is_complete(_all(0), None)
    for bad in (None, "", "x", float("nan"), True):
        assert not is_complete(_all(bad), None)
    assert not is_complete(None, None) and not is_complete([], None)


def test_is_complete_follows_round_criteria():
    crit = [{"key": "a", "weight": 50}, {"key": "b", "weight": 50}]
    assert is_complete({"a": {"score": 1}, "b": {"score": 2}}, crit)
    assert not is_complete({"a": {"score": 1}}, crit)


from src.services.scoring import counts_as_final  # noqa: E402


def test_counts_as_final_legacy_null_is_trusted_but_empty_dict_is_not():
    assert counts_as_final(None, None)
    assert not counts_as_final({}, None)
    assert counts_as_final(_all(70), None)
    partial = _all(70)
    partial["must_have"]["score"] = ""
    assert not counts_as_final(partial, None)


from src.services.scoring import validate_round_criteria  # noqa: E402


def _crit(*weights):
    return [{"key": f"criterion_{i}", "label": f"Критерій {i}", "weight": w} for i, w in enumerate(weights)]


def test_validate_round_criteria_accepts_none_empty_and_proper_lists():
    assert validate_round_criteria(None) is None
    assert validate_round_criteria([]) == []
    assert validate_round_criteria(_crit(100)) == _crit(100)
    assert validate_round_criteria(_crit(33, 33, 34)) is not None


@pytest.mark.parametrize("bad", [
    "[object Object]\n[object Object]",           # старий баг: список, склеєний у рядок
    {"key": "a"},
    ["назва", "ще одна"],
    [{"label": "x", "weight": 100}],              # немає key
    [{"key": "a", "label": "", "weight": 100}],
    [{"key": "a", "label": "[object Object]", "weight": 100}],
    [{"key": "a", "label": "x", "weight": "100"}],
    [{"key": "a", "label": "x", "weight": True}],
    [{"key": "a", "label": "x", "weight": 101}],
    [{"key": "a", "label": "x", "weight": -1}],
])
def test_validate_round_criteria_rejects_malformed_input(bad):
    with pytest.raises(ScoringError):
        validate_round_criteria(bad)


def test_validate_round_criteria_requires_weights_to_sum_to_100():
    with pytest.raises(ScoringError, match="100"):
        validate_round_criteria(_crit(50, 40))
