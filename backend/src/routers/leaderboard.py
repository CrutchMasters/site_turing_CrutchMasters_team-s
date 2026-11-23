"""Таблиця лідерів турніру."""

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase


router = APIRouter()


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
        .select("id, name, number, status") \
        .eq("tournament_id", tournament_id) \
        .order("number") \
        .execute()
    rounds = rounds_res.data or []

    if not rounds:
        return {"tournament": tournament, "leaderboard": [], "rounds": []}

    round_ids = [r["id"] for r in rounds]

    subs_res = supabase.table("submissions") \
        .select("id, round_id, team_id, status, is_draft") \
        .in_("round_id", round_ids) \
        .eq("is_draft", False) \
        .execute()
    submissions = subs_res.data or []

    if not submissions:
        return {"tournament": tournament, "leaderboard": [], "rounds": rounds}

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

            scored = [e["total_score"] for e in sub_evals if e.get("total_score") is not None]
            if not scored:
                team_scores[team_id]["rounds"][round_id] = None
                continue

            avg = sum(scored) / len(scored)
            team_scores[team_id]["rounds"][round_id] = round(avg, 2)
            team_scores[team_id]["total"] += avg

    leaderboard = []
    for team_id, scores in team_scores.items():
        team = teams_map.get(team_id, {})
        captain_id = team.get("captain_id")
        entry = {
            "team_id":           team_id,
            "team_name":         team.get("name", "—"),
            "city_school_org":   team.get("city_school_org"),
            "captain_username":  captains_map.get(captain_id) if captain_id else None,
            "round_scores":      scores["rounds"],
            "total_score":       round(scores["total"], 2),
            "evaluated_rounds":  sum(1 for v in scores["rounds"].values() if v is not None),
        }
        leaderboard.append(entry)

    leaderboard.sort(key=lambda x: x["total_score"], reverse=True)

    for i, entry in enumerate(leaderboard):
        entry["place"] = i + 1

    return {
        "tournament": tournament,
        "rounds":     rounds,
        "leaderboard": leaderboard,
    }
