
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ==========================================
# CREATE SUBSCRIPTION PLAN
# ==========================================

class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=2,
        max_length=100
    )

    description: str | None = Field(
        default=None,
        max_length=500
    )

    price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2
    )

    currency: Literal["LKR"] = "LKR"

    billing_interval: Literal[
        "month",
        "year"
    ]

    features: list[str] = Field(
        default_factory=list,
        max_length=30
    )

    trial_days: int = Field(
        default=0,
        ge=0,
        le=30
    )

    # ======================================
    # DYNAMIC DAILY DIARY ENTRY LIMIT
    # ======================================
    # 3    = 3 diary entries per day
    # 5    = 5 diary entries per day
    # 10   = 10 diary entries per day
    # None = Unlimited

    daily_action_limit: int | None = Field(
        default=None,
        ge=1
    )

    is_active: bool = True


# ==========================================
# UPDATE SUBSCRIPTION PLAN
# ==========================================

class PlanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    description: str | None = Field(
        default=None,
        max_length=500
    )

    price: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2
    )

    billing_interval: Literal[
        "month",
        "year"
    ] | None = None

    features: list[str] | None = Field(
        default=None,
        max_length=30
    )

    trial_days: int | None = Field(
        default=None,
        ge=0,
        le=30
    )

    # Update daily entry limit.
    # Explicit null = Unlimited.
    # Omitted field = No change.

    daily_action_limit: int | None = Field(
        default=None,
        ge=1
    )

    is_active: bool | None = None


# ==========================================
# SUBSCRIPTION PLAN RESPONSE
# ==========================================

class PlanResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    name: str
    description: str | None

    price: Decimal
    currency: str

    billing_interval: str

    features: list[str]

    trial_days: int

    daily_action_limit: int | None = None

    is_active: bool

    created_at: datetime
