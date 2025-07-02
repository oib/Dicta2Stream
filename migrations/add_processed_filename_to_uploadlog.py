"""Add processed_filename to UploadLog

Revision ID: add_processed_filename_to_uploadlog
Revises: 
Create Date: 2025-06-28 13:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_processed_filename_to_uploadlog'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add the processed_filename column to the uploadlog table
    op.add_column('uploadlog', 
                 sa.Column('processed_filename', sa.String(), nullable=True))

def downgrade():
    # Remove the processed_filename column if rolling back
    op.drop_column('uploadlog', 'processed_filename')
