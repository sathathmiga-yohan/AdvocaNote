
"""add hearing reschedule fields

Revision ID: 60abde51d92e
Revises: c5ba33c8d092
Create Date: 2026-10-28 21:07:07.003896
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect
from alembic import op


# Alembic revision identifiers
revision: str = "60abde51d92e"

down_revision: Union[str, Sequence[str], None] = (
    "c5ba33c8d092"
)

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add hearing reschedule support.

    Safe for a database where the previous
    migration partially completed.
    """

    connection = op.get_bind()

    inspector = inspect(connection)

    columns = {
        column["name"]: column
        for column in inspector.get_columns("hearings")
    }

    # 1. Add postponement reason if missing.

    if "reschedule_reason" not in columns:
        op.add_column(
            "hearings",
            sa.Column(
                "reschedule_reason",
                sa.Text(),
                nullable=True,
            ),
        )

    # 2. Add old hearing reference if missing.

    if "rescheduled_from_id" not in columns:
        op.add_column(
            "hearings",
            sa.Column(
                "rescheduled_from_id",
                sa.Integer(),
                nullable=True,
            ),
        )

    # 3. Allow rescheduled hearings without
    # a linked diary entry.

    if not columns["diary_entry_id"]["nullable"]:
        op.alter_column(
            "hearings",
            "diary_entry_id",
            existing_type=sa.Integer(),
            nullable=True,
        )

    # 4. Add self-referencing foreign key
    # only when it does not already exist.

    inspector = inspect(connection)

    foreign_keys = inspector.get_foreign_keys(
        "hearings"
    )

    foreign_key_exists = any(
        fk.get("constrained_columns")
        == ["rescheduled_from_id"]
        and fk.get("referred_table") == "hearings"
        and fk.get("referred_columns") == ["id"]
        for fk in foreign_keys
    )

    if not foreign_key_exists:
        op.create_foreign_key(
            "fk_hearings_rescheduled_from_id",
            "hearings",
            "hearings",
            ["rescheduled_from_id"],
            ["id"],
        )

    # IMPORTANT:
    # Do not change tasks.diary_entry_id.
    # Manual tasks must allow NULL.


def downgrade() -> None:
    """
    Remove reschedule schema only when safe.
    """

    connection = op.get_bind()

    linked_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM hearings "
            "WHERE rescheduled_from_id IS NOT NULL"
        )
    ).scalar_one()

    unlinked_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM hearings "
            "WHERE diary_entry_id IS NULL"
        )
    ).scalar_one()

    if linked_count or unlinked_count:
        raise RuntimeError(
            "Cannot downgrade: hearing records "
            "depend on the reschedule schema."
        )

    inspector = inspect(connection)

    foreign_keys = inspector.get_foreign_keys(
        "hearings"
    )

    for fk in foreign_keys:
        if (
            fk.get("constrained_columns")
            == ["rescheduled_from_id"]
            and fk.get("referred_table") == "hearings"
        ):
            op.drop_constraint(
                fk["name"],
                "hearings",
                type_="foreignkey",
            )

    op.alter_column(
        "hearings",
        "diary_entry_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_column(
        "hearings",
        "rescheduled_from_id",
    )

    op.drop_column(
        "hearings",
        "reschedule_reason",
    )
