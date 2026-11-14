
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator
)


class Register(BaseModel):

    full_name: str = Field(
        min_length=2,
        max_length=150
    )

    email: EmailStr

    password: str = Field(
        min_length=12,
        max_length=128
    )

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if len(value) < 2:
            raise ValueError("Enter a valid name")

        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class UserResponse(BaseModel):

    id: int
    full_name: str
    email: EmailStr
    role: str
    is_email_verified: bool

    model_config = {
        "from_attributes": True
    }


class VerifyEmail(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=256
    )


class ResendVerification(BaseModel):
    email: EmailStr


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(
        min_length=40,
        max_length=256
    )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=12, max_length=128)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=1)
