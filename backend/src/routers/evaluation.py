"""Оцінювання робіт журі."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.schemas import JuryEvaluationPayload
from src.security import get_caller
from src.services.scoring import ScoringError, compute_total
from src.services.emails import get_user_email, send_notification_email


router = APIRouter()


@router.post("/api/rounds/{round_id}/evaluate")
async def save_jury_evaluation(
    round_id: str,
    payload: JuryEvaluationPayload,
    authorization: str = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    caller_role = caller.get("role")
    if caller_role not in ("jury", "superadmin"):
        raise HTTPException(status_code=403, detail="Виставляти оцінки можуть лише журі або суперадмін")

    if caller_role == "jury":
        round_ = fetch_one(
            supabase.table("rounds").select("tournament_id").eq("id", round_id)
        )
        if not round_:
            raise HTTPException(status_code=404, detail="Раунд не знайдено")

        invited = supabase.table("jury_tournament_invitations") \
            .select("id") \
            .eq("tournament_id", round_["tournament_id"]) \
            .eq("jury_id", caller["id"]) \
            .eq("status", "accepted") \
            .execute()

        if not invited.data:
            raise HTTPException(status_code=403, detail="Ви не запрошені до журі цього турніру")

    round_ = fetch_one(
        supabase.table("rounds")
            .select("id, status, tournament_id, criteria")
            .eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    # Перевірка статусу раунду тільки для журі — суперадмін може оцінювати завжди
    if caller_role == "jury":
        round_status = round_.get("status")
        if round_status == "judged":
            raise HTTPException(
                status_code=403,
                detail="Оцінювання заблоковано: раунд вже оцінено та закрито адміністратором."
            )
        if round_status not in ("judging", "active", "finished", "closed", "reviewed"):
            raise HTTPException(
                status_code=400,
                detail=f"Оцінювання недоступне: раунд ще не завершено (статус: '{round_status}'). "
                       "Оцінювання дозволено лише після завершення раунду."
            )

    if caller_role == "jury":
        assignment = fetch_one(
            supabase.table("jury_assignments")
                .select("id")
                .eq("jury_id", caller["id"])
                .eq("round_id", round_id)
        )
        if not assignment:
            round_for_check = fetch_one(
                supabase.table("rounds").select("tournament_id").eq("id", round_id)
            )
            if round_for_check:
                accepted = fetch_one(
                    supabase.table("jury_tournament_invitations")
                        .select("id")
                        .eq("tournament_id", round_for_check["tournament_id"])
                        .eq("jury_id", caller["id"])
                        .eq("status", "accepted")
                )
                if accepted:
                    try:
                        supabase.table("jury_assignments").insert({
                            "jury_id":       caller["id"],
                            "round_id":      round_id,
                            "tournament_id": round_for_check["tournament_id"],
                        }).execute()
                    except Exception as ja_err:
                        print(f"[EVAL] Не вдалося створити jury_assignment: {ja_err}", flush=True)
                else:
                    raise HTTPException(status_code=403, detail="Ви не є журі цього турніру")
            else:
                raise HTTPException(status_code=403, detail="Ви не є журі цього турніру")

        any_assigned_res = supabase.table("jury_submission_assignments") \
            .select("id") \
            .eq("round_id", round_id) \
            .limit(1) \
            .execute()
        has_any_assignments = bool(any_assigned_res.data)

        if has_any_assignments:
            sub_assigned = fetch_one(
                supabase.table("jury_submission_assignments")
                    .select("id")
                    .eq("jury_id", caller["id"])
                    .eq("submission_id", payload.submission_id)
            )
            if not sub_assigned:
                raise HTTPException(
                    status_code=403,
                    detail="Ця робота не призначена вам для оцінювання. Зверніться до адміністратора для перерозподілу."
                )

    # Підсумок рахує сервер за вагами критеріїв раунду; число з клієнта не береться
    try:
        total_score = compute_total(payload.criteria_scores, round_.get("criteria"))
    except ScoringError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if payload.total_score is not None and abs(payload.total_score - total_score) > 0.05:
        print(
            f"[EVAL] total_score з клієнта ({payload.total_score}) не збігається з серверним "
            f"({total_score}) для submission {payload.submission_id}, збережено серверне",
            flush=True,
        )

    record = {
        "jury_id":         caller["id"],
        "submission_id":   payload.submission_id,
        "round_id":        round_id,
        "criteria_scores": payload.criteria_scores,
        "general_comment": payload.general_comment,
        "total_score":     total_score,
        "updated_at":      datetime.now(timezone.utc).isoformat(),
    }

    result = supabase.table("jury_evaluations").upsert(
        record, on_conflict="jury_id,submission_id"
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зберегти оцінку")

    print(f"[EVAL] {caller['username']} зберіг оцінку для submission {payload.submission_id}", flush=True)

    # Сповіщення команди про виставлену оцінку
    try:
        sub_info = fetch_one(
            supabase.table("submissions").select("team_id").eq("id", payload.submission_id)
        )
        if sub_info:
            team_info = fetch_one(
                supabase.table("teams").select("id, name, captain_id, members_ids").eq("id", sub_info["team_id"])
            )
            if team_info:
                tour_info = fetch_one(
                    supabase.table("tournaments").select("name").eq("id", round_["tournament_id"])
                )
                tour_name = tour_info["name"] if tour_info else "Турнір"
                _notif_title   = f"Вашу роботу оцінено"
                _notif_message = (
                    f"Журі виставило оцінку {total_score} для роботи вашої команди "
                    f"«{team_info['name']}» в турнірі «{tour_name}»."
                )
                _all_members = list({team_info["captain_id"]} | set(team_info.get("members_ids") or []))
                for _uid in _all_members:
                    try:
                        supabase.table("notifications").insert({
                            "user_id": _uid,
                            "type":    "evaluation_received",
                            "title":   _notif_title,
                            "message": _notif_message,
                            "meta":    {
                                "submission_id": payload.submission_id,
                                "round_id":      round_id,
                                "total_score":   total_score,
                            },
                            "read": False,
                        }).execute()
                        _email = get_user_email(_uid)
                        if _email:
                            send_notification_email(_email, _notif_title, _notif_message, "evaluation_received")
                    except Exception as _e:
                        print(f"[NOTIFY] evaluation_received для {_uid}: {_e}", flush=True)
    except Exception as _e:
        print(f"[NOTIFY] evaluation notification помилка: {_e}", flush=True)

    return {"success": True, "evaluation": result.data[0]}
