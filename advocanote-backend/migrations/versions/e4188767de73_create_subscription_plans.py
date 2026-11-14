"""create subscription plans

Revision ID: e4188767de73
Revises: 9e57dd0418e7
Create Date: 2026-11-10 09:48:04.124281

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4188767de73'
down_revision: Union[str, Sequence[str], None] = '9e57dd0418e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column(
            "id", sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),
        sa.Column(
            "name", sa.String(100),
            nullable=False
        ),
        sa.Column(
            "description", sa.String(500),
            nullable=True
        ),
        sa.Column(
            "price", sa.Numeric(10, 2),
            nullable=False
        ),
        sa.Column(
            "currency", sa.String(3),
            nullable=False,
            server_default=sa.text("'LKR'")
        ),
        sa.Column(
            "billing_interval", sa.String(20),
            nullable=False
        ),
        sa.Column(
            "features", sa.JSON(),
            nullable=False
        ),
        sa.Column(
            "trial_days", sa.Integer(),
            nullable=False,
            server_default=sa.text("0")
        ),
        sa.Column(
            "is_active", sa.Boolean(),
            nullable=False,
            server_default=sa.text("1")
        ),
        sa.Column(
            "stripe_product_id", sa.String(255),
            nullable=True
        ),
        sa.Column(
            "stripe_price_id", sa.String(255),
            nullable=True
        ),
        sa.Column(
            "created_at", sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "stripe_price_id",
            name="uq_subscription_plans_stripe_price_id"
        )
    )


def downgrade() -> None:
    op.drop_table("subscription_plans")
