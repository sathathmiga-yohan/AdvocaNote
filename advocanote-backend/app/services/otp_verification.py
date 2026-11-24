"""Compatibility imports for the existing email verification service."""

from app.services.verification import (
    send_registration_otp,
    send_verification_email,
    verify_email_token,
    verify_registration_otp,
)

__all__ = [
    "send_registration_otp",
    "send_verification_email",
    "verify_email_token",
    "verify_registration_otp",
]
