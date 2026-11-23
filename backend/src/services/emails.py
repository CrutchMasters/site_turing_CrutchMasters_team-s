"""Відправка email-сповіщень (Gmail SMTP) у фоновому треді."""

import os

from src.db import supabase


def send_notification_email(to_email: str, title: str, message: str, notif_type: str = "notification", accept_url: str = ""):
    """
    Відправляє email через Gmail SMTP у фоновому daemon-треді.
    Ніколи не блокує event loop FastAPI або планувальник APScheduler.
    Потребує GMAIL_USER і GMAIL_APP_PASSWORD у .env (App Password, не звичайний пароль!).
    """
    import threading as _email_threading

    # Захоплюємо всі змінні до запуску треду (env читається в основному треді)
    gmail_user     = os.getenv("GMAIL_USER", "").strip()
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()

    if not gmail_user or not gmail_password:
        print(
            f"[EMAIL] ⚠️  GMAIL_USER або GMAIL_APP_PASSWORD не задано в env — "
            f"лист НЕ відправлено ({to_email}). "
            f"Задай ці змінні на Render: Settings → Environment.",
            flush=True,
        )
        return

    def _do_send():
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from datetime import datetime, timezone as _tz

        # Читабельні назви типів для badge
        _badge_labels: dict[str, str] = {
            "team_invitation":         "Запрошення до команди",
            "invitation_accepted":     "Запрошення прийнято",
            "invitation_declined":     "Запрошення відхилено",
            "kicked_from_team":        "Виключено з команди",
            "tournament_registered":   "Реєстрація на турнір",
            "tournament_unregistered": "Знято з турніру",
            "tournament_start":        "Старт турніру",
            "deadline_24h":            "Дедлайн через 24 год",
            "evaluation_received":     "Нова оцінка",
            "jury_invitation":         "Запрошення журі",
            "jury_invitation_accepted":"Журі прийняв запрошення",
            "jury_invitation_declined":"Журі відхилив запрошення",
            "score_updated":           "Оцінку оновлено",
            "notification":            "Сповіщення",
        }
        badge_label = _badge_labels.get(notif_type, notif_type.replace("_", " ").title())

        # Текст та стиль кнопки залежно від типу
        if "invitation" in notif_type and accept_url:
            btn_text = "✓ Прийняти запрошення"
        else:
            btn_text = "Перейти на платформу"

        date_str = datetime.now(_tz.utc).strftime("%d.%m.%Y %H:%M")

        html = f"""<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #eef2f7; margin: 0; padding: 40px 20px; }}
    .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(37,99,235,0.10); border: 1px solid #dbeafe; }}
    .header {{ background: linear-gradient(135deg, #1d4ed8, #2563eb); padding: 32px 40px; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }}
    .header p {{ color: rgba(255,255,255,0.75); margin: 5px 0 0; font-size: 13px; }}
    .body {{ padding: 36px 40px 28px; }}
    .badge {{ display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 18px; }}
    .title {{ color: #1e293b; font-size: 20px; font-weight: 700; margin: 0 0 12px; line-height: 1.3; }}
    .message {{ color: #475569; font-size: 15px; line-height: 1.7; margin: 0; }}
    .divider {{ height: 1px; background: #e2e8f0; margin: 28px 0 0; }}
    .btn-wrap {{ padding: 24px 40px 28px; }}
    .btn {{ display: inline-block; background: #1d4ed8; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 8px; letter-spacing: 0.2px; }}
    .footer {{ padding: 14px 40px 22px; background: #f8fafc; border-top: 1px solid #e2e8f0; }}
    .footer p {{ color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CrutchMasters</h1>
      <p>Сповіщення платформи</p>
    </div>
    <div class="body">
      <span class="badge">{badge_label}</span>
      <p class="title">{title}</p>
      <p class="message">{message}</p>
      <div class="divider"></div>
    </div>
    {f'<div class="btn-wrap"><a href="{accept_url}" class="btn">{btn_text}</a></div>' if accept_url else ''}
    <div class="footer">
      <p>{date_str} UTC &bull; Це автоматичне повідомлення, не відповідайте на нього.</p>
    </div>
  </div>
</body>
</html>"""

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = title
            msg["From"]    = f"CrutchMasters <{gmail_user}>"
            msg["To"]      = to_email
            msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(gmail_user, gmail_password)
                server.sendmail(gmail_user, to_email, msg.as_string())

            print(f"[EMAIL] ✅ Відправлено → {to_email} | {notif_type} | {title}", flush=True)
        except smtplib.SMTPAuthenticationError:
            print(
                f"[EMAIL] ❌ SMTPAuthenticationError — перевір GMAIL_APP_PASSWORD. "
                f"Потрібен 'App Password' (myaccount.google.com/apppasswords), "
                f"не звичайний пароль від Gmail. Також увімкни 2FA на акаунті.",
                flush=True,
            )
        except Exception as e:
            print(f"[EMAIL] ❌ Помилка відправки → {to_email}: {e}", flush=True)

    _email_threading.Thread(target=_do_send, daemon=True).start()


def get_user_email(user_id: str) -> str | None:
    """Отримує email користувача якщо email_notifications увімкнено."""
    if not supabase or not user_id:
        return None
    try:
        res = supabase.table("account").select("email, email_notifications").eq("id", user_id).limit(1).execute()
        if res.data:
            row = res.data[0]
            enabled = row.get("email_notifications")
            print(f"[EMAIL_NOTIF] user={user_id} email_notifications={enabled!r} type={type(enabled).__name__}", flush=True)
            if enabled is False or enabled == False or str(enabled).lower() == "false":
                print(f"[EMAIL_NOTIF] Пропускаємо — користувач вимкнув email", flush=True)
                return None
            return row.get("email")
    except Exception as e:
        print(f"[EMAIL] Не вдалося отримати email для {user_id}: {e}", flush=True)
    return None
