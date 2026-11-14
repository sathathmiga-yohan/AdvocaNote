
import smtplib
import ssl

from email.message import EmailMessage
from app.config import settings


def send_email(to_email: str, subject: str, body: str):

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
