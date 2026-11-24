"""Complete missing application tables and columns without replacing existing data.

Revision ID: 0d7bb486f2a1
Revises: f6f9c4214d30
"""

import sqlalchemy as sa
from alembic import op


revision = "0d7bb486f2a1"
down_revision = "f6f9c4214d30"
branch_labels = None
depends_on = None


def _create_missing_tables(existing):
    def create(name, *columns):
        if name not in existing:
            op.create_table(name, *columns, mysql_engine="InnoDB")

    # Preserve the original billing definitions if a database was marked at
    # the previous head without all of the billing tables.
    create(
        "subscription_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="LKR"),
        sa.Column("billing_interval", sa.String(20), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("trial_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("daily_action_limit", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("stripe_product_id", sa.String(255)),
        sa.Column("stripe_price_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("stripe_price_id", name="uq_subscription_plans_stripe_price_id"),
    )
    create(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("trial_ends_at", sa.DateTime()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("current_period_start", sa.DateTime()),
        sa.Column("current_period_end", sa.DateTime()),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user_id"),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_subscriptions_stripe_subscription_id"),
    )
    create(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id", ondelete="RESTRICT")),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="LKR"),
        sa.Column("provider", sa.String(30), nullable=False, server_default="stripe"),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("stripe_checkout_session_id", sa.String(255), unique=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), unique=True),
        sa.Column("stripe_invoice_id", sa.String(255), unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime()),
    )
    create(
        "subscription_upgrades",
        sa.Column("id", sa.Integer(), primary_key=True),
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
    create(
        "account_deletions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("original_user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
    )
    create(
        "account_recovery_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime()),
    )
    create(
        "calendar_custom_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lawyer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_time", sa.Time()),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
    )
    create(
        "diary_ai_analyses",
        sa.Column("diary_entry_id", sa.Integer(), sa.ForeignKey("diary_entries.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("notes_json", sa.Text(), nullable=False),
        sa.Column("highlights_json", sa.Text(), nullable=False),
        sa.Column("output_language", sa.String(2), nullable=False),
        sa.Column("analysis_incomplete", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    create(
        "diary_voice_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("diary_entry_id", sa.Integer(), sa.ForeignKey("diary_entries.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("lawyer_id", sa.Integer(), nullable=False),
        sa.Column("file_key", sa.String(100), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("source_transcript", sa.Text(), nullable=False),
        sa.Column("reviewed_transcript", sa.Text(), nullable=False),
        sa.Column("ai_notes_json", sa.Text(), nullable=False),
        sa.Column("highlights_json", sa.Text(), nullable=False),
        sa.Column("approved_notes_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    create(
        "subscription_daily_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("actions_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_subscription_daily_usage_user_day"),
        sa.CheckConstraint("actions_used >= 0", name="ck_subscription_daily_usage_nonnegative"),
    )


def _check_missing_billing_parents(bind, existing):
    dependencies = {
        "subscription_plans": (
            ("subscriptions", "plan_id"),
            ("payments", "plan_id"),
            ("subscription_upgrades", "target_plan_id"),
        ),
        "subscriptions": (
            ("payments", "subscription_id"),
            ("subscription_upgrades", "subscription_id"),
        ),
    }
    for parent, children in dependencies.items():
        if parent in existing:
            continue
        for table, column in children:
            if table not in existing:
                continue
            child = sa.table(table, sa.column(column))
            if bind.execute(
                sa.select(sa.literal(1)).select_from(child).where(child.c[column].is_not(None)).limit(1)
            ).first() is not None:
                raise RuntimeError(
                    f"{table} contains rows referencing missing {parent}. "
                    "Restore or reconcile the missing parent data before retrying."
                )


def upgrade():
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    required = {
        "users", "verifications", "login_sessions", "password_resets", "courts",
        "cases", "diary_entries", "ai_suggestions", "hearings", "tasks", "reminders",
    }
    missing = required - existing
    if missing:
        raise RuntimeError(
            "Application schema is missing historical tables: "
            + ", ".join(sorted(missing))
            + ". Verify the Alembic revision and restore or reconcile the schema before retrying."
        )

    _check_missing_billing_parents(bind, existing)
    _create_missing_tables(existing)

    # Startup added some of these columns on existing installations. MySQL
    # commits DDL implicitly, so guard the additions to allow a safe retry.
    inspector = sa.inspect(bind)
    additions = {
        "cases": (sa.Column("case_type", sa.String(100)), sa.Column("case_stage", sa.String(100))),
        "reminders": (
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("read_at", sa.DateTime()),
            sa.Column("custom_event_id", sa.Integer()),
        ),
        "subscription_plans": (sa.Column("daily_action_limit", sa.Integer()),),
    }
    for table, columns in additions.items():
        present = {column["name"] for column in inspector.get_columns(table)}
        for column in columns:
            if column.name not in present:
                op.add_column(table, column)

    inspector = sa.inspect(bind)
    for table, columns in {
        "account_recovery_tokens": ("user_id",),
        "calendar_custom_events": ("lawyer_id", "event_date"),
        "diary_voice_attachments": ("lawyer_id",),
        "reminders": ("custom_event_id",),
        "subscription_daily_usage": ("user_id",),
        "subscription_upgrades": ("subscription_id", "status"),
    }.items():
        indexed = {tuple(index["column_names"]) for index in inspector.get_indexes(table)}
        for column in columns:
            if (column,) not in indexed:
                op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    raise RuntimeError("Additive schema repair cannot be downgraded without risking existing data.")
