"""create lawyer subscriptions

Revision ID: 7024b90b2279
Revises: e4188767de73
Create Date: 2026-11-10 10:06:45.162509

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7024b90b2279'
down_revision: Union[str, Sequence[str], None] = 'e4188767de73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:

    op.create_table(
        "subscriptions",

        sa.Column(
            "id", sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),

        sa.Column(
            "user_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False
        ),

        sa.Column(
            "plan_id", sa.Integer(),
            sa.ForeignKey(
                "subscription_plans.id",
                ondelete="RESTRICT"
            ),
            nullable=False
        ),

        sa.Column(
            "status", sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'")
        ),

        sa.Column(
            "trial_ends_at", sa.DateTime(),
            nullable=True
        ),

        sa.Column(
            "started_at", sa.DateTime(),
            nullable=True
        ),

        sa.Column(
            "current_period_start", sa.DateTime(),
            nullable=True
        ),

        sa.Column(
            "current_period_end", sa.DateTime(),
            nullable=True
        ),

        sa.Column(
            "cancel_at_period_end", sa.Boolean(),
            nullable=False,
            server_default=sa.text("0")
        ),

        sa.Column(
            "stripe_customer_id", sa.String(255),
            nullable=True
        ),

        sa.Column(
            "stripe_subscription_id", sa.String(255),
            nullable=True
        ),

        sa.Column(
            "created_at", sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),

        sa.UniqueConstraint(
            "user_id",
            name="uq_subscriptions_user_id"
        ),

        sa.UniqueConstraint(
            "stripe_subscription_id",
            name="uq_subscriptions_stripe_subscription_id"
        )
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
