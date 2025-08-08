"""make username unique

Revision ID: 1ab2db0e4b5e
Revises: 
Create Date: 2025-06-27 13:04:10.085253

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '1ab2db0e4b5e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. First, add the unique constraint to the username column
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_user_username', ['username'])
    
    # 2. Now create the dbsession table with the foreign key
    op.create_table('dbsession',
        sa.Column('token', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('ip_address', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('user_agent', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_activity', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.username'], ),
        sa.PrimaryKeyConstraint('token')
    )
    
    # 3. Drop old tables if they exist
    if op.get_bind().engine.dialect.has_table(op.get_bind(), 'session'):
        op.drop_index(op.f('ix_session_token'), table_name='session')
        op.drop_index(op.f('ix_session_user_id'), table_name='session')
        op.drop_table('session')
    
    if op.get_bind().engine.dialect.has_table(op.get_bind(), 'publicstream'):
        op.drop_table('publicstream')
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # 1. First drop the dbsession table
    op.drop_table('dbsession')
    
    # 2. Recreate the old tables
    op.create_table('publicstream',
        sa.Column('uid', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('size', sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column('mtime', sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint('uid', name=op.f('publicstream_pkey'))
    )
    
    op.create_table('session',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('token', sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column('ip_address', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('user_agent', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
        sa.Column('expires_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
        sa.Column('last_used_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
        sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('session_pkey'))
    )
    
    op.create_index(op.f('ix_session_user_id'), 'session', ['user_id'], unique=False)
    op.create_index(op.f('ix_session_token'), 'session', ['token'], unique=True)
    
    # 3. Finally, remove the unique constraint from username
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_constraint('uq_user_username', type_='unique')
    # ### end Alembic commands ###
