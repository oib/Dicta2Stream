"""Add session and public_stream tables

Revision ID: 0002
Revises: 0001
Create Date: 2023-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    # Create public_stream table
    op.create_table(
        'public_stream',
        sa.Column('uid', sa.String(), nullable=False, comment='User ID of the stream owner'),
        sa.Column('filename', sa.String(), nullable=False, comment='Name of the audio file'),
        sa.Column('size', sa.BigInteger(), nullable=False, comment='File size in bytes'),
        sa.Column('mtime', sa.Float(), nullable=False, comment='Last modified time as Unix timestamp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('uid', 'filename')
    )
    
    # Create session table
    op.create_table(
        'session',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False, index=True, comment='Reference to user.username'),
        sa.Column('token', sa.Text(), nullable=False, index=True, comment='Random session token'),
        sa.Column('ip_address', sa.String(45), nullable=False, comment='IP address of the client'),
        sa.Column('user_agent', sa.Text(), nullable=True, comment='User-Agent header from the client'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False, comment='When the session expires'),
        sa.Column('last_used_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, onupdate=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False, comment='Whether the session is active'),
        sa.ForeignKeyConstraint(['user_id'], ['user.username'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_session_user_id', 'session', ['user_id'], unique=False)
    op.create_index('ix_session_token', 'session', ['token'], unique=True)
    op.create_index('ix_session_expires_at', 'session', ['expires_at'], unique=False)
    op.create_index('ix_session_last_used_at', 'session', ['last_used_at'], unique=False)
    op.create_index('ix_public_stream_uid', 'public_stream', ['uid'], unique=False)
    op.create_index('ix_public_stream_updated_at', 'public_stream', ['updated_at'], unique=False)


def downgrade():
    # Drop indexes first
    op.drop_index('ix_session_user_id', table_name='session')
    op.drop_index('ix_session_token', table_name='session')
    op.drop_index('ix_session_expires_at', table_name='session')
    op.drop_index('ix_session_last_used_at', table_name='session')
    op.drop_index('ix_public_stream_uid', table_name='public_stream')
    op.drop_index('ix_public_stream_updated_at', table_name='public_stream')
    
    # Drop tables
    op.drop_table('session')
    op.drop_table('public_stream')
