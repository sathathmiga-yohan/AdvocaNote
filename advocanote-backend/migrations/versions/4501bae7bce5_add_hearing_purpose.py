"""add hearing purpose

Revision ID: 4501bae7bce5
Revises: 60abde51d92e
Create Date: 2026-10-29 12:36:47.115208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4501bae7bce5'
down_revision: Union[str, Sequence[str], None] = '60abde51d92e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
