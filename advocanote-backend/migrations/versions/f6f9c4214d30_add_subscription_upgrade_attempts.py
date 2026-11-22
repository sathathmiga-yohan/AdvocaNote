"""Track paid Stripe Checkout subscription replacements.

Revision ID: f6f9c4214d30
Revises: 38aee0ee9923
"""
from alembic import op
import sqlalchemy as sa

revision = "f6f9c4214d30"
down_revision = "38aee0ee9923"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "subscription_upgrades",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=False),
        sa.Column("target_plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("source_stripe_subscription_id", sa.String(255), nullable=False, unique=True),
        sa.Column("source_period_end", sa.BigInteger(), nullable=False),
        sa.Column("attempt_key", sa.String(36), nullable=False, unique=True),
        sa.Column("stripe_checkout_session_id", sa.String(255), unique=True),
        sa.Column("replacement_stripe_subscription_id", sa.String(255), unique=True),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
    )
    op.create_index("ix_subscription_upgrades_subscription_id", "subscription_upgrades", ["subscription_id"])
    op.create_index("ix_subscription_upgrades_status", "subscription_upgrades", ["status"])


def downgrade():
    op.drop_table("subscription_upgrades")
