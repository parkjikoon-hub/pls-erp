"""User allowed_modules 컬럼 추가

Revision ID: b1a2c3d4e5f6
Revises: 39210baa2053
Create Date: 2026-03-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'b1a2c3d4e5f6'
down_revision: Union[str, None] = '39210baa2053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """사용자 테이블에 접근 가능 모듈 목록 컬럼 추가 (null이면 전체 모듈 접근 가능)"""
    op.add_column('users', sa.Column('allowed_modules', JSONB(), nullable=True,
                                     comment='접근 가능 모듈 목록 (null=전체)'))


def downgrade() -> None:
    """allowed_modules 컬럼 제거"""
    op.drop_column('users', 'allowed_modules')
