"""add_processed_filename_to_uploadlog

Revision ID: f86c93c7a872
Revises: 1ab2db0e4b5e
Create Date: 2025-06-28 15:56:29.169668

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f86c93c7a872'
down_revision: Union[str, Sequence[str], None] = '1ab2db0e4b5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('uploadlog', 
                 sa.Column('processed_filename', sa.String(), nullable=True),
                 schema=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('uploadlog', 'processed_filename', schema=None)
