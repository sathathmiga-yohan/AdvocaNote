
import smtplib
import ssl

from email.message import EmailMessage
from email.utils import parseaddr

import requests

from app.config import settings


def _send_brevo_email(api_key: str, to_email: str, subject: str, body: str):
    sender_name, sender_email = parseaddr(settings.MAIL_FROM)
    if not sender_email:
        raise OSError("Brevo sender address is missing or invalid.")

    sender = {"email": sender_email}
    if sender_name:
        sender["name"] = sender_name

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Accept": "application/json"},
            json={
                "sender": sender,
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body,
            },
            timeout=20,
            allow_redirects=False,
        )
    except requests.RequestException:
        raise OSError("Brevo email request failed.") from None

    if response.status_code != 201:
        raise OSError(f"Brevo email request failed (HTTP {response.status_code}).")


def send_email(to_email: str, subject: str, body: str):
    api_key = settings.BREVO_API_KEY
    if api_key:
        return _send_brevo_email(api_key.get_secret_value(), to_email, subject, body)

    if not all((settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER, settings.SMTP_PASSWORD)):
        raise OSError("Email delivery is not configured.")

    message = EmailMessage()

    message["From"] = settings.MAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject

    message.set_content(body)

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=20
    ) as server:

        server.starttls(
            context=ssl.create_default_context()
        )

        server.login(
            settings.SMTP_USER,
            settings.SMTP_PASSWORD
        )

        server.send_message(message)
