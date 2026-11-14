"""create payments table

Revision ID: 38aee0ee9923
Revises: 7024b90b2279
Create Date: 2026-11-10 10:38:52.611140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38aee0ee9923'
down_revision: Union[str, Sequence[str], None] = '7024b90b2279'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:

    op.create_table(
        "payments",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),

        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="RESTRICT"
            ),
            nullable=False
        ),

        sa.Column(
            "subscription_id",
            sa.Integer(),
            sa.ForeignKey(
                "subscriptions.id",
                ondelete="RESTRICT"
            ),
            nullable=True
        ),

        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey(
                "subscription_plans.id",
                ondelete="RESTRICT"
            ),
            nullable=False
        ),

        sa.Column(
            "amount",
            sa.Numeric(10, 2),
            nullable=False
        ),

        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'LKR'")
        ),

        sa.Column(
            "provider",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'stripe'")
        ),

        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'pending'")
        ),

        sa.Column(
            "stripe_checkout_session_id",
            sa.String(255),
            unique=True,
            nullable=True
        ),

        sa.Column(
            "stripe_payment_intent_id",
            sa.String(255),
            unique=True,
            nullable=True
        ),

        sa.Column(
            "stripe_invoice_id",
            sa.String(255),
            unique=True,
            nullable=True
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),

        sa.Column(
            "paid_at",
            sa.DateTime(),
            nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_table("payments")
