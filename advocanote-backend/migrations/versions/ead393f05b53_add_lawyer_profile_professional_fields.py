"""add lawyer profile professional fields

Revision ID: ead393f05b53
Revises: 3624a224a6d1
Create Date: 2026-11-09 12:31:09.334129

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ead393f05b53'
down_revision: Union[str, Sequence[str], None] = '3624a224a6d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
