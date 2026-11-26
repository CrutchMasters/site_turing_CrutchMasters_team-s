"""Таблиця лідерів турніру."""

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.services.ranking import DEFAULT_LAMBDA, adjusted_quality, juror_groups
from src.services.scoring import counts_as_final


router = APIRouter()


def round_progress(rounds: list[dict]) -> dict:
    """Скільки раундів турніру вже повністю оцінено (статус judged).

    Підсумок команди — сума балів за раунди, тож доки не всі раунди judged, таблиця
    попередня: команда без оцінки за ще не завершений раунд просто не має цих балів.
    """
    judged = sum(1 for r in rounds if r.get("status") == "judged")
    return {"is_final": bool(rounds) and judged == len(rounds),
            "rounds_judged": judged, "rounds_total": len(rounds)}


def assign_places(entries: list[dict], total_key: str = "total_score", place_key: str = "place") -> None:
    """Проставляє `place` у відсортованому списку; команди з однаковою сумою ділять місце.

    «Змагальна» нумерація: 1, 1, 3 (а не 1, 2, 3): після двох перших місць наступне — третє.
    Порівнюються підсумки в тому вигляді, в якому їх бачить користувач (округлені до 0,01).
    """
    previous_total, previous_place = None, 0
    for index, entry in enumerate(entries, start=1):
        if entry[total_key] != previous_total:
            previous_place = index
            previous_total = entry[total_key]
        entry[place_key] = previous_place


@router.get("/api/tournaments/{tournament_id}/leaderboard")
async def get_tournament_leaderboard(tournament_id: str, authorization: str | None = Header(None)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    # Leaderboard is publicly viewable — no auth required

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, status")
            .eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    rounds_res = supabase.table("rounds") \
        .select("id, name, number, status, criteria") \
        .eq("tournament_id", tournament_id) \
        .order("number") \
        .execute()
    rounds_raw = rounds_res.data or []
    criteria_by_round = {r["id"]: r.get("criteria") for r in rounds_raw}
    # критерії потрібні лише для перевірки повноти оцінок, у відповідь вони не потрапляють
    rounds = [{k: v for k, v in r.items() if k != "criteria"} for r in rounds_raw]

    if not rounds:
        return {"tournament": tournament, "leaderboard": [], "rounds": [], **round_progress([])}

    round_ids = [r["id"] for r in rounds]

    subs_res = supabase.table("submissions") \
        .select("id, round_id, team_id, status, is_draft") \
        .in_("round_id", round_ids) \
        .eq("is_draft", False) \
        .execute()
    submissions = subs_res.data or []

    if not submissions:
        return {"tournament": tournament, "leaderboard": [], "rounds": rounds, **round_progress(rounds)}

    sub_ids = [s["id"] for s in submissions]

    evals_res = supabase.table("jury_evaluations") \
        .select("id, submission_id, jury_id, total_score, criteria_scores") \
        .in_("submission_id", sub_ids) \
        .execute()
    evaluations = evals_res.data or []

    team_ids = list({s["team_id"] for s in submissions})
    teams_res = supabase.table("teams") \
        .select("id, name, city_school_org, captain_id") \
        .in_("id", team_ids) \
        .execute()
    teams_map = {t["id"]: t for t in (teams_res.data or [])}

    captain_ids = list({t.get("captain_id") for t in teams_map.values() if t.get("captain_id")})
    if captain_ids:
        captains_res = supabase.table("account") \
            .select("id, username") \
            .in_("id", captain_ids) \
            .execute()
        captains_map = {c["id"]: c["username"] for c in (captains_res.data or [])}
    else:
        captains_map = {}

    subs_by_team_round: dict = {}
    for s in submissions:
        key = (s["team_id"], s["round_id"])
        subs_by_team_round.setdefault(key, []).append(s)

    evals_by_sub: dict = {}
    for e in evaluations:
        evals_by_sub.setdefault(e["submission_id"], []).append(e)

    team_scores: dict = {}
    observations: list = []                      # (робота, суддя, бал) — для поправки на суворість
    counted_sub: dict = {}                       # (команда, раунд) → робота, що потрапила в підсумок
    for team_id in team_ids:
        team_scores[team_id] = {"rounds": {}, "total": 0.0}
        for r in rounds:
            round_id = r["id"]
            key = (team_id, round_id)
            team_subs = subs_by_team_round.get(key, [])
            if not team_subs:
                team_scores[team_id]["rounds"][round_id] = None
                continue

            team_sub = team_subs[-1]
            sub_evals = evals_by_sub.get(team_sub["id"], [])

            if not sub_evals:
                team_scores[team_id]["rounds"][round_id] = None
                continue

            # Частково заповнені оцінки (журі зберегло не всі критерії) не враховуємо:
            # їхня сума нижча за повну й несправедливо знижувала б середнє команди.
            round_criteria = criteria_by_round.get(round_id)
            counted = [
                e for e in sub_evals
                if e.get("total_score") is not None
                and counts_as_final(e.get("criteria_scores"), round_criteria)
            ]
            scored = [e["total_score"] for e in counted]
            if not scored:
                team_scores[team_id]["rounds"][round_id] = None
                continue

            avg = sum(scored) / len(scored)
            team_scores[team_id]["rounds"][round_id] = round(avg, 2)
            team_scores[team_id]["total"] += avg
            counted_sub[(team_id, round_id)] = team_sub["id"]
            observations.extend((team_sub["id"], e["jury_id"], e["total_score"]) for e in counted)

    # Додатковий рейтинг: якість робіт з поправкою на строгість суддів (див. services/ranking.py)
    quality, _bias = adjusted_quality(observations, DEFAULT_LAMBDA)

    leaderboard = []
    for team_id, scores in team_scores.items():
        team = teams_map.get(team_id, {})
        captain_id = team.get("captain_id")
        adjusted_rounds = {
            round_id: (round(quality[counted_sub[(team_id, round_id)]], 2)
                       if (team_id, round_id) in counted_sub else None)
            for round_id in scores["rounds"]
        }
        entry = {
            "team_id":           team_id,
            "team_name":         team.get("name", "—"),
            "city_school_org":   team.get("city_school_org"),
            "captain_username":  captains_map.get(captain_id) if captain_id else None,
            "round_scores":      scores["rounds"],
            "total_score":       round(scores["total"], 2),
            "evaluated_rounds":  sum(1 for v in scores["rounds"].values() if v is not None),
            "adjusted_round_scores": adjusted_rounds,
            "adjusted_total_score":  round(sum(v for v in adjusted_rounds.values() if v is not None), 2),
        }
        leaderboard.append(entry)

    # Порядок: за підсумком (спадання), а при рівності — за назвою, щоб вивід був стабільним.
    leaderboard.sort(key=lambda x: (-x["total_score"], str(x["team_name"]).casefold()))
    assign_places(leaderboard)
    # Місце за скоригованим підсумком (офіційне місце `place` лишається за простим середнім)
    by_adjusted = sorted(leaderboard, key=lambda x: (-x["adjusted_total_score"], str(x["team_name"]).casefold()))
    assign_places(by_adjusted, "adjusted_total_score", "adjusted_place")

    return {
        "tournament": tournament,
        "rounds":     rounds,
        "leaderboard": leaderboard,
        "adjustment": {
            "method": "ridge_least_squares",
            "lambda": DEFAULT_LAMBDA,
            "evaluations": len(observations),
            "juror_groups": juror_groups(observations),
        },
        **round_progress(rounds),
    }
