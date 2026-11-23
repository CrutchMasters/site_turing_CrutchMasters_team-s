"""Pydantic-моделі запитів API."""

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr


class UserLogin(BaseModel):
    login: str
    password: str


class TournamentUpdate(BaseModel):
    name:              str | None = None
    rules:             str | None = None
    start_at:          str | None = None
    end_at:            str | None = None
    registration_from: str | None = None
    registration_to:   str | None = None
    max_teams:              int | None = None
    rounds:                 int | None = None
    status:                 str | None = None
    jury_per_submission:    int | None = None


class ChangeRole(BaseModel):
    target_user_id: str
    new_role: str


class SendInvitation(BaseModel):
    team_id: str
    invitee_id: str


class RespondInvitation(BaseModel):
    invitation_id: str
    accept: bool


class SubmitWork(BaseModel):
    team_id:     str
    github_url:  str | None = None
    youtube_url: str | None = None
    live_url:    str | None = None
    description: str | None = None
    is_draft:    bool = False
    files: list[dict] = []


class CreateTeam(BaseModel):
    name: str
    city_school_org: str | None = None
    description: str | None = None
    telegram_url: str | None = None
    discord_url: str | None = None


class UpdateTeam(BaseModel):
    name: str | None = None
    city_school_org: str | None = None
    description: str | None = None
    telegram_url: str | None = None
    discord_url: str | None = None


class RegisterTeamForTournament(BaseModel):
    team_id: str
    tournament_id: str


class SendJuryInvitation(BaseModel):
    jury_id:       str
    tournament_id: str
    round_id:      str | None = None  # якщо None — запрошення на весь турнір (scope='tournament')


class RespondJuryInvitation(BaseModel):
    invitation_id: str
    accept: bool


class SendRoundJuryEmailInvitation(BaseModel):
    email:      str
    round_id:   str


class SendTournamentJuryEmailInvitation(BaseModel):
    email: str


class JuryEvaluationPayload(BaseModel):
    submission_id:   str
    criteria_scores: dict
    general_comment: str | None = None
    total_score:     float | None = None


class RoundStatusUpdate(BaseModel):
    status: str


class PartialRedistributePayload(BaseModel):
    """
    locked_assignments: список пар {"jury_id": "...", "submission_id": "..."}
    які адмін зафіксував вручну — їх чіпати не потрібно.
    Всі роботи, що в поточному стані мають < K журі (або взагалі без журі),
    отримають додаткові призначення до K.
    """
    locked_assignments: list[dict]  # [{"jury_id": "...", "submission_id": "..."}, ...]


class ManualAssignPayload(BaseModel):
    jury_id:       str
    submission_id: str
    action:        str  # "add" | "remove"
