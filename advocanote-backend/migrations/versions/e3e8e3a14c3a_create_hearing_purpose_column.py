"""create hearing purpose column

Revision ID: e3e8e3a14c3a
Revises: 4501bae7bce5
Create Date: 2026-10-29 12:56:01.671504

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3e8e3a14c3a'
down_revision: Union[str, Sequence[str], None] = '4501bae7bce5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    columns = {
        column["name"]
        for column in inspector.get_columns("hearings")
    }

    if "purpose" not in columns:
        op.add_column(
            "hearings",
            sa.Column(
                "purpose",
                sa.String(length=255),
                nullable=True,
            ),
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    columns = {
        column["name"]
        for column in inspector.get_columns("hearings")
    }

    if "purpose" in columns:
        op.drop_column("hearings", "purpose")
